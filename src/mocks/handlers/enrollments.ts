import type { HttpHandler } from 'msw'
import type { components } from '@/api/schema'
import {
  apiPath,
  createTicket,
  findCourse,
  findUser,
  mockDb,
  receiptHeaders,
  unfinishedTicketOf,
} from '../db'
import { authorize, requireAdmission, type Authenticated } from '../jwt'
import {
  bodylessViolations,
  checkMember,
  COURSE_CODE_MESSAGE,
  COURSE_CODE_PATTERN,
  invalidInput,
  jsonResponse,
  pathViolations,
  problem,
  problemResponse,
  queryViolations,
  readJsonObject,
  unknownMemberViolations,
} from '../problems'
import { operation } from '../scenario'
import { compareCode } from '../seed'

type Schemas = components['schemas']

/** Access(401) → STUDENT(403) → current session admitted(409 E15). */
function studentGate(request: Request): { auth: Authenticated } | { response: Response } {
  const gate = authorize(request, 'STUDENT')
  if ('response' in gate) return gate
  const notAdmitted = requireAdmission(gate.auth)
  return notAdmitted ? { response: notAdmitted } : gate
}

/**
 * Filing step shared by enrollment and cancellation, after input validation: missing course
 * (404 E04) → the user's unfinished ticket (409 E03) → 202 receipt. Closure, duplicates and
 * seats are judged later, when the ticket runs.
 */
function fileRequest(
  auth: Authenticated,
  requestType: 'ENROLLMENT' | 'CANCELLATION',
  courseCode: string,
): Response {
  if (!findCourse(courseCode)) {
    return problemResponse(
      problem('E04', 404, { detail: `과목코드 ${courseCode}에 해당하는 과목이 없습니다.` }),
    )
  }
  const pending = unfinishedTicketOf(auth.user.userId)
  if (pending) return problemResponse(problem('E03', 409, { activeTicketId: pending.ticketId }))

  const ticket = createTicket({
    requestType,
    courseCode,
    userId: auth.user.userId,
    sid: auth.session.sid,
  })
  return jsonResponse(
    {
      ticketId: ticket.ticketId,
      requestType,
      status: 'WAITING',
      submittedAt: ticket.submittedAt,
      statusUrl: apiPath(`/tickets/${ticket.ticketId}`),
    } satisfies Schemas['TicketReceipt'],
    202,
    receiptHeaders(ticket),
  )
}

export const enrollmentHandlers: HttpHandler[] = [
  // Access → STUDENT → E15 → no query(400 E09) → 200 ENROLLED rows only, ASCII order.
  operation('listMyEnrollments', 'get', '/me/enrollments', ({ request, url }) => {
    const gate = studentGate(request)
    if ('response' in gate) return gate.response
    const violations = queryViolations(url, [])
    if (violations.length > 0) return invalidInput(violations)

    const items = mockDb.enrollments
      .filter((row) => row.studentId === gate.auth.user.userId && row.status === 'ENROLLED')
      .flatMap((row): Schemas['MyEnrollment'][] => {
        const course = findCourse(row.courseCode)
        if (!course) return []
        return [
          {
            courseCode: course.courseCode,
            name: course.name,
            category: course.category,
            professorName: findUser(course.professorId)?.name ?? course.professorId,
            classroom: course.classroom,
            enrollmentType: row.enrollmentType,
            enrolledAt: row.enrolledAt,
            status: 'ENROLLED',
          },
        ]
      })
      .sort((a, b) => compareCode(a.courseCode, b.courseCode))
    return jsonResponse({ items } satisfies Schemas['MyEnrollmentList'], 200)
  }),

  // Access → STUDENT → E15 → body(400 E09) → E04 → E03 → 202.
  operation('requestEnrollment', 'post', '/me/enrollments', async ({ request, url }) => {
    const gate = studentGate(request)
    if ('response' in gate) return gate.response
    const parsed = await readJsonObject(request)
    if (!parsed.ok) return invalidInput(parsed.violations)
    const violations = [
      ...queryViolations(url, []),
      ...unknownMemberViolations(parsed.body, ['courseCode']),
    ]
    checkMember(
      parsed.body,
      'courseCode',
      (value) => typeof value === 'string' && COURSE_CODE_PATTERN.test(value),
      COURSE_CODE_MESSAGE,
      violations,
    )
    if (violations.length > 0) return invalidInput(violations)
    return fileRequest(gate.auth, 'ENROLLMENT', String(parsed.body.courseCode))
  }),

  // Access → STUDENT → E15 → courseCode and no body(400 E09) → E04 → E03 → 202.
  operation(
    'requestCancellation',
    'delete',
    '/me/enrollments/:courseCode',
    async ({ request, url, params }) => {
      const gate = studentGate(request)
      if ('response' in gate) return gate.response
      const violations = await bodylessViolations(
        request,
        url,
        pathViolations('courseCode', params.courseCode, COURSE_CODE_PATTERN, COURSE_CODE_MESSAGE),
      )
      if (violations.length > 0) return invalidInput(violations)
      return fileRequest(gate.auth, 'CANCELLATION', params.courseCode)
    },
  ),
]

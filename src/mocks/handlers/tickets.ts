import type { HttpHandler } from 'msw'
import type { components } from '@/api/schema'
import {
  activeEnrollment,
  createSession,
  findCourse,
  findSession,
  findTicket,
  findUser,
  isTerminal,
  mockDb,
  nowIso,
  proofTicket,
  sessionState,
  type MockTicket,
} from '../db'
import { authenticate } from '../jwt'
import {
  invalidInput,
  jsonResponse,
  pathViolations,
  problem,
  problemResponse,
  queryViolations,
  TICKET_ID_PATTERN,
} from '../problems'
import { operation, takeForcedResult } from '../scenario'
import { SEED } from '../seed'

type Schemas = components['schemas']
type ResultCode = Schemas['TicketResultCode']

/**
 * Judgement at the terminal poll. `commit` is the success effect when it is structurally
 * possible; it runs for an OK result (judged or forced) and never for a rejection.
 */
interface Verdict {
  code: ResultCode
  commit: (() => void) | null
}

/** Execution is pinned to the filing session: it must be ACTIVE, the student's own and admitted. */
function filingSessionRejection(ticket: MockTicket): 'E02' | 'E15' | null {
  const session = ticket.sid === null ? undefined : findSession(ticket.sid)
  if (
    !session ||
    sessionState(session) !== 'ACTIVE' ||
    session.userId !== ticket.userId ||
    findUser(session.userId)?.role !== 'STUDENT'
  ) {
    return 'E02'
  }
  return session.admittedAt === null ? 'E15' : null
}

function judge(ticket: MockTicket): Verdict {
  switch (ticket.requestType) {
    case 'LOGIN': {
      // Credential check: unknown id and wrong password are both E01, as is an expired context.
      const { credential, credentialExpiresAt } = ticket
      const user = credential === null ? undefined : findUser(credential.userId)
      const verified =
        user !== undefined &&
        user.password === credential?.password &&
        credentialExpiresAt !== null &&
        Date.parse(credentialExpiresAt) > Date.now()
      return {
        code: verified ? 'OK' : 'E01',
        // Session creation and the OK result commit together (contract 4.6 #1).
        commit: user
          ? () => {
              ticket.loginSid = createSession(user.userId, false).sid
            }
          : null,
      }
    }
    case 'ADMISSION': {
      // Admission is recorded on the filing session only, never on the polling one.
      const session = ticket.sid === null ? undefined : findSession(ticket.sid)
      const valid =
        session !== undefined &&
        sessionState(session) === 'ACTIVE' &&
        session.userId === ticket.userId &&
        findUser(session.userId)?.role === 'STUDENT'
      return {
        code: valid ? 'OK' : 'E02',
        commit: session
          ? () => {
              session.admittedAt ??= nowIso()
            }
          : null,
      }
    }
    case 'ENROLLMENT': {
      // E02/E15 → E04 → E05 → E06 → E07 → insert (STUDENT row, count + 1).
      const studentId = ticket.userId ?? ''
      const course = ticket.courseCode === null ? undefined : findCourse(ticket.courseCode)
      const enrolled = course ? activeEnrollment(studentId, course.courseCode) : undefined
      const commit =
        course && course.status === 'OPEN' && !enrolled
          ? () => {
              mockDb.enrollments.push({
                studentId,
                courseCode: course.courseCode,
                enrollmentType: 'STUDENT',
                status: 'ENROLLED',
                enrolledAt: nowIso(),
                assignedBy: null,
              })
              course.activeEnrollmentCount += 1
            }
          : null
      // Mock-only demo course: its enrollment tickets exhaust the reinjection limit.
      if (ticket.courseCode === SEED.course.e99) return { code: 'E99', commit }
      const code: ResultCode =
        filingSessionRejection(ticket) ??
        (!course
          ? 'E04'
          : course.status === 'CLOSED'
            ? 'E05'
            : enrolled
              ? 'E06'
              : course.activeEnrollmentCount >= course.capacity
                ? 'E07'
                : 'OK')
      return { code, commit }
    }
    case 'CANCELLATION': {
      // E02/E15 → E04 → E05 → E08 → delete (count − 1). ADMIN rows and over-capacity are fine.
      const course = ticket.courseCode === null ? undefined : findCourse(ticket.courseCode)
      const row = course ? activeEnrollment(ticket.userId ?? '', course.courseCode) : undefined
      const commit =
        course && row
          ? () => {
              mockDb.enrollments.splice(mockDb.enrollments.indexOf(row), 1)
              course.activeEnrollmentCount = Math.max(0, course.activeEnrollmentCount - 1)
            }
          : null
      const code: ResultCode =
        filingSessionRejection(ticket) ??
        (!course ? 'E04' : course.status === 'CLOSED' ? 'E05' : !row ? 'E08' : 'OK')
      return { code, commit }
    }
  }
}

/**
 * Progress by poll count: WAITING (positions waitingPolls…1) → PROCESSING once → terminal.
 * The business effect is applied at the terminal poll.
 */
function advance(ticket: MockTicket): void {
  if (isTerminal(ticket.status)) return
  ticket.polls += 1
  const { waitingPolls } = mockDb.config
  if (ticket.polls <= waitingPolls) {
    ticket.status = 'WAITING'
    ticket.queuePosition = waitingPolls - ticket.polls + 1
    return
  }
  ticket.queuePosition = null
  if (ticket.polls === waitingPolls + 1) {
    ticket.status = 'PROCESSING'
    return
  }
  const forced = takeForcedResult(ticket)
  const verdict = judge(ticket)
  const code = forced ?? verdict.code
  if (code === 'OK') verdict.commit?.()
  // The plain-text password lives only until the LOGIN judgement.
  ticket.credential = null
  ticket.status = code === 'OK' ? 'SUCCEEDED' : 'REJECTED'
  ticket.result = { code, completedAt: nowIso() }
}

export const ticketHandlers: HttpHandler[] = [
  // ticketId(400 E09) → Authorization present and invalid(401) → eligibility(403 FORBIDDEN, no
  // existence leak) → 200 (+ Retry-After while unfinished). LOGIN tickets are read with the
  // proof cookie only; the others with any valid Access of the same user.
  operation('getTicket', 'get', '/tickets/:ticketId', ({ request, url, params }) => {
    const violations = [
      ...pathViolations(
        'ticketId',
        params.ticketId,
        TICKET_ID_PATTERN,
        '양의 10진수 문자열이어야 합니다.',
      ),
      ...queryViolations(url, []),
    ]
    if (violations.length > 0) return invalidInput(violations)

    let viewerId: string | undefined
    if (request.headers.has('Authorization')) {
      const auth = authenticate(request)
      if (!auth.ok) return auth.response
      viewerId = auth.user.userId
    }
    const ticket = findTicket(params.ticketId)
    const visible =
      ticket?.requestType === 'LOGIN'
        ? proofTicket() === ticket
        : ticket !== undefined && viewerId !== undefined && viewerId === ticket.userId
    if (!ticket || !visible) {
      return problemResponse(
        problem('E02', 403, { reason: 'FORBIDDEN', detail: '이 티켓을 조회할 수 없습니다.' }),
      )
    }

    advance(ticket)
    return jsonResponse(
      {
        ticketId: ticket.ticketId,
        requestType: ticket.requestType,
        courseCode: ticket.courseCode,
        submittedAt: ticket.submittedAt,
        status: ticket.status,
        queuePosition: ticket.queuePosition,
        result: ticket.result,
      } satisfies Schemas['Ticket'],
      200,
      isTerminal(ticket.status)
        ? {}
        : { 'Retry-After': String(mockDb.config.retryAfterSeconds) },
    )
  }),
]

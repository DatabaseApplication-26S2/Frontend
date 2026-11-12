import type { HttpHandler } from 'msw'
import type { components } from '@/api/schema'
import {
  activeEnrollment,
  closeCourse,
  findCourse,
  findUser,
  isClosureCandidate,
  mockDb,
  nowIso,
  sessionState,
  sortedCourses,
} from '../db'
import { authorize } from '../jwt'
import {
  checkMember,
  COURSE_CODE_MESSAGE,
  COURSE_CODE_PATTERN,
  invalidInput,
  isIntegerBetween,
  jsonResponse,
  pointer,
  problem,
  problemResponse,
  queryViolations,
  readJsonObject,
  unknownMemberViolations,
  type FieldViolation,
} from '../problems'
import { operation } from '../scenario'
import { PAGE_SIZE, pageQuery } from './courses'

type Schemas = components['schemas']

/** Snapshot: active slots are PROCESSING tickets, waiting count is WAITING tickets. */
function settingsView(): Schemas['ServiceSettings'] {
  const activeSlots = mockDb.tickets.filter((ticket) => ticket.status === 'PROCESSING').length
  return {
    concurrencyLimit: mockDb.settings.concurrencyLimit,
    activeSlots,
    availableSlots: Math.max(mockDb.settings.concurrencyLimit - activeSlots, 0),
    waitingCount: mockDb.tickets.filter((ticket) => ticket.status === 'WAITING').length,
    lastChangedBy: mockDb.settings.lastChangedBy,
    lastChangedAt: mockDb.settings.lastChangedAt,
  }
}

export const adminHandlers: HttpHandler[] = [
  // Access → ADMIN → body(400 E09) → studentId not a student(422 E13) → E04 → CLOSED(409 E05)
  // → already enrolled(409 E06) → ADMIN row, count + 1, capacity not checked → 201.
  operation('createAdminEnrollment', 'post', '/admin/enrollments', async ({ request, url }) => {
    const gate = authorize(request, 'ADMIN')
    if ('response' in gate) return gate.response
    const parsed = await readJsonObject(request)
    if (!parsed.ok) return invalidInput(parsed.violations)
    const { body } = parsed
    const violations = [
      ...queryViolations(url, []),
      ...unknownMemberViolations(body, ['studentId', 'courseCode']),
    ]
    checkMember(
      body,
      'studentId',
      (value) => typeof value === 'string' && value.length > 0,
      '비어 있지 않은 문자열이어야 합니다.',
      violations,
    )
    checkMember(
      body,
      'courseCode',
      (value) => typeof value === 'string' && COURSE_CODE_PATTERN.test(value),
      COURSE_CODE_MESSAGE,
      violations,
    )
    if (violations.length > 0) return invalidInput(violations)

    const input = body as Schemas['AdminEnrollmentRequest']
    if (findUser(input.studentId)?.role !== 'STUDENT') {
      return problemResponse(problem('E13', 422))
    }
    const course = findCourse(input.courseCode)
    if (!course) {
      return problemResponse(
        problem('E04', 404, { detail: `과목코드 ${input.courseCode}에 해당하는 과목이 없습니다.` }),
      )
    }
    if (course.status === 'CLOSED') return problemResponse(problem('E05', 409))
    if (activeEnrollment(input.studentId, course.courseCode)) {
      return problemResponse(
        problem('E06', 409, {
          detail: `학생 ${input.studentId}은 이미 ${course.courseCode}을 신청했습니다.`,
        }),
      )
    }

    const enrolledAt = nowIso()
    mockDb.enrollments.push({
      studentId: input.studentId,
      courseCode: course.courseCode,
      enrollmentType: 'ADMIN',
      status: 'ENROLLED',
      enrolledAt,
      assignedBy: gate.auth.user.userId,
    })
    course.activeEnrollmentCount += 1
    return jsonResponse(
      {
        studentId: input.studentId,
        courseCode: course.courseCode,
        enrollmentType: 'ADMIN',
        status: 'ENROLLED',
        enrolledAt,
        activeEnrollmentCount: course.activeEnrollmentCount,
        capacity: course.capacity,
        overCapacity: course.activeEnrollmentCount > course.capacity,
      } satisfies Schemas['AdminEnrollmentResult'],
      201,
    )
  }),

  // Access → ADMIN → no query(400 E09) → 200 snapshot.
  operation('getServiceSettings', 'get', '/admin/settings', ({ request, url }) => {
    const gate = authorize(request, 'ADMIN')
    if ('response' in gate) return gate.response
    const violations = queryViolations(url, [])
    if (violations.length > 0) return invalidInput(violations)
    return jsonResponse(settingsView(), 200)
  }),

  // Access → ADMIN → body(400 E09: integer 1–1000) → 200. Same value changes nothing (the last
  // changer and time stay); a new value records this admin and the time.
  operation('updateServiceSettings', 'put', '/admin/settings', async ({ request, url }) => {
    const gate = authorize(request, 'ADMIN')
    if ('response' in gate) return gate.response
    const parsed = await readJsonObject(request)
    if (!parsed.ok) return invalidInput(parsed.violations)
    const violations = [
      ...queryViolations(url, []),
      ...unknownMemberViolations(parsed.body, ['concurrencyLimit']),
    ]
    checkMember(
      parsed.body,
      'concurrencyLimit',
      (value) => isIntegerBetween(value, 1, 1000),
      '1 이상 1000 이하의 정수여야 합니다.',
      violations,
    )
    if (violations.length > 0) return invalidInput(violations)

    const { concurrencyLimit } = parsed.body as Schemas['ServiceSettingsUpdateRequest']
    if (concurrencyLimit !== mockDb.settings.concurrencyLimit) {
      Object.assign(mockDb.settings, {
        concurrencyLimit,
        lastChangedBy: gate.auth.user.userId,
        lastChangedAt: nowIso(),
      })
    }
    return jsonResponse(settingsView(), 200)
  }),

  // Access → ADMIN → query(400 E09) → 200 "OPEN and below minimum", 20 per page, ASCII order.
  operation('listClosureCandidates', 'get', '/admin/closure-candidates', ({ request, url }) => {
    const gate = authorize(request, 'ADMIN')
    if ('response' in gate) return gate.response
    const violations = queryViolations(url, ['page'])
    const page = pageQuery(url, violations)
    if (violations.length > 0) return invalidInput(violations)

    const candidates = sortedCourses()
      .filter(isClosureCandidate)
      .map(
        (course): Schemas['ClosureCandidate'] => ({
          courseCode: course.courseCode,
          name: course.name,
          professorName: findUser(course.professorId)?.name ?? course.professorId,
          activeEnrollmentCount: course.activeEnrollmentCount,
          minimumEnrollment: course.minimumEnrollment,
          capacity: course.capacity,
        }),
      )
    return jsonResponse(
      {
        items: candidates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        page,
        pageSize: PAGE_SIZE,
        totalItems: candidates.length,
        totalPages: Math.ceil(candidates.length / PAGE_SIZE),
      } satisfies Schemas['ClosureCandidatePage'],
      200,
    )
  }),

  // Access → ADMIN → body(400 E09: empty, duplicate, malformed, unknown member; nothing runs)
  // → per course in input order: admin still valid (else E02 for the rest) → E04 → E14 → OK.
  operation('closeCourses', 'post', '/admin/course-closures', async ({ request, url }) => {
    const gate = authorize(request, 'ADMIN')
    if ('response' in gate) return gate.response
    const parsed = await readJsonObject(request)
    if (!parsed.ok) return invalidInput(parsed.violations)
    const violations: FieldViolation[] = [
      ...queryViolations(url, []),
      ...unknownMemberViolations(parsed.body, ['courseCodes']),
    ]
    const codes = parsed.body.courseCodes
    if (!('courseCodes' in parsed.body)) {
      violations.push({ source: 'BODY', field: '/courseCodes', message: '필수 항목입니다.' })
    } else if (!Array.isArray(codes) || codes.length === 0) {
      violations.push({
        source: 'BODY',
        field: '/courseCodes',
        message: '과목코드를 1개 이상 보내야 합니다.',
      })
    } else {
      codes.forEach((code: unknown, index) => {
        if (typeof code !== 'string' || !COURSE_CODE_PATTERN.test(code)) {
          violations.push({
            source: 'BODY',
            field: pointer('courseCodes', index),
            message: COURSE_CODE_MESSAGE,
          })
        } else if (codes.indexOf(code) !== index) {
          violations.push({
            source: 'BODY',
            field: pointer('courseCodes', index),
            message: '앞 항목과 중복된 과목코드입니다.',
          })
        }
      })
    }
    if (violations.length > 0) return invalidInput(violations)

    const { auth } = gate
    let adminValid = true
    const items = (codes as string[]).map((courseCode): Schemas['CourseClosureItemResult'] => {
      // Each course is its own transaction; the admin is re-checked before each one.
      adminValid &&= sessionState(auth.session) === 'ACTIVE' && auth.user.role === 'ADMIN'
      if (!adminValid) return { courseCode, code: 'E02', closedEnrollmentCount: null }
      const course = findCourse(courseCode)
      if (!course) return { courseCode, code: 'E04', closedEnrollmentCount: null }
      if (!isClosureCandidate(course)) {
        return { courseCode, code: 'E14', closedEnrollmentCount: null }
      }
      return { courseCode, code: 'OK', closedEnrollmentCount: closeCourse(course) }
    })
    return jsonResponse({ items } satisfies Schemas['CourseClosureBatchResult'], 200)
  }),
]

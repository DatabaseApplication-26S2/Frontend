import type { HttpHandler } from 'msw'
import type { components } from '@/api/schema'
import {
  apiPath,
  closeCourse,
  courseView,
  findCourse,
  isClosureCandidate,
  mockDb,
  sortedCourses,
  type MockCourse,
} from '../db'
import { authorize, type Authenticated } from '../jwt'
import {
  bodylessViolations,
  checkMember,
  COURSE_CODE_MESSAGE,
  COURSE_CODE_PATTERN,
  invalidInput,
  isIntegerBetween,
  isNonBlankString,
  jsonResponse,
  pathViolations,
  problem,
  problemResponse,
  queryViolations,
  readJsonObject,
  unknownMemberViolations,
  type FieldViolation,
} from '../problems'
import { operation } from '../scenario'

type Schemas = components['schemas']

const INT_MAX = 2147483647
const EDITABLE_FIELDS = [
  'name',
  'category',
  'evaluationType',
  'capacity',
  'minimumEnrollment',
  'classroom',
] as const
const SERVER_OWNED_FIELDS = [
  'courseCode',
  'professorName',
  'activeEnrollmentCount',
  'remainingSeats',
  'status',
  'enrolled',
]

/**
 * Course body rules shared by create and update: required members, enums, integer ranges and
 * 1 ≤ minimumEnrollment ≤ capacity compared within the body. Names and classrooms must contain a
 * non-space character and are kept untrimmed.
 */
function courseBodyViolations(
  body: Record<string, unknown>,
  mode: 'create' | 'update',
): FieldViolation[] {
  const violations =
    mode === 'create'
      ? unknownMemberViolations(body, ['courseCode', ...EDITABLE_FIELDS])
      : unknownMemberViolations(body, EDITABLE_FIELDS, SERVER_OWNED_FIELDS)
  if (mode === 'create') {
    checkMember(
      body,
      'courseCode',
      (value) => typeof value === 'string' && COURSE_CODE_PATTERN.test(value),
      COURSE_CODE_MESSAGE,
      violations,
    )
  }
  checkMember(body, 'name', isNonBlankString, '공백만으로 된 값은 쓸 수 없습니다.', violations)
  checkMember(
    body,
    'category',
    (value) => value === 'GENERAL' || value === 'MAJOR',
    'GENERAL 또는 MAJOR여야 합니다.',
    violations,
  )
  checkMember(
    body,
    'evaluationType',
    (value) => value === 'RELATIVE' || value === 'ABSOLUTE' || value === 'PASS_FAIL',
    'RELATIVE, ABSOLUTE, PASS_FAIL 중 하나여야 합니다.',
    violations,
  )
  const capacityValid = checkMember(
    body,
    'capacity',
    (value) => isIntegerBetween(value, 1, INT_MAX),
    '1 이상 2147483647 이하의 정수여야 합니다.',
    violations,
  )
  const minimumValid = checkMember(
    body,
    'minimumEnrollment',
    (value) => isIntegerBetween(value, 1, INT_MAX),
    '1 이상 정원 이하여야 합니다.',
    violations,
  )
  if (capacityValid && minimumValid && Number(body.minimumEnrollment) > Number(body.capacity)) {
    violations.push({
      source: 'BODY',
      field: '/minimumEnrollment',
      message: '1 이상 정원 이하여야 합니다.',
    })
  }
  checkMember(body, 'classroom', isNonBlankString, '공백만으로 된 값은 쓸 수 없습니다.', violations)
  return violations
}

/** Missing course (404 E04) → not the caller's course (403 FORBIDDEN). */
function ownedCourse(
  auth: Authenticated,
  courseCode: string,
): { course: MockCourse } | { response: Response } {
  const course = findCourse(courseCode)
  if (!course) {
    return {
      response: problemResponse(
        problem('E04', 404, { detail: `과목코드 ${courseCode}에 해당하는 과목이 없습니다.` }),
      ),
    }
  }
  if (course.professorId !== auth.user.userId) {
    return {
      response: problemResponse(
        problem('E02', 403, {
          reason: 'FORBIDDEN',
          detail: '본인이 담당하는 과목만 변경할 수 있습니다.',
        }),
      ),
    }
  }
  return { course }
}

export const professorHandlers: HttpHandler[] = [
  // Access → PROFESSOR → no query(400 E09) → 200 own courses incl. CLOSED, ASCII order.
  operation('listProfessorCourses', 'get', '/professor/courses', ({ request, url }) => {
    const gate = authorize(request, 'PROFESSOR')
    if ('response' in gate) return gate.response
    const violations = queryViolations(url, [])
    if (violations.length > 0) return invalidInput(violations)
    const items = sortedCourses()
      .filter((course) => course.professorId === gate.auth.user.userId)
      .map((course) => courseView(course, gate.auth.user))
    return jsonResponse({ items } satisfies Schemas['CourseList'], 200)
  }),

  // Access → PROFESSOR → body(400 E09) → duplicate code incl. CLOSED(409 E10) → 201 + Location.
  operation('createProfessorCourse', 'post', '/professor/courses', async ({ request, url }) => {
    const gate = authorize(request, 'PROFESSOR')
    if ('response' in gate) return gate.response
    const parsed = await readJsonObject(request)
    if (!parsed.ok) return invalidInput(parsed.violations)
    const violations = [...queryViolations(url, []), ...courseBodyViolations(parsed.body, 'create')]
    if (violations.length > 0) return invalidInput(violations)

    const input = parsed.body as Schemas['CourseCreateRequest']
    if (findCourse(input.courseCode)) {
      return problemResponse(
        problem('E10', 409, {
          detail: `과목코드 ${input.courseCode}은 이미 사용 중입니다. 폐강된 과목의 코드도 다시 쓸 수 없습니다.`,
        }),
      )
    }
    const course: MockCourse = {
      courseCode: input.courseCode,
      name: input.name,
      category: input.category,
      professorId: gate.auth.user.userId,
      evaluationType: input.evaluationType,
      capacity: input.capacity,
      minimumEnrollment: input.minimumEnrollment,
      activeEnrollmentCount: 0,
      classroom: input.classroom,
      status: 'OPEN',
    }
    mockDb.courses.push(course)
    return jsonResponse(courseView(course, gate.auth.user) satisfies Schemas['Course'], 201, {
      Location: apiPath(`/courses/${course.courseCode}`),
    })
  }),

  // Access → PROFESSOR → path·body(400 E09) → E04 → owner(403) → CLOSED(409 E05)
  // → capacity changed and below the active count(409 E11) → 200.
  operation(
    'updateProfessorCourse',
    'put',
    '/professor/courses/:courseCode',
    async ({ request, url, params }) => {
      const gate = authorize(request, 'PROFESSOR')
      if ('response' in gate) return gate.response
      const pathChecks = pathViolations(
        'courseCode',
        params.courseCode,
        COURSE_CODE_PATTERN,
        COURSE_CODE_MESSAGE,
      )
      const parsed = await readJsonObject(request)
      const violations = [
        ...pathChecks,
        ...queryViolations(url, []),
        ...(parsed.ok ? courseBodyViolations(parsed.body, 'update') : parsed.violations),
      ]
      if (!parsed.ok || violations.length > 0) return invalidInput(violations)

      const owned = ownedCourse(gate.auth, params.courseCode)
      if ('response' in owned) return owned.response
      const { course } = owned
      if (course.status === 'CLOSED') {
        return problemResponse(problem('E05', 409, { detail: '폐강된 과목은 수정할 수 없습니다.' }))
      }
      const input = parsed.body as Schemas['CourseUpdateRequest']
      if (input.capacity !== course.capacity && input.capacity < course.activeEnrollmentCount) {
        return problemResponse(
          problem('E11', 409, {
            detail: `새 정원 ${input.capacity}은 현재 인원 ${course.activeEnrollmentCount}보다 작습니다.`,
          }),
        )
      }
      Object.assign(course, {
        name: input.name,
        category: input.category,
        evaluationType: input.evaluationType,
        capacity: input.capacity,
        minimumEnrollment: input.minimumEnrollment,
        classroom: input.classroom,
      })
      return jsonResponse(courseView(course, gate.auth.user) satisfies Schemas['Course'], 200)
    },
  ),

  // Access → PROFESSOR → path·no body(400 E09) → E04 → owner(403) → not "OPEN and below the
  // minimum"(409 E14, already closed included) → close, keep rows as CLOSED, count 0 → 200.
  operation(
    'closeProfessorCourse',
    'post',
    '/professor/courses/:courseCode/closure',
    async ({ request, url, params }) => {
      const gate = authorize(request, 'PROFESSOR')
      if ('response' in gate) return gate.response
      const violations = await bodylessViolations(
        request,
        url,
        pathViolations('courseCode', params.courseCode, COURSE_CODE_PATTERN, COURSE_CODE_MESSAGE),
      )
      if (violations.length > 0) return invalidInput(violations)

      const owned = ownedCourse(gate.auth, params.courseCode)
      if ('response' in owned) return owned.response
      const { course } = owned
      if (!isClosureCandidate(course)) {
        return problemResponse(
          problem(
            'E14',
            409,
            course.status === 'CLOSED' ? { detail: '이미 폐강된 과목입니다.' } : {},
          ),
        )
      }
      const closedEnrollmentCount = closeCourse(course)
      return jsonResponse(
        {
          course: { ...courseView(course, gate.auth.user), status: 'CLOSED' },
          closedEnrollmentCount,
        } satisfies Schemas['CourseClosureResult'],
        200,
      )
    },
  ),
]

import type { HttpHandler } from 'msw'
import type { components } from '@/api/schema'
import { courseView, findCourse, sortedCourses } from '../db'
import { authenticate, requireAdmission } from '../jwt'
import {
  COURSE_CODE_MESSAGE,
  COURSE_CODE_PATTERN,
  invalidInput,
  jsonResponse,
  pathViolations,
  problem,
  problemResponse,
  queryViolations,
  type FieldViolation,
} from '../problems'
import { operation } from '../scenario'

type Schemas = components['schemas']

export const PAGE_SIZE = 20
const CATEGORY_FILTERS: readonly string[] = ['ALL', 'GENERAL', 'MAJOR']

/** `page` query: absent → 1; otherwise a positive integer, else an E09 violation is recorded. */
export function pageQuery(url: URL, violations: FieldViolation[]): number {
  const raw = url.searchParams.get('page')
  if (raw === null) return 1
  const page = /^[0-9]+$/.test(raw) ? Number(raw) : NaN
  if (Number.isSafeInteger(page) && page >= 1) return page
  violations.push({ source: 'QUERY', field: 'page', message: '1 이상의 정수여야 합니다.' })
  return 1
}

/** Literal substring match where only ASCII A–Z fold case (no trim, no normalisation). */
function foldAscii(text: string): string {
  return text.replace(/[A-Z]/g, (letter) => letter.toLowerCase())
}

export const courseHandlers: HttpHandler[] = [
  // Access(401) → student admission(409 E15) → query(400 E09) → 200, 20 per page, ASCII order.
  operation('searchCourses', 'get', '/courses', ({ request, url }) => {
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const notAdmitted = requireAdmission(auth)
    if (notAdmitted) return notAdmitted

    const violations = queryViolations(url, ['category', 'q', 'page'])
    const category = url.searchParams.get('category') ?? 'ALL'
    if (!CATEGORY_FILTERS.includes(category)) {
      violations.push({
        source: 'QUERY',
        field: 'category',
        message: 'ALL, GENERAL, MAJOR 중 하나여야 합니다.',
      })
    }
    const page = pageQuery(url, violations)
    if (violations.length > 0) return invalidInput(violations)

    const q = foldAscii(url.searchParams.get('q') ?? '')
    const matches = sortedCourses()
      .map((course) => courseView(course, auth.user))
      .filter(
        (course) =>
          (category === 'ALL' || course.category === category) &&
          (q === '' ||
            [course.name, course.courseCode, course.professorName].some((text) =>
              foldAscii(text).includes(q),
            )),
      )
    return jsonResponse(
      {
        items: matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        page,
        pageSize: PAGE_SIZE,
        totalItems: matches.length,
        totalPages: Math.ceil(matches.length / PAGE_SIZE),
      } satisfies Schemas['CoursePage'],
      200,
    )
  }),

  // Access(401) → student admission(409 E15) → courseCode(400 E09) → missing(404 E04) → 200.
  operation('getCourse', 'get', '/courses/:courseCode', ({ request, url, params }) => {
    const auth = authenticate(request)
    if (!auth.ok) return auth.response
    const notAdmitted = requireAdmission(auth)
    if (notAdmitted) return notAdmitted
    const violations = [
      ...pathViolations('courseCode', params.courseCode, COURSE_CODE_PATTERN, COURSE_CODE_MESSAGE),
      ...queryViolations(url, []),
    ]
    if (violations.length > 0) return invalidInput(violations)

    const course = findCourse(params.courseCode)
    if (!course) {
      return problemResponse(
        problem('E04', 404, { detail: `과목코드 ${params.courseCode}에 해당하는 과목이 없습니다.` }),
      )
    }
    return jsonResponse(courseView(course, auth.user) satisfies Schemas['Course'], 200)
  }),
]

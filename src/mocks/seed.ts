import type { components } from '@/api/schema'

type Schemas = components['schemas']

/** Mock-only shared demo password for every seeded account (D-20). Never used against a real server. */
export const MOCK_PASSWORD = 'crs-demo-1234'

/** Seed identifiers the tests and the browser scenarios rely on (design 3.7 invariants). */
export const SEED = {
  student: '20260001',
  student2: '20260002',
  professor: 'P1001',
  professor2: 'P1002',
  admin: 'A0001',
  course: {
    /** OPEN, P1001, capacity 40, active 12, minimum 10. Neither seeded student is enrolled. */
    open: 'CSE3010',
    /** OPEN, P1002, capacity 3, active 3. */
    full: 'GEN1001',
    /** CLOSED. */
    closed: 'HIS1002',
    /** OPEN, P1001. `student` holds an ADMIN-type enrollment. */
    enrolled: 'CSE4020',
    /** OPEN, P1001, active 0 < minimum 5: closable and a closure candidate. */
    closable: 'CSE2040',
    /** Exists, so registering it again is E10. */
    existing: 'CSE4510',
    /** OPEN. Every enrollment ticket for it ends with E99 (mock-only course). */
    e99: 'ERR0099',
    /** Not seeded: registering it succeeds. */
    unused: 'CSE4999',
    /** Not seeded: E04. */
    missing: 'NOP0000',
  },
} as const

export interface MockUser {
  userId: string
  name: string
  role: Schemas['UserRole']
  password: string
}

export interface MockCourse {
  courseCode: string
  name: string
  category: Schemas['CourseCategory']
  professorId: string
  evaluationType: Schemas['EvaluationType']
  capacity: number
  minimumEnrollment: number
  /** Current ENROLLED rows. Kept in step with `enrollments`; 0 once the course is CLOSED. */
  activeEnrollmentCount: number
  classroom: string
  status: Schemas['CourseStatus']
}

export interface MockEnrollment {
  studentId: string
  courseCode: string
  enrollmentType: Schemas['EnrollmentType']
  status: Schemas['EnrollmentStatus']
  enrolledAt: string
  /** Assigning admin for ADMIN rows, null for student requests. */
  assignedBy: string | null
}

/** ASCII (byte) order. Course codes are ASCII, so UTF-16 code-unit comparison is byte order. */
export function compareCode(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

const STUDENT_COUNT = 60
const FIRST_STUDENT_NUMBER = 20260001
const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임']
const GIVEN_NAMES = ['민준', '서연', '도윤', '하은', '지호', '수아']

const STUDENT_IDS = Array.from({ length: STUDENT_COUNT }, (_, index) =>
  String(FIRST_STUDENT_NUMBER + index),
)

/** Students 20260001–20260060, professors P1001–P1003, admin A0001; all use MOCK_PASSWORD. */
export function seedUsers(): MockUser[] {
  const students = STUDENT_IDS.map(
    (userId, index): MockUser => ({
      userId,
      // 10 surnames x 6 given names = 60 distinct names.
      name: `${SURNAMES[index % SURNAMES.length]}${GIVEN_NAMES[Math.floor(index / SURNAMES.length)]}`,
      role: 'STUDENT',
      password: MOCK_PASSWORD,
    }),
  )
  return [
    ...students,
    { userId: 'P1001', name: '한정우', role: 'PROFESSOR', password: MOCK_PASSWORD },
    { userId: 'P1002', name: '서지민', role: 'PROFESSOR', password: MOCK_PASSWORD },
    { userId: 'P1003', name: '문태호', role: 'PROFESSOR', password: MOCK_PASSWORD },
    { userId: SEED.admin, name: '학사관리자', role: 'ADMIN', password: MOCK_PASSWORD },
  ]
}

type CourseRow = readonly [
  courseCode: string,
  name: string,
  category: Schemas['CourseCategory'],
  professorId: string,
  evaluationType: Schemas['EvaluationType'],
  capacity: number,
  minimumEnrollment: number,
  activeEnrollmentCount: number,
  classroom: string,
  status?: Schemas['CourseStatus'],
]

// 25 courses: 20 on page 1, 5 on page 2. Closure candidates: CSE2040, ENG1001, GEN1002.
const COURSE_ROWS: readonly CourseRow[] = [
  ['ART1001', '미술의 이해', 'GENERAL', 'P1003', 'PASS_FAIL', 40, 10, 17, '예술관 101'],
  ['BUS1001', '경영학원론', 'GENERAL', 'P1003', 'RELATIVE', 60, 10, 28, '경영관 201'],
  ['CSE1010', '컴퓨터프로그래밍', 'MAJOR', 'P1002', 'RELATIVE', 60, 10, 41, '공학관 301'],
  ['CSE2010', '자료구조', 'MAJOR', 'P1002', 'RELATIVE', 50, 10, 33, '공학관 302'],
  ['CSE2040', '이산수학', 'MAJOR', 'P1001', 'ABSOLUTE', 30, 5, 0, '공학관 303'],
  ['CSE3010', '데이터베이스', 'MAJOR', 'P1001', 'RELATIVE', 40, 10, 12, '공학관 401'],
  ['CSE3020', '운영체제', 'MAJOR', 'P1002', 'RELATIVE', 40, 10, 26, '공학관 402'],
  ['CSE3030', '컴퓨터네트워크', 'MAJOR', 'P1003', 'ABSOLUTE', 40, 10, 19, '공학관 403'],
  ['CSE4020', '소프트웨어공학', 'MAJOR', 'P1001', 'ABSOLUTE', 40, 5, 9, '공학관 404'],
  ['CSE4510', '인공지능', 'MAJOR', 'P1002', 'RELATIVE', 35, 10, 22, '공학관 405'],
  ['ECO1001', '경제학원론', 'GENERAL', 'P1003', 'RELATIVE', 60, 10, 24, '사회관 101'],
  ['ENG1001', '대학영어', 'GENERAL', 'P1003', 'PASS_FAIL', 30, 5, 3, '인문관 201'],
  ['ERR0099', '오류 재현 실습', 'MAJOR', 'P1003', 'PASS_FAIL', 30, 1, 2, '공학관 501'],
  ['GEN1001', '글쓰기와 소통', 'GENERAL', 'P1002', 'ABSOLUTE', 3, 1, 3, '인문관 301'],
  ['GEN1002', '철학의 이해', 'GENERAL', 'P1003', 'PASS_FAIL', 1, 1, 0, '인문관 302'],
  ['HIS1001', '한국사', 'GENERAL', 'P1003', 'RELATIVE', 80, 10, 45, '인문관 401'],
  ['HIS1002', '서양사의 이해', 'GENERAL', 'P1001', 'RELATIVE', 40, 10, 0, '인문관 402', 'CLOSED'],
  ['KOR1001', '국어와 작문', 'GENERAL', 'P1002', 'ABSOLUTE', 40, 10, 14, '인문관 403'],
  ['MAT1001', '미적분학', 'GENERAL', 'P1002', 'RELATIVE', 60, 10, 38, '과학관 101'],
  ['MAT2010', '선형대수', 'MAJOR', 'P1002', 'RELATIVE', 50, 10, 27, '과학관 102'],
  ['MUS1001', '음악의 이해', 'GENERAL', 'P1003', 'PASS_FAIL', 40, 10, 16, '예술관 102'],
  ['PHY1001', '일반물리', 'GENERAL', 'P1003', 'ABSOLUTE', 50, 10, 21, '과학관 201'],
  ['PSY1001', '심리학개론', 'GENERAL', 'P1003', 'PASS_FAIL', 70, 10, 33, '사회관 201'],
  ['SOC1001', '사회학개론', 'GENERAL', 'P1003', 'RELATIVE', 50, 10, 19, '사회관 202'],
  ['STA2010', '확률과 통계', 'MAJOR', 'P1002', 'RELATIVE', 45, 10, 24, '과학관 202'],
]

/** The 25 seeded courses in ASCII course-code order. Returns fresh objects on every call. */
export function seedCourses(): MockCourse[] {
  return COURSE_ROWS.map(
    ([
      courseCode,
      name,
      category,
      professorId,
      evaluationType,
      capacity,
      minimumEnrollment,
      activeEnrollmentCount,
      classroom,
      status = 'OPEN',
    ]): MockCourse => ({
      courseCode,
      name,
      category,
      professorId,
      evaluationType,
      capacity,
      minimumEnrollment,
      activeEnrollmentCount: status === 'CLOSED' ? 0 : activeEnrollmentCount,
      classroom,
      status,
    }),
  ).sort((a, b) => compareCode(a.courseCode, b.courseCode))
}

const SEEDED_AT_MS = Date.UTC(2026, 10, 10, 0, 0, 0)

/**
 * ENROLLED rows matching every seeded `activeEnrollmentCount`. `student` holds only CSE4020;
 * `student2` holds nothing. Other rows rotate through 20260003–20260060.
 */
export function seedEnrollments(): MockEnrollment[] {
  const pool = STUDENT_IDS.slice(2)
  return seedCourses().flatMap((course, courseIndex) => {
    if (course.status === 'CLOSED') return []
    const holdsStudent = course.courseCode === SEED.course.enrolled
    const start = (courseIndex * 11) % pool.length
    const others = Array.from(
      { length: course.activeEnrollmentCount - (holdsStudent ? 1 : 0) },
      (_, offset) => pool[(start + offset) % pool.length],
    )
    const members = holdsStudent ? [SEED.student, ...others] : others
    return members.map(
      (studentId, minute): MockEnrollment => ({
        studentId,
        courseCode: course.courseCode,
        // Pre-seeded rows are ADMIN only: STUDENT rows need a backing ticket (plan appendix A).
        enrollmentType: 'ADMIN',
        status: 'ENROLLED',
        enrolledAt: new Date(SEEDED_AT_MS + minute * 60_000).toISOString(),
        assignedBy: SEED.admin,
      }),
    )
  })
}

import { API_BASE_URL } from '@/api/baseUrl'
import type { components, operations } from '@/api/schema'
import {
  compareCode,
  MOCK_PASSWORD,
  SEED,
  seedCourses,
  seedEnrollments,
  seedUsers,
  type MockCourse,
  type MockEnrollment,
  type MockUser,
} from './seed'

type Schemas = components['schemas']

export type OperationId = keyof operations
export type { MockCourse, MockEnrollment, MockUser }

export interface MockSession {
  sid: string
  userId: string
  status: 'ACTIVE' | 'REVOKED'
  revokedReason: 'LOGOUT' | 'REFRESH_REUSE' | 'SCENARIO' | null
  loginAt: string
  /** loginAt + 7 days, never extended. */
  expiresAt: string
  /** Admission is per session; refreshes keep it, new sessions start without it. */
  admittedAt: string | null
}

/** Issued Refresh value (the cookie content). Consumed values stay to detect reuse. */
export interface MockRefreshRecord {
  value: string
  sid: string
  consumed: boolean
}

/** Issued Access token, keyed by `jti`. `expired` is set by `mockScenario.expireAccess()`. */
export interface MockAccessRecord {
  jti: string
  sid: string
  userId: string
  expired: boolean
}

export interface MockTicket {
  ticketId: string
  requestType: Schemas['TicketRequestType']
  courseCode: string | null
  submittedAt: string
  status: Schemas['TicketStatus']
  queuePosition: number | null
  result: Schemas['TicketResult'] | null
  /** Status polls seen so far; drives WAITING → PROCESSING → terminal. */
  polls: number
  /** Verified requester for ADMISSION·ENROLLMENT·CANCELLATION; null for LOGIN. */
  userId: string | null
  /** Session that filed an ADMISSION·ENROLLMENT·CANCELLATION ticket; execution is pinned to it. */
  sid: string | null
  /** LOGIN only: the anonymous ownership proof (`__Host-crs_login` value). */
  loginProof: string | null
  proofExpiresAt: string | null
  /** LOGIN only: short-lived credential context, dropped once judged. */
  credential: { userId: string; password: string } | null
  credentialExpiresAt: string | null
  /** LOGIN only: the session created by a successful judgement. */
  loginSid: string | null
  /** LOGIN only: whether the one-time token exchange already happened. */
  exchanged: boolean
}

export interface MockSettings {
  concurrencyLimit: number
  lastChangedBy: string | null
  lastChangedAt: string | null
}

export interface MockConfig {
  /** `Retry-After` seconds on 202 receipts and unfinished ticket polls. Tests use 0. */
  retryAfterSeconds: number
  /** Polls answered WAITING (positions waitingPolls…1) before the PROCESSING poll. */
  waitingPolls: number
}

export interface MockDb {
  users: MockUser[]
  courses: MockCourse[]
  enrollments: MockEnrollment[]
  sessions: MockSession[]
  tickets: MockTicket[]
  settings: MockSettings
  /** Stand-in for the HttpOnly cookie jar. Handlers never send `Set-Cookie` (design 1.3 #8). */
  cookies: { loginProof: string | null; refresh: string | null }
  /** Requests received per operation, including replaced, held and lost ones. */
  calls: Partial<Record<OperationId, number>>
  config: MockConfig
  refreshTokens: MockRefreshRecord[]
  accessTokens: MockAccessRecord[]
  nextTicketId: number
}

export const mockDb: MockDb = {
  users: [],
  courses: [],
  enrollments: [],
  sessions: [],
  tickets: [],
  settings: { concurrencyLimit: 100, lastChangedBy: null, lastChangedAt: null },
  cookies: { loginProof: null, refresh: null },
  calls: {},
  config: { retryAfterSeconds: 1, waitingPolls: 2 },
  refreshTokens: [],
  accessTokens: [],
  nextTicketId: 1001,
}

/** Settles a held response: `released` delivers it, `aborted` (reset) turns it into a network error. */
export interface Gate {
  promise: Promise<'released' | 'aborted'>
  settle(outcome: 'released' | 'aborted'): void
}

export interface ForcedResult {
  code: Schemas['TicketResultCode']
  requestType?: Schemas['TicketRequestType']
  courseCode?: string
}

/** One-shot `mockScenario` reservations, consumed by the operation wrapper and ticket judging. */
export const reservations = {
  fail: [] as { op: OperationId; failure: 'network' | Schemas['ProblemDetails'] }[],
  hold: [] as { op: OperationId; gate: Gate }[],
  lose: [] as OperationId[],
  forced: [] as ForcedResult[],
  /** Every gate not yet settled, so a reset can abort responses still held. */
  gates: new Set<Gate>(),
}

export function createGate(): Gate {
  let settle: (outcome: 'released' | 'aborted') => void = () => {}
  const promise = new Promise<'released' | 'aborted'>((resolve) => {
    settle = resolve
  })
  const gate: Gate = {
    promise,
    settle(outcome) {
      reservations.gates.delete(gate)
      settle(outcome)
    },
  }
  reservations.gates.add(gate)
  return gate
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const CREDENTIAL_TTL_MS = 5 * 60 * 1000
const PROOF_TTL_MS = 10 * 60 * 1000

let opaqueSequence = 0

/** Unguessable-looking unique value (session ids, cookie values, `jti`). Mock only. */
export function opaque(prefix: string): string {
  opaqueSequence += 1
  return `${prefix}-${opaqueSequence.toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

/** Contract base path (`/api/v1`) for `Location` and `statusUrl` values. */
const API_PATH = new URL(API_BASE_URL, 'http://localhost').pathname.replace(/\/+$/, '')

export function apiPath(path: string): string {
  return `${API_PATH}${path}`
}

// ---------------------------------------------------------------- users and sessions

export function findUser(userId: string): MockUser | undefined {
  return mockDb.users.find((user) => user.userId === userId)
}

export function findSession(sid: string): MockSession | undefined {
  return mockDb.sessions.find((session) => session.sid === sid)
}

/** ACTIVE, or the 401 reason a revoked or expired session reports. */
export function sessionState(
  session: MockSession,
): 'ACTIVE' | 'SESSION_REVOKED' | 'SESSION_EXPIRED' {
  if (session.status === 'REVOKED') return 'SESSION_REVOKED'
  if (Date.parse(session.expiresAt) <= Date.now()) return 'SESSION_EXPIRED'
  return 'ACTIVE'
}

export function revokeSession(session: MockSession, reason: MockSession['revokedReason']): void {
  session.status = 'REVOKED'
  session.revokedReason = reason
}

/** New ACTIVE session. Only students can be admitted; professors and admins never are. */
export function createSession(userId: string, admitted: boolean): MockSession {
  const loginAt = nowIso()
  const session: MockSession = {
    sid: opaque('sid'),
    userId,
    status: 'ACTIVE',
    revokedReason: null,
    loginAt,
    expiresAt: new Date(Date.parse(loginAt) + SESSION_TTL_MS).toISOString(),
    admittedAt: admitted && findUser(userId)?.role === 'STUDENT' ? loginAt : null,
  }
  mockDb.sessions.push(session)
  return session
}

/** Creates an unconsumed Refresh for the session and returns its cookie value. */
export function issueRefresh(sid: string): string {
  const value = opaque('refresh')
  mockDb.refreshTokens.push({ value, sid, consumed: false })
  return value
}

export function findRefresh(value: string | null): MockRefreshRecord | undefined {
  return value === null ? undefined : mockDb.refreshTokens.find((record) => record.value === value)
}

/** Session the current Refresh cookie proves (consumed or not), if any. */
export function cookieSession(): MockSession | undefined {
  const record = findRefresh(mockDb.cookies.refresh)
  return record && findSession(record.sid)
}

// ---------------------------------------------------------------- tickets

export function findTicket(ticketId: string): MockTicket | undefined {
  return mockDb.tickets.find((ticket) => ticket.ticketId === ticketId)
}

export function isTerminal(status: Schemas['TicketStatus']): boolean {
  return status === 'SUCCEEDED' || status === 'REJECTED'
}

/** New queue ticket. It is WAITING at receipt (D-02: RECEIVED is never observed). */
export function createTicket(
  fields: Pick<MockTicket, 'requestType' | 'courseCode' | 'userId' | 'sid'>,
): MockTicket {
  const ticket: MockTicket = {
    ...fields,
    ticketId: String(mockDb.nextTicketId),
    submittedAt: nowIso(),
    status: 'WAITING',
    queuePosition: mockDb.config.waitingPolls + 1,
    result: null,
    polls: 0,
    loginProof: null,
    proofExpiresAt: null,
    credential: null,
    credentialExpiresAt: null,
    loginSid: null,
    exchanged: false,
  }
  mockDb.nextTicketId += 1
  mockDb.tickets.push(ticket)
  return ticket
}

/** Files a LOGIN ticket in a fresh anonymous context and stores its proof in the cookie jar. */
export function startLogin(
  userId: string,
  password: string,
): MockTicket & { loginProof: string; proofExpiresAt: string; credentialExpiresAt: string } {
  const ticket = createTicket({ requestType: 'LOGIN', courseCode: null, userId: null, sid: null })
  const submitted = Date.parse(ticket.submittedAt)
  const login = Object.assign(ticket, {
    loginProof: opaque('login-proof'),
    proofExpiresAt: new Date(submitted + PROOF_TTL_MS).toISOString(),
    credential: { userId, password },
    credentialExpiresAt: new Date(submitted + CREDENTIAL_TTL_MS).toISOString(),
  })
  mockDb.cookies.loginProof = login.loginProof
  return login
}

/** LOGIN ticket the current proof cookie owns, when the proof is still within 600 s. */
export function proofTicket(): MockTicket | undefined {
  const proof = mockDb.cookies.loginProof
  const ticket =
    proof === null
      ? undefined
      : mockDb.tickets.find((t) => t.requestType === 'LOGIN' && t.loginProof === proof)
  if (!ticket?.proofExpiresAt || Date.parse(ticket.proofExpiresAt) <= Date.now()) return undefined
  return ticket
}

/** The user's unfinished ADMISSION·ENROLLMENT·CANCELLATION ticket across all sessions. */
export function unfinishedTicketOf(userId: string): MockTicket | undefined {
  return mockDb.tickets.find(
    (ticket) =>
      ticket.requestType !== 'LOGIN' && ticket.userId === userId && !isTerminal(ticket.status),
  )
}

/** `Location` + `Retry-After` for a 202 receipt. */
export function receiptHeaders(ticket: MockTicket): Record<string, string> {
  return {
    Location: apiPath(`/tickets/${ticket.ticketId}`),
    'Retry-After': String(mockDb.config.retryAfterSeconds),
  }
}

// ---------------------------------------------------------------- courses and enrollments

export function findCourse(courseCode: string): MockCourse | undefined {
  return mockDb.courses.find((course) => course.courseCode === courseCode)
}

export function activeEnrollment(
  studentId: string,
  courseCode: string,
): MockEnrollment | undefined {
  return mockDb.enrollments.find(
    (row) =>
      row.studentId === studentId && row.courseCode === courseCode && row.status === 'ENROLLED',
  )
}

/** API course view. `enrolled` is present only when a student is asking. */
export function courseView(course: MockCourse, viewer: MockUser): Schemas['Course'] {
  const activeEnrollmentCount = course.status === 'CLOSED' ? 0 : course.activeEnrollmentCount
  const view: Schemas['Course'] = {
    courseCode: course.courseCode,
    name: course.name,
    category: course.category,
    professorName: findUser(course.professorId)?.name ?? course.professorId,
    evaluationType: course.evaluationType,
    capacity: course.capacity,
    minimumEnrollment: course.minimumEnrollment,
    activeEnrollmentCount,
    remainingSeats: Math.max(course.capacity - activeEnrollmentCount, 0),
    classroom: course.classroom,
    status: course.status,
  }
  if (viewer.role === 'STUDENT') {
    view.enrolled = activeEnrollment(viewer.userId, course.courseCode) !== undefined
  }
  return view
}

/** "OPEN and active count below the minimum" — the only closable state. */
export function isClosureCandidate(course: MockCourse): boolean {
  return course.status === 'OPEN' && course.activeEnrollmentCount < course.minimumEnrollment
}

/** Closes the course, keeps its ENROLLED rows as CLOSED, zeroes the count. Returns rows kept. */
export function closeCourse(course: MockCourse): number {
  let closed = 0
  for (const row of mockDb.enrollments) {
    if (row.courseCode === course.courseCode && row.status === 'ENROLLED') {
      row.status = 'CLOSED'
      closed += 1
    }
  }
  course.status = 'CLOSED'
  course.activeEnrollmentCount = 0
  return closed
}

export function sortedCourses(): MockCourse[] {
  return [...mockDb.courses].sort((a, b) => compareCode(a.courseCode, b.courseCode))
}

// ---------------------------------------------------------------- reset

export interface MockUserInput {
  userId: string
  name?: string
  /** Defaults from the id prefix: `P` → PROFESSOR, `A` → ADMIN, otherwise STUDENT. */
  role?: Schemas['UserRole']
  password?: string
}

/** Lenient course seed: only `courseCode` is required. API `Course`-shaped objects also fit. */
export interface MockCourseInput {
  courseCode: string
  name?: string
  category?: Schemas['CourseCategory']
  professorId?: string
  /** Resolves `professorId` by professor name when `professorId` is absent. */
  professorName?: string
  evaluationType?: Schemas['EvaluationType']
  capacity?: number
  minimumEnrollment?: number
  /** Defaults to the course's ENROLLED rows; forced to 0 for CLOSED courses. */
  activeEnrollmentCount?: number
  classroom?: string
  status?: Schemas['CourseStatus']
  remainingSeats?: number
  enrolled?: boolean
}

export interface MockEnrollmentInput {
  studentId: string
  courseCode: string
  enrollmentType?: Schemas['EnrollmentType']
  status?: Schemas['EnrollmentStatus']
  enrolledAt?: string
  assignedBy?: string | null
}

export interface MockResetOptions {
  /** Default 1. Tests pass 0 (contract minimum is 1; test-only deviation, design 1.3 #11). */
  retryAfterSeconds?: number
  /** Default 2. */
  waitingPolls?: number
  /** Replaces the seed. Enrollments default to seeded rows whose user and course still exist. */
  data?: {
    users?: MockUserInput[]
    courses?: MockCourseInput[]
    enrollments?: MockEnrollmentInput[]
  }
}

function replaceAll<T>(target: T[], items: T[]): void {
  target.splice(0, target.length, ...items)
}

/**
 * Restores seed data and clears sessions, tickets, tokens, cookies, call counts and every
 * scenario reservation. Responses still held by `holdNext` become network errors.
 */
export function resetMockDb(options: MockResetOptions = {}): void {
  const users: MockUser[] =
    options.data?.users?.map((input) => ({
      userId: input.userId,
      name: input.name ?? input.userId,
      role:
        input.role ??
        (input.userId.startsWith('P')
          ? 'PROFESSOR'
          : input.userId.startsWith('A')
            ? 'ADMIN'
            : 'STUDENT'),
      password: input.password ?? MOCK_PASSWORD,
    })) ?? seedUsers()
  const userIds = new Set(users.map((user) => user.userId))
  const courseCodes = new Set(
    (options.data?.courses ?? seedCourses()).map((course) => course.courseCode),
  )
  const enrollments = (
    options.data?.enrollments?.map(
      (input): MockEnrollment => ({
        studentId: input.studentId,
        courseCode: input.courseCode,
        enrollmentType: input.enrollmentType ?? 'ADMIN',
        status: input.status ?? 'ENROLLED',
        enrolledAt: input.enrolledAt ?? nowIso(),
        assignedBy:
          input.assignedBy !== undefined
            ? input.assignedBy
            : (input.enrollmentType ?? 'ADMIN') === 'ADMIN'
              ? SEED.admin
              : null,
      }),
    ) ?? seedEnrollments()
  ).filter((row) => userIds.has(row.studentId) && courseCodes.has(row.courseCode))
  const courses: MockCourse[] =
    options.data?.courses?.map((input) => {
      const capacity = input.capacity ?? 30
      const status = input.status ?? 'OPEN'
      const professorId =
        input.professorId ??
        users.find((user) => user.role === 'PROFESSOR' && user.name === input.professorName)
          ?.userId ??
        SEED.professor
      return {
        courseCode: input.courseCode,
        name: input.name ?? `과목 ${input.courseCode}`,
        category: input.category ?? 'MAJOR',
        professorId,
        evaluationType: input.evaluationType ?? 'RELATIVE',
        capacity,
        minimumEnrollment: input.minimumEnrollment ?? Math.min(5, capacity),
        activeEnrollmentCount:
          status === 'CLOSED'
            ? 0
            : (input.activeEnrollmentCount ??
              enrollments.filter(
                (row) => row.courseCode === input.courseCode && row.status === 'ENROLLED',
              ).length),
        classroom: input.classroom ?? '미정',
        status,
      }
    }) ?? seedCourses()

  replaceAll(mockDb.users, users)
  replaceAll(
    mockDb.courses,
    courses.sort((a, b) => compareCode(a.courseCode, b.courseCode)),
  )
  replaceAll(mockDb.enrollments, enrollments)
  replaceAll(mockDb.sessions, [])
  replaceAll(mockDb.tickets, [])
  replaceAll(mockDb.refreshTokens, [])
  replaceAll(mockDb.accessTokens, [])
  Object.assign(mockDb.settings, {
    concurrencyLimit: 100,
    lastChangedBy: null,
    lastChangedAt: null,
  })
  Object.assign(mockDb.cookies, { loginProof: null, refresh: null })
  for (const op of Object.keys(mockDb.calls) as OperationId[]) delete mockDb.calls[op]
  Object.assign(mockDb.config, {
    retryAfterSeconds: options.retryAfterSeconds ?? 1,
    waitingPolls: options.waitingPolls ?? 2,
  })
  mockDb.nextTicketId = 1001

  for (const gate of [...reservations.gates]) gate.settle('aborted')
  replaceAll(reservations.fail, [])
  replaceAll(reservations.hold, [])
  replaceAll(reservations.lose, [])
  replaceAll(reservations.forced, [])
}

resetMockDb()

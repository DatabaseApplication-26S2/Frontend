import { http, HttpResponse, type HttpHandler } from 'msw'
import { API_BASE_URL } from '@/api/baseUrl'
import type { components } from '@/api/schema'
import {
  cookieSession,
  createGate,
  createSession,
  createTicket,
  findUser,
  issueRefresh,
  mockDb,
  reservations,
  revokeSession,
  sessionState,
  startLogin,
  type OperationId,
} from './db'
import { problem, problemResponse } from './problems'
import { MOCK_PASSWORD } from './seed'

type Schemas = components['schemas']

export interface OperationContext {
  request: Request
  url: URL
  params: Record<string, string>
}

/**
 * Registers one contract operation under `${API_BASE_URL}`. Every request is counted in
 * `mockDb.calls`, then the one-shot scenario reservations apply: `failNext` replaces the
 * response without running the handler, `loseNextResponse` runs it but restores the cookie jar
 * and answers with a network error, `holdNext` runs it and delays the response until released.
 */
export function operation(
  op: OperationId,
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  resolve: (context: OperationContext) => Response | Promise<Response>,
): HttpHandler {
  return http[method](`${API_BASE_URL}${path}`, async ({ request, params }) => {
    mockDb.calls[op] = (mockDb.calls[op] ?? 0) + 1
    const failure = takeReservation(reservations.fail, op)
    const hold = takeReservation(reservations.hold, op)

    let response: Response
    if (failure) {
      response =
        failure.failure === 'network' ? HttpResponse.error() : problemResponse(failure.failure)
    } else {
      const loseIndex = reservations.lose.indexOf(op)
      const lose = loseIndex >= 0
      if (lose) reservations.lose.splice(loseIndex, 1)
      const cookiesBefore = { ...mockDb.cookies }
      try {
        response = await resolve({
          request,
          url: new URL(request.url),
          params: Object.fromEntries(
            Object.entries(params).map(([key, value]) => [
              key,
              typeof value === 'string' ? value : (value ?? []).join('/'),
            ]),
          ),
        })
      } catch (error) {
        console.error(`[mock] ${op} handler failed`, error)
        response = problemResponse(problem('INTERNAL_ERROR', 500))
      }
      if (lose) {
        // The server committed, but the browser never saw the response or its Set-Cookie.
        Object.assign(mockDb.cookies, cookiesBefore)
        response = HttpResponse.error()
      }
    }

    if (hold && (await hold.gate.promise) === 'aborted') return HttpResponse.error()
    return response
  })
}

function takeReservation<T extends { op: OperationId }>(
  queue: T[],
  op: OperationId,
): T | undefined {
  const index = queue.findIndex((entry) => entry.op === op)
  return index >= 0 ? queue.splice(index, 1)[0] : undefined
}

function requireUser(userId: string): void {
  if (!findUser(userId)) throw new Error(`[mock] unknown user ${userId}`)
}

const RESULT_CODES_BY_TYPE: Record<Schemas['TicketRequestType'], Schemas['TicketResultCode'][]> = {
  LOGIN: ['OK', 'E01', 'E99'],
  ADMISSION: ['OK', 'E02', 'E99'],
  ENROLLMENT: ['OK', 'E02', 'E04', 'E05', 'E06', 'E07', 'E15', 'E99'],
  CANCELLATION: ['OK', 'E02', 'E04', 'E05', 'E08', 'E15', 'E99'],
}

/**
 * Removes and returns the forced result for a ticket that is being judged, if one matches. A
 * reservation only matches tickets whose type may legally end with that code.
 */
export function takeForcedResult(ticket: {
  requestType: Schemas['TicketRequestType']
  courseCode: string | null
}): Schemas['TicketResultCode'] | undefined {
  const index = reservations.forced.findIndex(
    (forced) =>
      RESULT_CODES_BY_TYPE[ticket.requestType].includes(forced.code) &&
      (forced.requestType === undefined || forced.requestType === ticket.requestType) &&
      (forced.courseCode === undefined || forced.courseCode === ticket.courseCode),
  )
  return index >= 0 ? reservations.forced.splice(index, 1)[0].code : undefined
}

/** Test and console controls (design 3.7). Also exposed as `window.__crsMock.scenario`. */
export const mockScenario = {
  /**
   * Signs `userId` in "in another tab": a new session with a new `sid` whose Refresh replaces the
   * cookie. `admitted` (default true) only matters for students.
   */
  signIn(userId: string, opts: { admitted?: boolean } = {}): { sid: string } {
    requireUser(userId)
    const session = createSession(userId, opts.admitted ?? true)
    mockDb.cookies.refresh = issueRefresh(session.sid)
    return { sid: session.sid }
  },

  /** Unfinished LOGIN ticket owned by the current proof cookie, so the next login is 409 E03. */
  seedPendingLogin(userId: string, password: string = MOCK_PASSWORD): { ticketId: string } {
    return { ticketId: startLogin(userId, password).ticketId }
  },

  /**
   * Unfinished ENROLLMENT·CANCELLATION ticket for `userId`, filed from the current cookie session
   * when it is that user's, else the user's latest active session, else a new admitted session.
   */
  seedPendingRequest(
    userId: string,
    requestType: 'ENROLLMENT' | 'CANCELLATION',
    courseCode: string,
  ): { ticketId: string } {
    requireUser(userId)
    const current = cookieSession()
    const session =
      (current?.userId === userId && sessionState(current) === 'ACTIVE' ? current : undefined) ??
      [...mockDb.sessions]
        .reverse()
        .find((candidate) => candidate.userId === userId && sessionState(candidate) === 'ACTIVE') ??
      createSession(userId, true)
    const ticket = createTicket({ requestType, courseCode, userId, sid: session.sid })
    return { ticketId: ticket.ticketId }
  },

  /** Unfinished ADMISSION ticket from a separate, unadmitted session. The cookie is untouched. */
  seedOtherSessionAdmission(userId: string): { ticketId: string } {
    requireUser(userId)
    const session = createSession(userId, false)
    const ticket = createTicket({
      requestType: 'ADMISSION',
      courseCode: null,
      userId,
      sid: session.sid,
    })
    return { ticketId: ticket.ticketId }
  },

  /**
   * The next ticket judged that matches ends with `code` (once). Non-OK codes change nothing;
   * OK applies the success effect where it is possible.
   */
  forceTicketResult(
    code: Schemas['TicketResultCode'],
    match: { requestType?: Schemas['TicketRequestType']; courseCode?: string } = {},
  ): void {
    reservations.forced.push({ code, ...match })
  },

  /** Expires every Access already issued to the current Refresh cookie's session. */
  expireAccess(): void {
    const session = cookieSession()
    if (!session) return
    for (const record of mockDb.accessTokens) {
      if (record.sid === session.sid) record.expired = true
    }
  },

  /** Revokes the current Refresh cookie's session (as if logged out elsewhere). */
  revokeSession(): void {
    const session = cookieSession()
    if (session) revokeSession(session, 'SCENARIO')
  },

  /** Clears the login proof cookie, so LOGIN polls and the token exchange are rejected. */
  dropLoginProof(): void {
    mockDb.cookies.loginProof = null
  },

  /** Replaces the next response of `op` once, without running its handler. */
  failNext(op: OperationId, failure: 'network' | Schemas['ProblemDetails']): void {
    reservations.fail.push({ op, failure })
  },

  /** Runs the next `op` request normally but holds its response until `release()`. */
  holdNext(op: OperationId): { release(): void } {
    const gate = createGate()
    reservations.hold.push({ op, gate })
    return { release: () => gate.settle('released') }
  },

  /** The next `op` request changes server state, but the response and its cookies are lost. */
  loseNextResponse(op: OperationId): void {
    reservations.lose.push(op)
  },
}

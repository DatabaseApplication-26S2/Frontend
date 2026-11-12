import { HttpResponse, type HttpHandler } from 'msw'
import type { components } from '@/api/schema'
import {
  apiPath,
  findRefresh,
  findSession,
  findTicket,
  findUser,
  isTerminal,
  issueRefresh,
  mockDb,
  proofTicket,
  receiptHeaders,
  revokeSession,
  sessionState,
  startLogin,
} from '../db'
import { authenticate, tokenResponse } from '../jwt'
import {
  bodylessViolations,
  checkMember,
  invalidInput,
  jsonResponse,
  pathViolations,
  problem,
  problemResponse,
  queryViolations,
  readJsonObject,
  TICKET_ID_PATTERN,
  unknownMemberViolations,
} from '../problems'
import { operation } from '../scenario'

type Schemas = components['schemas']

/**
 * Cookie operations require `X-CSRF-Protection: 1`. `Origin` is a forbidden browser header the
 * client cannot set, so the mock does not check it (design 3.7).
 */
function csrfRejection(request: Request): Response | null {
  return request.headers.get('X-CSRF-Protection') === '1'
    ? null
    : problemResponse(problem('E02', 403, { reason: 'CSRF_CHECK_FAILED' }))
}

export const authHandlers: HttpHandler[] = [
  // CSRF(403) → body(400 E09) → unfinished LOGIN in this anonymous context(409 E03) → 202.
  operation('login', 'post', '/auth/login', async ({ request, url }) => {
    const csrf = csrfRejection(request)
    if (csrf) return csrf
    const parsed = await readJsonObject(request)
    if (!parsed.ok) return invalidInput(parsed.violations)
    const { body } = parsed
    const violations = [
      ...queryViolations(url, []),
      ...unknownMemberViolations(body, ['userId', 'password']),
    ]
    const isNonEmpty = (value: unknown) => typeof value === 'string' && value.length > 0
    checkMember(body, 'userId', isNonEmpty, '비어 있지 않은 문자열이어야 합니다.', violations)
    checkMember(body, 'password', isNonEmpty, '비어 있지 않은 문자열이어야 합니다.', violations)
    if (violations.length > 0) return invalidInput(violations)

    const pending = proofTicket()
    if (pending && !isTerminal(pending.status)) {
      return problemResponse(
        problem('E03', 409, {
          detail: '처리 중인 로그인 요청이 있습니다. 기존 요청의 결과를 확인하십시오.',
          activeTicketId: pending.ticketId,
        }),
      )
    }

    const ticket = startLogin(String(body.userId), String(body.password))
    return jsonResponse(
      {
        ticketId: ticket.ticketId,
        requestType: 'LOGIN',
        status: 'WAITING',
        submittedAt: ticket.submittedAt,
        statusUrl: apiPath(`/tickets/${ticket.ticketId}`),
        credentialExpiresAt: ticket.credentialExpiresAt,
        proofExpiresAt: ticket.proofExpiresAt,
      } satisfies Schemas['LoginTicketReceipt'],
      202,
      receiptHeaders(ticket),
    )
  }),

  // CSRF → E09 → proof(403) → unfinished(409 E03) → REJECTED(401 E01) → consumed(403)
  // → session revoked/expired(401) → first tokens + Refresh cookie(200).
  operation(
    'exchangeLoginTokens',
    'post',
    '/auth/login-tickets/:ticketId/tokens',
    async ({ request, url, params }) => {
      const csrf = csrfRejection(request)
      if (csrf) return csrf
      const violations = await bodylessViolations(
        request,
        url,
        pathViolations(
          'ticketId',
          params.ticketId,
          TICKET_ID_PATTERN,
          '양의 10진수 문자열이어야 합니다.',
        ),
      )
      if (violations.length > 0) return invalidInput(violations)

      const ticket = findTicket(params.ticketId)
      const proof = mockDb.cookies.loginProof
      if (
        !ticket ||
        ticket.requestType !== 'LOGIN' ||
        proof === null ||
        ticket.loginProof !== proof
      ) {
        return problemResponse(problem('E02', 403, { reason: 'LOGIN_PROOF_INVALID' }))
      }
      if (ticket.proofExpiresAt === null || Date.parse(ticket.proofExpiresAt) <= Date.now()) {
        return problemResponse(problem('E02', 403, { reason: 'LOGIN_PROOF_EXPIRED' }))
      }
      if (!isTerminal(ticket.status)) {
        return problemResponse(
          problem('E03', 409, {
            detail: '로그인 요청이 아직 처리 중입니다. 결과를 확인한 뒤 다시 시도하십시오.',
            activeTicketId: ticket.ticketId,
          }),
        )
      }
      if (ticket.status === 'REJECTED') return problemResponse(problem('E01', 401))
      if (ticket.exchanged) {
        return problemResponse(problem('E02', 403, { reason: 'LOGIN_EXCHANGE_CONSUMED' }))
      }
      const session = ticket.loginSid === null ? undefined : findSession(ticket.loginSid)
      const user = session && findUser(session.userId)
      if (!session || !user) {
        return problemResponse(problem('E02', 401, { reason: 'SESSION_REVOKED' }))
      }
      const state = sessionState(session)
      if (state !== 'ACTIVE') return problemResponse(problem('E02', 401, { reason: state }))

      ticket.exchanged = true
      mockDb.cookies.refresh = issueRefresh(session.sid)
      return jsonResponse(tokenResponse(session, user), 200)
    },
  ),

  // CSRF → E09 → unknown cookie(401, no change) → revoked/expired(401) → consumed = reuse
  // (revoke that session, 401) → rotate(200). Every 401 clears the Refresh cookie.
  operation('refreshTokens', 'post', '/auth/refresh', async ({ request, url }) => {
    const csrf = csrfRejection(request)
    if (csrf) return csrf
    const violations = await bodylessViolations(request, url)
    if (violations.length > 0) return invalidInput(violations)

    const reject = (reason: Schemas['AuthFailureReason']) => {
      mockDb.cookies.refresh = null
      return problemResponse(problem('E02', 401, { reason }))
    }
    const record = findRefresh(mockDb.cookies.refresh)
    const session = record && findSession(record.sid)
    const user = session && findUser(session.userId)
    if (!record || !session || !user) return reject('REFRESH_TOKEN_INVALID')
    const state = sessionState(session)
    if (state !== 'ACTIVE') return reject(state)
    if (record.consumed) {
      revokeSession(session, 'REFRESH_REUSE')
      return reject('REFRESH_TOKEN_REUSED')
    }

    record.consumed = true
    mockDb.cookies.refresh = issueRefresh(session.sid)
    return jsonResponse(tokenResponse(session, user), 200)
  }),

  // CSRF → E09 → revoke the session the Refresh cookie proves (consumed or not), or without a
  // cookie the valid Access's session → always 204 and clear both cookies.
  operation('logout', 'post', '/auth/logout', async ({ request, url }) => {
    const csrf = csrfRejection(request)
    if (csrf) return csrf
    const violations = await bodylessViolations(request, url)
    if (violations.length > 0) return invalidInput(violations)

    if (mockDb.cookies.refresh !== null) {
      const record = findRefresh(mockDb.cookies.refresh)
      const session = record && findSession(record.sid)
      if (session && sessionState(session) === 'ACTIVE') revokeSession(session, 'LOGOUT')
    } else if (request.headers.has('Authorization')) {
      const auth = authenticate(request)
      if (auth.ok) revokeSession(auth.session, 'LOGOUT')
    }
    mockDb.cookies.refresh = null
    mockDb.cookies.loginProof = null
    return new HttpResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  }),
]

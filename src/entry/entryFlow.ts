import { useMemo, useSyncExternalStore } from 'react'
import { ApiError, api, COOKIE_OP_HEADERS, StaleAuthError, unwrap, unwrapResponse } from '@/api/client'
import {
  ACTIVE_TICKET_RETRY_MESSAGE,
  EXCHANGE_CONSUMED_MESSAGE,
  FALLBACK_MESSAGE,
  LOGIN_TICKET_FORBIDDEN_MESSAGE,
  REFRESH_UNCERTAIN_MESSAGE,
  SESSION_ENDED_MESSAGE,
  TICKET_FORBIDDEN_MESSAGE,
  formErrorsFrom,
  problemMessage,
  ticketResultMessage,
} from '@/api/messages'
import type { LoginRequest, TicketStatus, TokenResponse } from '@/api/types'
import { clearRefreshUncertain, refreshAccess } from '@/auth/refresh'
import { clearAuthNotice, establishSession, getAuth, setAdmittedAt, useAuth } from '@/auth/session'
import { currentGeneration, onSessionCleared } from '@/auth/tokenStore'
import { queueStatusText, type QueueContext } from '@/queue/statusText'
import { pollDelayMs, pollTicket } from '@/queue/ticketPoller'
import { clearTicketRecord, saveTicketRecord } from '@/queue/ticketRecord'

// 진입 흐름(계획 4.1): 로그인 접수 → 로그인 티켓 폴링 → 토큰 수령(티켓당 1회) → (학생) 입장 반복.
// 컴포넌트 수명과 분리된 모듈 상태다. 이동은 가드(LoginRoute)가 하며 이 모듈은 navigate를 부르지 않는다.

export interface EntryView {
  busy: boolean // true면 폼 비활성
  statusText: string | null // 진행 문구. 접수·토큰 수령·입장 요청 중은 '처리 중'
  errorText: string | null // role="alert"로 보일 문구
  noticeText: string | null // 안내(세션 종료, 갱신 불확실, E03 재시도 안내)
  fieldErrors: Partial<Record<'userId' | 'password', string>>
  admissionStalled: boolean // 인증됐지만 입장 반복이 멈춘 학생
}

type AdmissionPhase = 'idle' | 'running' | 'stalled' | 'done'

interface EntryState extends Omit<EntryView, 'admissionStalled'> {
  admission: AdmissionPhase
}

const PROCESSING = '처리 중'
const LOGIN_FAILED_MESSAGE = '로그인에 실패했습니다. 다시 로그인하세요'

const IDLE: EntryState = {
  busy: false,
  statusText: null,
  errorText: null,
  noticeText: null,
  fieldErrors: {},
  admission: 'idle',
}

let state: EntryState = IDLE
// 세션 정리·테스트 초기화 때 올린다. 진행 중인 비동기 흐름은 자기 run이 다르면 아무것도 바꾸지 않는다.
let run = 0
const listeners = new Set<() => void>()
// 토큰 수령은 티켓 번호별 모듈 Promise 하나로 한 번만 보낸다(계획 3절 4번, StrictMode 대비).
const exchanges = new Map<string, Promise<ExchangeOutcome>>()

type ExchangeOutcome = { kind: 'established' } | { kind: 'failed'; message: string } | { kind: 'stale' }

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getState(): EntryState {
  return state
}

function setState(next: EntryState): void {
  state = next
  for (const listener of listeners) listener()
}

/** myRun이 현재 run일 때만 상태를 바꾼다. */
function update(myRun: number, patch: Partial<EntryState>): void {
  if (myRun === run) setState({ ...state, ...patch })
}

function fail(myRun: number, message: string): void {
  update(myRun, { busy: false, statusText: null, errorText: message })
}

// 로그아웃·세션 종료·사용자 전환: 진행 중인 흐름을 버리고 처음 상태로 돌아간다.
onSessionCleared(() => {
  run += 1
  setState(IDLE)
})

// ── 로그인 ──────────────────────────────────────────────────────────────

export function submitLogin(credentials: LoginRequest): void {
  if (state.busy) return
  clearAuthNotice()
  const myRun = run
  update(myRun, { busy: true, statusText: PROCESSING, errorText: null, noticeText: null, fieldErrors: {} })
  void loginSequence(credentials, myRun)
}

/** 부트스트랩이 익명 + LOGIN 기록일 때 부른다(새로고침 복구). */
export function resumeLoginTicket(ticketId: string): void {
  if (state.busy) return
  const myRun = run
  update(myRun, {
    busy: true,
    statusText: queueStatusText('login', 'RECEIVED', null),
    errorText: null,
    fieldErrors: {},
  })
  void followLoginTicket(ticketId, 'login', 0, myRun)
}

async function loginSequence(credentials: LoginRequest, myRun: number): Promise<void> {
  let ticketId: string
  let receiptStatus: TicketStatus
  let initialDelayMs: number
  try {
    const { data, response } = await unwrapResponse(
      api.POST('/auth/login', { params: { header: COOKIE_OP_HEADERS }, body: credentials }),
    )
    ticketId = data.ticketId
    receiptStatus = data.status
    initialDelayMs = pollDelayMs(response.headers.get('Retry-After'))
  } catch (error) {
    if (myRun !== run || error instanceof StaleAuthError) return
    if (error instanceof ApiError && error.code === 'E03') {
      const activeTicketId = error.problem?.activeTicketId
      if (activeTicketId) {
        // 이 익명 컨텍스트의 미완료 LOGIN 티켓을 이어받는다(계획 4.4).
        saveTicketRecord({ ticketId: activeTicketId, requestType: 'LOGIN', courseCode: null })
        await followLoginTicket(activeTicketId, 'adopted', 0, myRun)
      } else {
        update(myRun, { busy: false, statusText: null, noticeText: ACTIVE_TICKET_RETRY_MESSAGE })
      }
      return
    }
    if (error instanceof ApiError && error.code === 'E09') {
      const { fields, form } = formErrorsFrom(error)
      const { userId, password, ...rest } = fields
      const fieldErrors: EntryState['fieldErrors'] = {}
      if (userId) fieldErrors.userId = userId
      if (password) fieldErrors.password = password
      const others = [form, ...Object.values(rest)].filter((m): m is string => Boolean(m))
      update(myRun, {
        busy: false,
        statusText: null,
        fieldErrors,
        errorText: others.length > 0 ? others.join('\n') : null,
      })
      return
    }
    fail(myRun, problemMessage(error) ?? LOGIN_FAILED_MESSAGE)
    return
  }
  if (myRun !== run) return
  saveTicketRecord({ ticketId, requestType: 'LOGIN', courseCode: null })
  await followLoginTicket(ticketId, 'login', initialDelayMs, myRun, receiptStatus)
}

async function followLoginTicket(
  ticketId: string,
  ctx: QueueContext,
  initialDelayMs: number,
  myRun: number,
  receiptStatus: TicketStatus = 'RECEIVED',
): Promise<void> {
  update(myRun, { statusText: queueStatusText(ctx, receiptStatus, null) })
  const result = await pollTicket(ticketId, {
    initialDelayMs,
    onUpdate: (ticket) =>
      update(myRun, { statusText: queueStatusText(ctx, ticket.status, ticket.queuePosition) }),
  })
  if (myRun !== run) return
  if (result.kind === 'stopped') {
    update(myRun, { busy: false, statusText: null })
    return
  }
  if (result.kind === 'denied') {
    // 403·400 또는 갱신 뒤 재조회 실패: 폴링 중단, 기록 삭제, 폼으로(계획 4.3).
    // 403·400은 4.3 문구, 그 밖(500·연결 실패)은 그 오류의 문구다.
    clearTicketRecord(ticketId)
    fail(myRun, problemMessage(result.error, 'login-ticket') ?? LOGIN_TICKET_FORBIDDEN_MESSAGE)
    return
  }
  const code = result.ticket.result?.code ?? 'E99'
  if (result.ticket.status !== 'SUCCEEDED' || code !== 'OK') {
    clearTicketRecord(ticketId)
    fail(myRun, ticketResultMessage('LOGIN', code) ?? LOGIN_FAILED_MESSAGE)
    return
  }
  update(myRun, { statusText: PROCESSING })
  const outcome = await exchangeOnce(ticketId)
  if (myRun !== run) return
  clearTicketRecord(ticketId)
  if (outcome.kind === 'stale') return
  if (outcome.kind === 'failed') {
    fail(myRun, outcome.message)
    return
  }
  if (needsAdmission()) {
    startAdmission(myRun) // 학생: 입장 반복(가드 효과가 먼저 시작했으면 아무것도 하지 않는다)
    return
  }
  update(myRun, { busy: false, statusText: null })
}

function exchangeOnce(ticketId: string): Promise<ExchangeOutcome> {
  let pending = exchanges.get(ticketId)
  if (!pending) {
    pending = exchangeTokens(ticketId)
    exchanges.set(ticketId, pending)
  }
  return pending
}

async function exchangeTokens(ticketId: string): Promise<ExchangeOutcome> {
  const generation = currentGeneration()
  let token: TokenResponse
  try {
    token = await unwrap(
      api.POST('/auth/login-tickets/{ticketId}/tokens', {
        params: { path: { ticketId }, header: COOKIE_OP_HEADERS },
      }),
    )
  } catch (error) {
    if (error instanceof StaleAuthError || currentGeneration() !== generation) return { kind: 'stale' }
    if (error instanceof ApiError && error.reason === 'LOGIN_EXCHANGE_CONSUMED') {
      // 이미 소비된 교환: 공유 갱신 경로를 1회 시도한다(계획 5.6). 실패하면 폼으로.
      const result = await refreshAccess()
      if (result.kind === 'stale') return { kind: 'stale' }
      if (result.kind === 'established' || result.kind === 'refreshed' || result.kind === 'switched') {
        return { kind: 'established' }
      }
      return { kind: 'failed', message: EXCHANGE_CONSUMED_MESSAGE }
    }
    return { kind: 'failed', message: problemMessage(error, 'exchange') ?? LOGIN_FAILED_MESSAGE }
  }
  if (currentGeneration() !== generation) return { kind: 'stale' }
  clearRefreshUncertain()
  establishSession(token)
  return { kind: 'established' }
}

// ── 입장 반복 ────────────────────────────────────────────────────────────

function isStudentSession(): boolean {
  const auth = getAuth()
  return auth.status === 'authenticated' && auth.user?.role === 'STUDENT'
}

function needsAdmission(): boolean {
  return isStudentSession() && !getAuth().session?.admittedAt
}

/** 여러 번 불러도 반복은 하나다. 멈춘(stalled) 반복은 자동으로 다시 시작하지 않는다(retryAdmission). */
export function ensureAdmission(): void {
  if (!needsAdmission() || state.admission === 'stalled') return
  startAdmission(run)
}

/**
 * 멈춘 반복을 다시 시작한다. 반복이 멈춘 동안 갱신 응답이 admittedAt을 가져왔어도 현재 세션의
 * POST /admission 200을 받기 전이므로 다시 시작할 수 있다(계획 4.1 6번).
 */
export function retryAdmission(): void {
  if (!isStudentSession()) return
  if (state.admission !== 'stalled' && !needsAdmission()) return
  startAdmission(run)
}

/** 이미 반복 중이면 아무것도 하지 않는다(가드 효과와 로그인 흐름이 같은 틱에 부를 수 있다). */
function startAdmission(myRun: number): void {
  if (myRun !== run || state.admission === 'running') return
  update(myRun, {
    admission: 'running',
    busy: true,
    statusText: PROCESSING,
    errorText: null,
    noticeText: null,
    fieldErrors: {},
  })
  void admissionLoop(myRun)
}

function stall(myRun: number, message: string): void {
  update(myRun, { admission: 'stalled', busy: false, statusText: null, errorText: message })
}

type AdmissionAttempt =
  | { kind: 'admitted'; admittedAt: string }
  | { kind: 'queued'; ticketId: string; status: TicketStatus; delayMs: number }
  | { kind: 'error'; error: unknown }

async function requestAdmission(): Promise<AdmissionAttempt> {
  try {
    const { data, response } = await unwrapResponse(api.POST('/admission'))
    if ('admittedAt' in data) return { kind: 'admitted', admittedAt: data.admittedAt }
    return {
      kind: 'queued',
      ticketId: data.ticketId,
      status: data.status,
      delayMs: pollDelayMs(response.headers.get('Retry-After')),
    }
  } catch (error) {
    return { kind: 'error', error }
  }
}

/** 현재 세션의 POST /admission이 200을 줄 때까지 반복한다. 이어받은 티켓의 OK는 완료가 아니다(계획 4.1 5~6번). */
async function admissionLoop(myRun: number): Promise<void> {
  const generation = currentGeneration()
  const alive = () => myRun === run && currentGeneration() === generation
  for (;;) {
    if (!alive()) return
    update(myRun, { statusText: PROCESSING })
    const attempt = await requestAdmission()
    if (!alive()) return

    if (attempt.kind === 'admitted') {
      setAdmittedAt(attempt.admittedAt)
      update(myRun, { admission: 'done', busy: false, statusText: null, errorText: null })
      return
    }

    if (attempt.kind === 'error') {
      const { error } = attempt
      if (error instanceof StaleAuthError) return
      if (!(error instanceof ApiError) || error.code !== 'E03') {
        stall(myRun, problemMessage(error) ?? FALLBACK_MESSAGE)
        return
      }
      // 409 E03: 사용자의 미완료 티켓(다른 세션의 것일 수 있음)을 종결까지 이어받은 뒤 다시 부른다.
      const activeTicketId = error.problem?.activeTicketId
      if (!activeTicketId) {
        stall(myRun, ACTIVE_TICKET_RETRY_MESSAGE)
        return
      }
      update(myRun, { statusText: queueStatusText('adopted', 'RECEIVED', null) })
      const adopted = await pollTicket(activeTicketId, {
        onUpdate: (ticket) =>
          update(myRun, {
            statusText: queueStatusText('adopted', ticket.status, ticket.queuePosition),
          }),
      })
      if (!alive() || adopted.kind === 'stopped') return
      if (adopted.kind === 'denied') {
        stall(myRun, problemMessage(adopted.error, 'ticket') ?? TICKET_FORBIDDEN_MESSAGE)
        return
      }
      continue // 이어받은 티켓의 결과와 무관하게 POST /admission을 다시 부른다
    }

    // 202: 이 반복이 낸 입장 티켓을 종결까지 폴링한 뒤 다시 부른다.
    const { ticketId } = attempt
    saveTicketRecord({ ticketId, requestType: 'ADMISSION', courseCode: null })
    update(myRun, { statusText: queueStatusText('admission', attempt.status, null) })
    const polled = await pollTicket(ticketId, {
      initialDelayMs: attempt.delayMs,
      onUpdate: (ticket) =>
        update(myRun, {
          statusText: queueStatusText('admission', ticket.status, ticket.queuePosition),
        }),
    })
    if (!alive() || polled.kind === 'stopped') return
    clearTicketRecord(ticketId)
    if (polled.kind === 'denied') {
      stall(myRun, problemMessage(polled.error, 'ticket') ?? TICKET_FORBIDDEN_MESSAGE)
      return
    }
    const code = polled.ticket.result?.code ?? 'E99'
    if (code !== 'OK') {
      // 이 반복이 낸 입장 티켓의 E02·E99 거절은 반복을 멈춘다.
      stall(myRun, ticketResultMessage('ADMISSION', code) ?? FALLBACK_MESSAGE)
      return
    }
  }
}

// ── 화면 훅 ──────────────────────────────────────────────────────────────

export function useEntryFlow(): EntryView {
  const entry = useSyncExternalStore(subscribe, getState, getState)
  const auth = useAuth()
  return useMemo(() => {
    const authNotice =
      auth.notice === 'SESSION_ENDED'
        ? SESSION_ENDED_MESSAGE
        : auth.notice === 'REFRESH_UNCERTAIN'
          ? REFRESH_UNCERTAIN_MESSAGE
          : null
    return {
      busy: entry.busy,
      statusText: entry.statusText,
      errorText: entry.errorText,
      noticeText: entry.noticeText ?? authNotice,
      fieldErrors: entry.fieldErrors,
      // 멈춘 반복은 현재 세션의 POST /admission 200 전까지 남는다(갱신이 admittedAt을 가져와도).
      admissionStalled:
        entry.admission === 'stalled' &&
        auth.status === 'authenticated' &&
        auth.user?.role === 'STUDENT',
    }
  }, [entry, auth])
}

function isAdmissionUnresolved(): boolean {
  return state.admission === 'running' || state.admission === 'stalled'
}

/**
 * 입장 반복이 시작된 뒤 아직 현재 세션의 POST /admission 200을 받지 못했는지(진행 중이거나 멈춤).
 * 가드는 이 동안 학생을 /login에 둔다. 갱신 응답이 admittedAt을 가져와도 마찬가지다(계획 4.1 6번).
 * 200을 받거나 세션 정리(로그아웃·사용자 전환·세션 종료)로만 풀린다.
 */
export function useAdmissionInProgress(): boolean {
  return useSyncExternalStore(subscribe, isAdmissionUnresolved, isAdmissionUnresolved)
}

export function resetEntryFlowForTests(): void {
  run += 1
  exchanges.clear()
  setState(IDLE)
}

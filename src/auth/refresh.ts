import { api, COOKIE_OP_HEADERS } from '@/api/client'
import type { TokenResponse } from '@/api/types'
import { ensureAdmission, resumeLoginTicket } from '@/entry/entryFlow'
import { resumeRequestTicket } from '@/enrollments/requestFlow'
import { clearTicketRecord, readTicketRecord } from '@/queue/ticketRecord'
import {
  applyRefreshedToken,
  endSession,
  establishSession,
  getAuth,
  settleAnonymous,
  switchSession,
} from './session'
import {
  currentGeneration,
  decodeClaims,
  getAccessToken,
  getTokenClaims,
  sameIdentity,
  type TokenClaims,
} from './tokenStore'

// 단일 갱신과 부트스트랩(계획 3절 2·3·6번, 설계 3.3절 5·9번).

/** 갱신 불확실 표시. localStorage에 시각만 둔다(토큰 아님, D-12). */
export const REFRESH_UNCERTAIN_KEY = 'crs.refreshUncertainAt'
const REFRESH_LOCK = 'crs.auth.refresh'

export type RefreshResult =
  | { kind: 'refreshed'; claims: TokenClaims | null } // 같은 sub·sid. 세대 불변
  | { kind: 'switched' } // 다른 sub·sid. 사용자 전환으로 정리하고 새 세션 수립
  | { kind: 'established' } // 익명에서 세션 수립(부트스트랩 등)
  | { kind: 'rejected' } // 갱신 실패(401 등). 세션 종료 또는 익명 유지
  | { kind: 'uncertain' } // 표시가 있어 보내지 않았거나 네트워크 오류
  | { kind: 'stale' } // 응답 전에 인증 세대가 바뀜. 아무것도 바꾸지 않음

type LockedOutcome =
  | { type: 'ok'; token: TokenResponse }
  | { type: 'failed' }
  | { type: 'uncertain' }
  | { type: 'stale' }

// 진행 중인 갱신과 그 갱신을 시작한 인증 세대. 다른 세대의 갱신 결과는 공유하지 않는다.
let inflight: { generation: number; promise: Promise<RefreshResult> } | null = null
let bootstrapPromise: Promise<void> | null = null
let bootstrapRun = 0

function hasUncertainMarker(): boolean {
  try {
    return localStorage.getItem(REFRESH_UNCERTAIN_KEY) !== null
  } catch {
    return false
  }
}

function writeUncertainMarker(): void {
  try {
    localStorage.setItem(REFRESH_UNCERTAIN_KEY, new Date().toISOString())
  } catch {
    // 저장소를 쓸 수 없으면 이 탭의 notice만 남는다.
  }
}

/** 다음 토큰 수령 성공 때 부른다. */
export function clearRefreshUncertain(): void {
  try {
    localStorage.removeItem(REFRESH_UNCERTAIN_KEY)
  } catch {
    // 무시
  }
}

/** 탭 사이 직렬화. navigator.locks가 없으면(jsdom) 탭 안의 단일 실행만 보장한다. */
async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
  if (locks && typeof locks.request === 'function') return await locks.request(REFRESH_LOCK, fn)
  return await fn()
}

/** generation: 갱신을 요청한 인증 세대. 시작·전송·결과 적용 때마다 같은지 확인한다. */
async function runRefresh(generation: number): Promise<RefreshResult> {
  if (currentGeneration() !== generation) return { kind: 'stale' }
  const hadSession = getAccessToken() !== null
  const startClaims = getTokenClaims()

  const outcome = await withRefreshLock(async (): Promise<LockedOutcome> => {
    // 잠금을 기다리는 동안 로그아웃·새 로그인 등으로 세대가 바뀌었으면 보내지 않는다.
    if (currentGeneration() !== generation) return { type: 'stale' }
    // 잠금 안에서 표시를 확인한다. 다른 탭이 남긴 표시면 보내지 않는다.
    if (hasUncertainMarker()) return { type: 'uncertain' }
    try {
      const { data, response } = await api.POST('/auth/refresh', {
        params: { header: COOKIE_OP_HEADERS },
      })
      return response.ok && data ? { type: 'ok', token: data } : { type: 'failed' }
    } catch {
      // 낡은 갱신이면 새 세션의 자동 갱신을 막지 않도록 표시를 남기지 않는다.
      if (currentGeneration() !== generation) return { type: 'stale' }
      // 서버가 Refresh를 소비했는지 알 수 없다. 잠금을 풀기 전에 표시를 남기고 다시 보내지 않는다.
      writeUncertainMarker()
      return { type: 'uncertain' }
    }
  })

  // 낡은 결과는 토큰·상태·캐시를 바꾸지 않는다.
  if (outcome.type === 'stale' || currentGeneration() !== generation) return { kind: 'stale' }

  if (outcome.type === 'uncertain') {
    if (hadSession) endSession('REFRESH_UNCERTAIN')
    else settleAnonymous('REFRESH_UNCERTAIN')
    return { kind: 'uncertain' }
  }
  if (outcome.type === 'failed') {
    if (hadSession) endSession('SESSION_ENDED')
    else settleAnonymous(null)
    return { kind: 'rejected' }
  }

  if (!hadSession) {
    establishSession(outcome.token)
    return { kind: 'established' }
  }
  const nextClaims = decodeClaims(outcome.token.accessToken)
  if (sameIdentity(startClaims, nextClaims)) {
    applyRefreshedToken(outcome.token)
    return { kind: 'refreshed', claims: nextClaims }
  }
  switchSession(outcome.token)
  return { kind: 'switched' }
}

/**
 * 탭 안의 갱신은 같은 세대에서 공유 Promise 하나로 묶는다. 결과에 따른 상태 정리는 runRefresh가 한 번만 한다.
 * 이전 세대의 갱신이 아직 끝나지 않았으면 그 결과(낡음)를 나누지 않고, 그것이 끝난 뒤 새로 시작한다(탭 안 직렬화).
 */
export function refreshAccess(): Promise<RefreshResult> {
  const generation = currentGeneration()
  if (inflight !== null && inflight.generation === generation) return inflight.promise
  const previous = inflight?.promise
  const start = previous
    ? previous.then(
        () => runRefresh(generation),
        () => runRefresh(generation),
      )
    : runRefresh(generation)
  const promise = start.finally(() => {
    if (inflight?.promise === promise) inflight = null
  })
  inflight = { generation, promise }
  return promise
}

async function runBootstrap(run: number): Promise<void> {
  try {
    await refreshAccess()
  } catch {
    // 갱신 경로의 예외(예: 잠금 API 거부)로 로딩 화면에 멈추지 않게 익명으로 정한다.
    if (run === bootstrapRun && getAuth().status === 'bootstrapping') settleAnonymous(null)
  }
  if (run !== bootstrapRun) return

  // 결과가 정해진 뒤 D-12 기록을 복구한다(계획 4.5). 미입장 학생이면 입장 반복을 시작한다.
  ensureAdmission()
  const auth = getAuth()
  const record = readTicketRecord()
  if (!record) return
  if (auth.status === 'anonymous' && record.requestType === 'LOGIN') {
    resumeLoginTicket(record.ticketId)
  } else if (
    auth.status === 'authenticated' &&
    (record.requestType === 'ENROLLMENT' || record.requestType === 'CANCELLATION')
  ) {
    resumeRequestTicket(record)
  } else {
    clearTicketRecord()
  }
}

/** 앱 시작 시 갱신 1회. 모듈 수준 Promise 하나라 여러 번(StrictMode 이중 효과 포함) 불러도 요청은 1회다. */
export function bootstrapAuth(): Promise<void> {
  if (bootstrapPromise === null) bootstrapPromise = runBootstrap(bootstrapRun)
  return bootstrapPromise
}

export function resetRefreshForTests(): void {
  inflight = null
  bootstrapPromise = null
  bootstrapRun += 1
}

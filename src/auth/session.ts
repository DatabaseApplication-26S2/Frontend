import { useSyncExternalStore } from 'react'
import { api, COOKIE_OP_HEADERS } from '@/api/client'
import type { AuthenticatedUser, SessionState, TokenResponse } from '@/api/types'
import { queryClient } from '@/app/queryClient'
import { clearTicketRecord } from '@/queue/ticketRecord'
import {
  bumpGeneration,
  clearAccessToken,
  getAccessToken,
  notifySessionCleared,
  setAccessToken,
} from './tokenStore'

export type AuthStatus = 'bootstrapping' | 'anonymous' | 'authenticated'
export type AuthNotice = 'SESSION_ENDED' | 'REFRESH_UNCERTAIN'

export interface AuthSnapshot {
  status: AuthStatus
  user: AuthenticatedUser | null
  session: SessionState | null // admittedAt는 POST /admission 200과 갱신 응답으로 갱신
  notice: AuthNotice | null
}

const INITIAL: AuthSnapshot = { status: 'bootstrapping', user: null, session: null, notice: null }

let snapshot: AuthSnapshot = INITIAL
// 세션 수립·사용자 전환마다 올린다. RequireAuth가 이 값으로 화면을 다시 마운트해 새 사용자로 재구성한다.
let sessionSerial = 0
// 마지막 익명 전환이 명시적 로그아웃이었는지(useLoggedOut). 다음 세션 수립·세션 종료·익명 확정 때 다시 정한다.
let loggedOut = false
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function publish(next: AuthSnapshot): void {
  snapshot = next
  for (const listener of listeners) listener()
}

/** 토큰은 스냅샷에 없다. */
export function useAuth(): AuthSnapshot {
  return useSyncExternalStore(subscribe, getAuth, getAuth)
}

export function getAuth(): AuthSnapshot {
  return snapshot
}

function getSessionSerial(): number {
  return sessionSerial
}

export function useSessionSerial(): number {
  return useSyncExternalStore(subscribe, getSessionSerial, getSessionSerial)
}

/** 익명에서 세션을 세운다(토큰 수령, 부트스트랩 갱신). 인증 세대를 올리고 캐시를 비운다. */
export function establishSession(token: TokenResponse): void {
  bumpGeneration()
  setAccessToken(token.accessToken)
  queryClient.clear()
  sessionSerial += 1
  loggedOut = false
  publish({ status: 'authenticated', user: token.user, session: token.session, notice: null })
}

/** 갱신으로 받은 Access의 sub·sid가 다름: 사용자 전환. 이전 세션의 흔적을 지우고 새 세션을 세운다. */
export function switchSession(token: TokenResponse): void {
  clearTicketRecord()
  notifySessionCleared()
  establishSession(token)
}

/** 같은 sub·sid의 갱신 성공. 세대는 그대로 두고 토큰과 서버 상태(admittedAt 등)만 바꾼다. */
export function applyRefreshedToken(token: TokenResponse): void {
  setAccessToken(token.accessToken)
  publish({ ...snapshot, user: token.user, session: token.session })
}

/** 세션 정리 공통부. byLogout은 publish 전에 기록해 가드가 같은 렌더에서 읽는다. */
function clearSession(notice: AuthNotice | null, byLogout: boolean): void {
  bumpGeneration()
  clearAccessToken()
  queryClient.clear()
  clearTicketRecord()
  notifySessionCleared()
  loggedOut = byLogout
  publish({ status: 'anonymous', user: null, session: null, notice })
}

/** 세션 종료(계획 3절 4·8번): 토큰·캐시·티켓 기록 삭제, 세대 +1, anonymous. */
export function endSession(notice: AuthNotice | null): void {
  clearSession(notice, false)
}

/** 세션이 없던 상태의 결과(부트스트랩 401·불확실 표시). 티켓 기록은 복구를 위해 남긴다. */
export function settleAnonymous(notice: AuthNotice | null): void {
  loggedOut = false
  publish({ status: 'anonymous', user: null, session: null, notice })
}

function getLoggedOut(): boolean {
  return loggedOut
}

/**
 * 마지막으로 익명이 된 까닭이 명시적 로그아웃이면 true(다음 세션 수립까지). 가드는 이때 이전 사용자의 경로
 * (`state.from`)를 /login에 넘기지 않는다. 세션 종료·갱신 불확실·부트스트랩 401은 false라 경로를 유지한다.
 */
export function useLoggedOut(): boolean {
  return useSyncExternalStore(subscribe, getLoggedOut, getLoggedOut)
}

export function clearAuthNotice(): void {
  if (snapshot.notice !== null) publish({ ...snapshot, notice: null })
}

/** 409 E15: 현재 세션이 입장하지 않은 상태로 본다. AdmissionGate가 입장 흐름으로 보낸다. */
export function markAdmissionRequired(): void {
  const { session } = snapshot
  if (snapshot.status !== 'authenticated' || !session || session.admittedAt === null) return
  publish({ ...snapshot, session: { ...session, admittedAt: null } })
}

/** POST /admission 200. */
export function setAdmittedAt(admittedAt: string): void {
  const { session } = snapshot
  if (snapshot.status !== 'authenticated' || !session) return
  publish({ ...snapshot, session: { ...session, admittedAt } })
}

/**
 * 로그아웃(계획 3절 8번). 지우기 전의 Bearer와 CSRF 헤더로 POST /auth/logout을 보낸 직후,
 * 응답을 기다리지 않고 세션을 정리한다. 반환한 Promise는 요청이 끝나면(성공·실패 무관) 끝난다.
 */
export function logout(): Promise<void> {
  const token = getAccessToken()
  const request = api.POST('/auth/logout', {
    params: { header: COOKIE_OP_HEADERS },
    headers: token === null ? undefined : { Authorization: `Bearer ${token}` },
  })
  clearSession(null, true)
  return request.then(
    () => undefined,
    () => undefined,
  )
}

export function resetSessionForTests(): void {
  sessionSerial += 1
  loggedOut = false
  publish(INITIAL)
}

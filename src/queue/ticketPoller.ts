import { ApiError, api, NetworkError, StaleAuthError, unwrapResponse } from '@/api/client'
import type { Ticket } from '@/api/types'
import { currentGeneration } from '@/auth/tokenStore'

// 티켓 폴링(계획 4.3, 설계 3.4절). 컴포넌트 수명과 분리된 모듈 수준 폴러다(결정 V1).
// - 간격: 마지막 응답의 Retry-After(초). 없거나 잘못되면 2초.
// - 정지: 종결, 403·400(그 밖의 4xx 포함), 갱신 불가 401, 갱신 뒤 1회 재조회의 실패(5xx·연결 실패 포함),
//   인증 세대 변경, 취소.
// - 그 밖의 네트워크 오류·5xx: 2초 뒤 계속(설계 1.3 #12).
// - 탭이 숨겨지면 대기하고, 돌아오면 즉시 1회 조회한다.

export const DEFAULT_POLL_MS = 2000
const MAX_TIMER_MS = 2_147_483_647

export function pollDelayMs(retryAfter: string | null): number {
  if (retryAfter === null) return DEFAULT_POLL_MS
  const value = retryAfter.trim()
  if (!/^\d+$/.test(value)) return DEFAULT_POLL_MS
  return Math.min(Number(value) * 1000, MAX_TIMER_MS)
}

export type PollResult =
  | { kind: 'terminal'; ticket: Ticket }
  // 403·400·401 등, 또는 갱신 뒤 1회 재조회의 실패. 기록 삭제와 잠금 해제 대상
  | { kind: 'denied'; error: ApiError | NetworkError }
  | { kind: 'stopped' } // 취소·초기화·인증 세대 변경. 화면 정리는 호출자나 세션 정리가 한다

export interface PollOptions {
  /** 첫 조회 전 대기(ms). 202 접수증의 Retry-After를 넘긴다. 기본 0. */
  initialDelayMs?: number
  /** 미완료 응답마다 부른다. */
  onUpdate?: (ticket: Ticket) => void
}

interface PollControl {
  cancelled: boolean
  wake: (() => void) | null
}

const activePolls = new Set<PollControl>()

function isHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

/**
 * delayMs가 지나고 탭이 보일 때, 또는 숨겨졌던 탭이 다시 보일 때(즉시 1회) 끝난다.
 * executor 형태: tsconfig lib(ES2022)에 Promise.withResolvers가 없다.
 */
function waitTurn(delayMs: number, control: PollControl): Promise<void> {
  return new Promise((resolve) => {
    let elapsed = delayMs <= 0
    let wasHidden = isHidden()
    let timer: number | undefined
    const finish = () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      control.wake = null
      resolve()
    }
    const onVisibility = () => {
      if (isHidden()) wasHidden = true
      else if (wasHidden || elapsed) finish()
    }
    control.wake = finish
    document.addEventListener('visibilitychange', onVisibility)
    if (!elapsed) {
      timer = window.setTimeout(() => {
        elapsed = true
        if (!isHidden()) finish()
      }, delayMs)
    } else if (!isHidden()) {
      finish()
    }
  })
}

/** ticketId를 종결까지 조회한다. 요청 때 Bearer 부착·갱신 대상 401 처리는 authFetch가 한다. */
export async function pollTicket(ticketId: string, options: PollOptions = {}): Promise<PollResult> {
  const generation = currentGeneration()
  const control: PollControl = { cancelled: false, wake: null }
  const stopped = () => control.cancelled || currentGeneration() !== generation
  activePolls.add(control)
  try {
    let delayMs = options.initialDelayMs ?? 0
    for (;;) {
      if (delayMs > 0 || isHidden()) await waitTurn(delayMs, control)
      if (stopped()) return { kind: 'stopped' }
      try {
        const { data, response } = await unwrapResponse(
          api.GET('/tickets/{ticketId}', { params: { path: { ticketId } } }),
        )
        if (stopped()) return { kind: 'stopped' }
        if (data.status === 'SUCCEEDED' || data.status === 'REJECTED') {
          return { kind: 'terminal', ticket: data }
        }
        options.onUpdate?.(data)
        delayMs = pollDelayMs(response.headers.get('Retry-After'))
      } catch (error) {
        if (stopped() || error instanceof StaleAuthError) return { kind: 'stopped' }
        if ((error instanceof ApiError || error instanceof NetworkError) && error.afterRefresh) {
          return { kind: 'denied', error } // 갱신 뒤 1회 재조회도 실패하면 멈춘다(계획 4.3)
        }
        if (error instanceof ApiError && error.status < 500) return { kind: 'denied', error }
        delayMs = DEFAULT_POLL_MS // 평소의 네트워크 오류·5xx는 멈추지 않는다
      }
    }
  } finally {
    activePolls.delete(control)
  }
}

/** 진행 중인 폴링을 모두 멈춘다(대기 중이면 즉시 깨운다). */
export function cancelAllPolls(): void {
  for (const control of activePolls) {
    control.cancelled = true
    control.wake?.()
  }
}

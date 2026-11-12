import createClient from 'openapi-fetch'
import { authFetch, isRefreshReplay, isStaleResponse, toProblem } from './authFetch'
import { API_BASE_URL } from './baseUrl'
import type { paths } from './schema'
import type { AuthFailureReason, ProblemCode, ProblemDetails } from './types'

// 경로는 기준 경로 없이 쓴다: api.GET('/courses').
// credentials: 'include'는 클라이언트 전체 기본값이다. 로그인 티켓 조회도 소유 증명 쿠키가 필요하다(계획 3절 9번).
export const api = createClient<paths>({
  baseUrl: API_BASE_URL,
  credentials: 'include',
  fetch: authFetch,
})

// 쿠키 연산 4개(로그인, 토큰 수령, 갱신, 로그아웃)의 헤더. 계약 타입상 Origin이 필수지만 브라우저가 넣는
// 금지 헤더라 값을 넣지 않는다. 런타임 값은 X-CSRF-Protection뿐이며 캐스팅은 이곳 한 군데만 둔다.
export const COOKIE_OP_HEADERS = { 'X-CSRF-Protection': '1' } as {
  Origin: string
  'X-CSRF-Protection': '1'
}

/** 오류가 갱신 뒤 1회 재전송의 결과인지. 폴러는 이 실패를 정지 조건으로 본다(계획 4.3). */
export interface ErrorOrigin {
  afterRefresh?: boolean
}

/** HTTP 오류 응답. 본문이 ProblemDetails가 아니면 problem·code·reason이 null이다. */
export class ApiError extends Error {
  readonly status: number
  readonly problem: ProblemDetails | null
  readonly code: ProblemCode | null
  readonly reason: AuthFailureReason | null
  readonly afterRefresh: boolean

  constructor(status: number, problem: ProblemDetails | null, origin: ErrorOrigin = {}) {
    super(problem?.title ?? `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
    this.code = problem?.code ?? null
    this.reason = problem?.reason ?? null
    this.afterRefresh = origin.afterRefresh ?? false
  }
}

/** 응답을 받지 못함(연결 실패 등). */
export class NetworkError extends Error {
  readonly afterRefresh: boolean

  constructor(cause?: unknown, origin: ErrorOrigin = {}) {
    super('서버에 연결할 수 없습니다', { cause })
    this.name = 'NetworkError'
    this.afterRefresh = origin.afterRefresh ?? false
  }
}

/** 응답 시점의 인증 세대가 요청 때와 다르다. 화면에 표시하지 않는다. */
export class StaleAuthError extends Error {
  constructor() {
    super('인증 상태가 바뀐 뒤 도착한 응답입니다')
    this.name = 'StaleAuthError'
  }
}

type FetchResult<T> = { data?: T; error?: unknown; response: Response }

/** 성공 본문과 응답(헤더·상태 확인용)을 함께 돌려준다. 오류 규칙은 `unwrap`과 같다. */
export async function unwrapResponse<T>(
  call: Promise<FetchResult<T>>,
): Promise<{ data: T; response: Response }> {
  let result: FetchResult<T>
  try {
    result = await call
  } catch (error) {
    if (error instanceof StaleAuthError) throw error
    throw new NetworkError(error, { afterRefresh: isRefreshReplay(error) })
  }
  const { data, error, response } = result
  if (isStaleResponse(response)) throw new StaleAuthError()
  if (!response.ok) {
    throw new ApiError(response.status, toProblem(error), { afterRefresh: isRefreshReplay(response) })
  }
  return { data: data as T, response }
}

export async function unwrap<T>(call: Promise<FetchResult<T>>): Promise<T> {
  return (await unwrapResponse(call)).data
}

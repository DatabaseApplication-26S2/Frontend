import { refreshAccess } from '@/auth/refresh'
import { endSession, markAdmissionRequired } from '@/auth/session'
import {
  currentGeneration,
  getAccessToken,
  getTokenClaims,
  sameIdentity,
  type TokenClaims,
} from '@/auth/tokenStore'
import { API_BASE_URL } from './baseUrl'
import type { ProblemDetails } from './types'

// openapi-fetch의 fetch 대체(계획 3절 2·5·9·11번, 설계 3.3절 2~7번).
// - Bearer 부착(토큰을 쓰지 않는 쿠키 연산 3개 제외, 호출자가 넣은 Authorization은 유지)
// - 응답마다 요청 때의 인증 세대를 기록한다. 세대가 바뀐 응답은 어떤 상태도 바꾸지 않는다.
// - 갱신 대상 401 → 단일 갱신 1회 → sub·sid가 같을 때만 원 요청 1회 재전송
// - 409 E15 → 세션의 admittedAt을 지워 AdmissionGate가 입장 흐름으로 보낸다
// - 본문을 읽어 판단하는 상태 변경(E15 표시, 세션 종료)은 본문을 다 읽은 뒤 세대를 다시 확인하고 한다
// - 재전송은 본문까지 받은 뒤 돌려주고, 그 응답과 연결·본문 수신 실패를 표시해 둔다. 폴러는 이 실패에서 멈춘다(계획 4.3)

const BASE_PATH = new URL(API_BASE_URL).pathname.replace(/\/+$/, '')
const NO_BEARER_PATHS = [/^\/auth\/login$/, /^\/auth\/login-tickets\/[^/]+\/tokens$/, /^\/auth\/refresh$/]
const COOKIE_OP_PATHS = [...NO_BEARER_PATHS, /^\/auth\/logout$/]

const responseGenerations = new WeakMap<Response, number>()
// 갱신 뒤 1회 재전송의 응답과, 그 연결·본문 수신 실패로 던져진 오류. 이 재조회의 실패는 폴링 정지 조건이다(계획 4.3).
const refreshReplays = new WeakSet<object>()
// 본문이 없어야 하는 상태. Response 생성자는 이 상태에 본문을 받지 않는다.
const NULL_BODY_STATUSES = [204, 205, 304]

function apiPath(url: string): string {
  const pathname = new URL(url).pathname
  return pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || '/' : pathname
}

/** 응답을 받은 시점의 인증 세대가 요청 때와 다르면 true. `unwrap`이 `StaleAuthError`로 바꾼다. */
export function isStaleResponse(response: Response): boolean {
  const generation = responseGenerations.get(response)
  return generation !== undefined && generation !== currentGeneration()
}

/** 값이 갱신 뒤 1회 재전송의 응답(또는 그 연결·본문 수신 실패로 던져진 오류)이면 true. */
export function isRefreshReplay(value: unknown): boolean {
  return typeof value === 'object' && value !== null && refreshReplays.has(value)
}

/** 본문을 끝까지 받은 같은 상태·머리글의 Response. 본문 수신이 끊기면 여기서 던진다. */
async function receiveFully(response: Response): Promise<Response> {
  const body = NULL_BODY_STATUSES.includes(response.status) ? null : await response.arrayBuffer()
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

/** 오류 본문이 ProblemDetails 모양(문자열 code)이면 그 값을, 아니면 null. 나머지 필드는 명세 스키마를 믿는다. */
export function toProblem(body: unknown): ProblemDetails | null {
  if (typeof body !== 'object' || body === null || !('code' in body)) return null
  if (typeof body.code !== 'string') return null
  const problem: ProblemDetails = body as ProblemDetails // code를 확인한 서버 응답 본문
  return problem
}

async function readProblem(response: Response): Promise<ProblemDetails | null> {
  try {
    return toProblem(await response.clone().json())
  } catch {
    return null
  }
}

/** 409 E15면 현재 세션을 미입장으로 표시한다. 본문을 다 읽은 뒤 세대를 다시 확인한다(낡은 응답은 효과 없음). */
async function noteAdmissionRequired(response: Response, generation: number): Promise<void> {
  if (response.status !== 409) return
  const problem = await readProblem(response)
  if (problem?.code === 'E15' && currentGeneration() === generation) markAdmissionRequired()
}

function isRefreshable401(problem: ProblemDetails | null): boolean {
  return (
    problem?.code === 'E02' &&
    (problem.reason === undefined || problem.reason === 'ACCESS_TOKEN_EXPIRED')
  )
}

export async function authFetch(request: Request, init?: RequestInit): Promise<Response> {
  const path = apiPath(request.url)
  const cookieOp = COOKIE_OP_PATHS.some((re) => re.test(path))
  const generation = currentGeneration()

  let sentToken: string | null = null
  let sentClaims: TokenClaims | null = null
  const token = NO_BEARER_PATHS.some((re) => re.test(path)) ? null : getAccessToken()
  if (token !== null && !request.headers.has('Authorization')) {
    request.headers.set('Authorization', `Bearer ${token}`)
    sentToken = token
    sentClaims = getTokenClaims()
  }
  // 갱신 뒤 재전송할 수 있도록 본문을 소비하기 전에 복제해 둔다(우리 토큰을 붙인 요청만).
  const replay = sentToken !== null && !cookieOp ? request.clone() : null

  const response = await globalThis.fetch(request, init)
  responseGenerations.set(response, generation)
  await noteAdmissionRequired(response, generation)
  if (response.status !== 401 || replay === null) return response

  const problem = await readProblem(response)
  // 본문을 읽는 동안 로그아웃·사용자 전환이 있었으면 이 응답으로 아무것도 바꾸지 않는다.
  if (currentGeneration() !== generation) return response
  if (!isRefreshable401(problem)) {
    endSession('SESSION_ENDED')
    return response
  }

  // 이 요청을 보낸 뒤 이미 다른 갱신이 끝났으면 다시 갱신하지 않고 그 토큰으로 재전송한다.
  if (getAccessToken() === sentToken) {
    const result = await refreshAccess()
    // refreshed가 아니면(전환·종료·불확실·낡음) 갱신 모듈이 상태를 이미 정리했다. 재전송하지 않는다.
    if (result.kind !== 'refreshed') return response
  }
  const nextToken = getAccessToken()
  if (
    currentGeneration() !== generation ||
    nextToken === null ||
    !sameIdentity(sentClaims, getTokenClaims())
  ) {
    return response
  }

  replay.headers.set('Authorization', `Bearer ${nextToken}`)
  let retried: Response
  try {
    // 본문까지 여기서 다 받는다. openapi-fetch는 이 함수가 돌려준 뒤에 본문을 읽으므로 그때의 수신 실패는
    // 재전송의 실패인지 알 수 없다. 머리글 뒤 본문 수신이 끊겨도 '갱신 뒤 재조회 실패'로 표시하기 위해서다.
    retried = await receiveFully(await globalThis.fetch(replay, init))
  } catch (error) {
    if (typeof error === 'object' && error !== null) refreshReplays.add(error)
    throw error
  }
  responseGenerations.set(retried, generation)
  refreshReplays.add(retried)
  await noteAdmissionRequired(retried, generation)
  // 재전송 뒤의 401은 세션 종료다. 기다리는 동안 세대가 바뀌었으면 아무것도 하지 않는다.
  if (retried.status === 401 && currentGeneration() === generation) endSession('SESSION_ENDED')
  return retried
}

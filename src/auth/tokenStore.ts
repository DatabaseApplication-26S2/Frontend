// Access 토큰과 인증 세대(계획 3절 1번·11번).
// 토큰은 이 모듈 변수에만 둔다. React 상태·웹 저장소·로그에 넣지 않는다.
// 이 모듈은 아무것도 가져오지 않는다. 다른 모듈이 최상위에서 리스너를 등록해도 순환 가져오기의 영향을 받지 않는다.

export interface TokenClaims {
  sub: string
  sid: string
}

let accessToken: string | null = null
let claims: TokenClaims | null = null
let generation = 0
const clearedListeners = new Set<() => void>()

export function getAccessToken(): string | null {
  return accessToken
}

/** 요청 때의 Access와 갱신으로 받은 Access를 비교하는 데만 쓴다. 화면 권한 판단에 쓰지 않는다. */
export function getTokenClaims(): TokenClaims | null {
  return claims
}

export function setAccessToken(token: string): void {
  accessToken = token
  claims = decodeClaims(token)
}

export function clearAccessToken(): void {
  accessToken = null
  claims = null
}

export function currentGeneration(): number {
  return generation
}

/** 토큰 수령 성공, 로그아웃, 사용자 전환, 세션 종료 때 올린다. 같은 sub·sid의 갱신은 올리지 않는다. */
export function bumpGeneration(): number {
  generation += 1
  return generation
}

export function sameIdentity(a: TokenClaims | null, b: TokenClaims | null): boolean {
  return a !== null && b !== null && a.sub === b.sub && a.sid === b.sid
}

/** JWT 본문의 sub·sid만 읽는다. 서명은 검증하지 않는다(권위는 서버). 형식이 맞지 않으면 null. */
export function decodeClaims(token: string): TokenClaims | null {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (typeof body !== 'object' || body === null || !('sub' in body) || !('sid' in body)) return null
    const { sub, sid } = body
    return typeof sub === 'string' && typeof sid === 'string' ? { sub, sid } : null
  } catch {
    return null
  }
}

/** 로그아웃·세션 종료·사용자 전환 때 진행 중인 흐름(진입·신청)을 정리하는 리스너. */
export function onSessionCleared(listener: () => void): () => void {
  clearedListeners.add(listener)
  return () => clearedListeners.delete(listener)
}

export function notifySessionCleared(): void {
  for (const listener of clearedListeners) listener()
}

/** 테스트 초기화: 토큰을 지우고 세대를 올려 진행 중인 응답을 모두 낡은 것으로 만든다. */
export function resetTokenStoreForTests(): void {
  clearAccessToken()
  bumpGeneration()
}

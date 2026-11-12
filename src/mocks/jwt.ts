import type { components } from '@/api/schema'
import {
  findSession,
  findUser,
  mockDb,
  opaque,
  sessionState,
  type MockSession,
  type MockUser,
} from './db'
import { problem, problemResponse } from './problems'

type Schemas = components['schemas']

export const MOCK_JWT_ISSUER = 'urn:crs:mock'
export const MOCK_JWT_AUDIENCE = 'urn:crs:web'
const ACCESS_TTL_SECONDS = 900

/** Mock Access claims: the contract's required set plus `jti`, so every issue differs. */
export interface AccessClaims {
  sub: string
  sid: string
  role: Schemas['UserRole']
  iss: string
  aud: string
  iat: number
  exp: number
  jti: string
}

function base64UrlEncode(text: string): string {
  let binary = ''
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(segment: string): string | null {
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
    return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
  } catch {
    return null
  }
}

/**
 * Issues a JWT-shaped Access (`header.payload.signature`). The signature is fake; validity is
 * the server-side `jti` record, so forged or foreign tokens are rejected like bad signatures.
 */
export function issueAccess(
  session: MockSession,
  user: MockUser,
): { accessToken: string; expiresIn: number } {
  const iat = Math.floor(Date.now() / 1000)
  const sessionSecondsLeft = Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000)
  const expiresIn = Math.max(1, Math.min(ACCESS_TTL_SECONDS, sessionSecondsLeft))
  const claims: AccessClaims = {
    sub: user.userId,
    sid: session.sid,
    role: user.role,
    iss: MOCK_JWT_ISSUER,
    aud: MOCK_JWT_AUDIENCE,
    iat,
    exp: iat + expiresIn,
    jti: opaque('jti'),
  }
  mockDb.accessTokens.push({
    jti: claims.jti,
    sid: session.sid,
    userId: user.userId,
    expired: false,
  })
  const accessToken = [
    base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    base64UrlEncode(JSON.stringify(claims)),
    base64UrlEncode(`crs-mock-signature:${claims.jti}`),
  ].join('.')
  return { accessToken, expiresIn }
}

/** 200 body of the token exchange and the refresh: a fresh Access plus user and session state. */
export function tokenResponse(session: MockSession, user: MockUser): Schemas['TokenResponse'] {
  const { accessToken, expiresIn } = issueAccess(session, user)
  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn,
    user: { userId: user.userId, name: user.name, role: user.role },
    session: {
      expiresAt: session.expiresAt,
      admittedAt: user.role === 'STUDENT' ? session.admittedAt : null,
    },
  }
}

function decodeClaims(token: string): AccessClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const json = base64UrlDecode(parts[1])
  if (json === null) return null
  try {
    const claims: unknown = JSON.parse(json)
    if (typeof claims !== 'object' || claims === null) return null
    const { sub, sid, jti, exp } = claims as Partial<Record<keyof AccessClaims, unknown>>
    if (typeof sub !== 'string' || typeof sid !== 'string' || typeof jti !== 'string') return null
    if (typeof exp !== 'number') return null
    return claims as AccessClaims
  } catch {
    return null
  }
}

export type AuthResult =
  | { ok: true; claims: AccessClaims; session: MockSession; user: MockUser }
  | { ok: false; response: Response }
export type Authenticated = Extract<AuthResult, { ok: true }>

function unauthorized(reason: Schemas['AuthFailureReason'] | undefined, hasToken: boolean) {
  return {
    ok: false as const,
    response: problemResponse(problem('E02', 401, reason ? { reason } : {}), {
      'WWW-Authenticate': hasToken ? 'Bearer error="invalid_token"' : 'Bearer',
    }),
  }
}

/**
 * Access check (contract 4.5): missing or malformed → 401 without reason; expired →
 * ACCESS_TOKEN_EXPIRED; revoked or expired session → SESSION_REVOKED / SESSION_EXPIRED.
 * The server's user record, not the token's `role`, is authoritative.
 */
export function authenticate(request: Request): AuthResult {
  const header = request.headers.get('Authorization')
  if (header === null) return unauthorized(undefined, false)
  const token = /^Bearer (\S+)$/.exec(header)?.[1]
  const claims = token === undefined ? null : decodeClaims(token)
  const record = claims && mockDb.accessTokens.find((issued) => issued.jti === claims.jti)
  if (
    !claims ||
    !record ||
    claims.iss !== MOCK_JWT_ISSUER ||
    claims.aud !== MOCK_JWT_AUDIENCE ||
    record.sid !== claims.sid ||
    record.userId !== claims.sub
  ) {
    return unauthorized(undefined, true)
  }
  if (record.expired || claims.exp * 1000 <= Date.now()) {
    return unauthorized('ACCESS_TOKEN_EXPIRED', true)
  }
  const session = findSession(claims.sid)
  const user = findUser(claims.sub)
  if (!session || !user) return unauthorized(undefined, true)
  const state = sessionState(session)
  if (state !== 'ACTIVE') return unauthorized(state, true)
  return { ok: true, claims, session, user }
}

/** Access(401) → role(403 E02 `FORBIDDEN`). */
export function authorize(
  request: Request,
  role: Schemas['UserRole'],
): { auth: Authenticated } | { response: Response } {
  const auth = authenticate(request)
  if (!auth.ok) return { response: auth.response }
  if (auth.user.role !== role) {
    return { response: problemResponse(problem('E02', 403, { reason: 'FORBIDDEN' })) }
  }
  return { auth }
}

/** 409 E15 for a student whose current session has not been admitted. */
export function requireAdmission(auth: Authenticated): Response | null {
  return auth.user.role === 'STUDENT' && auth.session.admittedAt === null
    ? problemResponse(problem('E15', 409))
    : null
}

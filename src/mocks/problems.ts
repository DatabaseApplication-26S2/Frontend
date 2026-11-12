import { HttpResponse, type JsonBodyType } from 'msw'
import type { components } from '@/api/schema'

type Schemas = components['schemas']
type ProblemDetails = Schemas['ProblemDetails']
type ProblemCode = Schemas['ProblemCode']
type AuthFailureReason = Schemas['AuthFailureReason']
export type FieldViolation = Schemas['FieldViolation']

// Titles and default details follow the openapi.yaml `components.examples` problem bodies.
const TITLES: Record<ProblemCode, string> = {
  E01: '인증 실패',
  E02: '인증·권한 없음',
  E03: '미완료 요청 있음',
  E04: '과목 없음',
  E05: '폐강 과목',
  E06: '이미 신청한 과목',
  E09: '입력값 오류',
  E10: '과목코드 중복',
  E11: '정원 축소 불가',
  E13: '학생 계정 아님',
  E14: '폐강 대상 아님',
  E15: '수강신청 화면 미입장',
  INTERNAL_ERROR: '서버 내부 오류',
}

const DETAILS: Record<ProblemCode, string> = {
  E01: '로그인 요청이 거절로 종결되었습니다. 다시 로그인하십시오.',
  E02: '유효한 Access 토큰이 필요합니다.',
  E03: '처리 중인 요청이 있습니다. 결과가 나온 뒤 다시 요청하십시오.',
  E04: '과목코드에 해당하는 과목이 없습니다.',
  E05: '폐강된 과목입니다.',
  E06: '이미 신청한 과목입니다.',
  E09: '요청 본문이 계약과 맞지 않습니다.',
  E10: '이미 사용 중인 과목코드입니다. 폐강된 과목의 코드도 다시 쓸 수 없습니다.',
  E11: '새 정원이 현재 인원보다 작습니다.',
  E13: '지정한 사용자ID는 학생 계정이 아닙니다.',
  E14: '개설 상태이면서 현재 인원이 최소 수강인원보다 적은 과목만 폐강할 수 있습니다.',
  E15: '수강신청 화면에 먼저 입장하십시오.',
  INTERNAL_ERROR: '요청을 처리하지 못했습니다. 잠시 후 다시 시도하십시오.',
}

const REASON_DETAILS: Record<AuthFailureReason, string> = {
  ACCESS_TOKEN_EXPIRED: 'Access 토큰이 만료되었습니다. 토큰을 갱신한 뒤 다시 요청하십시오.',
  SESSION_REVOKED: '세션이 종료되었습니다. 다시 로그인하십시오.',
  SESSION_EXPIRED: '세션 유효 기간이 끝났습니다. 다시 로그인하십시오.',
  REFRESH_TOKEN_INVALID: '사용할 수 있는 Refresh 토큰이 없습니다. 다시 로그인하십시오.',
  REFRESH_TOKEN_REUSED:
    '이미 사용한 Refresh 토큰이 다시 제출되어 해당 세션을 종료했습니다. 다시 로그인하십시오.',
  LOGIN_PROOF_INVALID: '이 로그인 요청의 소유 증명을 확인할 수 없습니다.',
  LOGIN_PROOF_EXPIRED: '로그인 요청의 소유 증명이 만료되었습니다. 다시 로그인하십시오.',
  LOGIN_EXCHANGE_CONSUMED:
    '이 로그인 요청의 토큰은 이미 발급되었습니다. 토큰 갱신을 사용하거나 다시 로그인하십시오.',
  CSRF_CHECK_FAILED: '요청 출처 또는 CSRF 보호 헤더가 올바르지 않습니다.',
  FORBIDDEN: '이 역할로는 요청할 수 없습니다.',
}

/**
 * Contract-shaped problem body: `type` is `urn:crs:problem:{code}` with the code's fixed title.
 * Fills the fields the contract requires for the code (403 E02 `reason`, E09 `violations`) when
 * the caller leaves them out; `extra` overrides everything else.
 */
export function problem(
  code: ProblemCode,
  status: number,
  extra: Partial<ProblemDetails> = {},
): ProblemDetails {
  const reason = extra.reason ?? (code === 'E02' && status === 403 ? 'FORBIDDEN' : undefined)
  const body: ProblemDetails = {
    type: `urn:crs:problem:${code}`,
    title: TITLES[code],
    status,
    detail: reason ? REASON_DETAILS[reason] : DETAILS[code],
    code,
    ...extra,
  }
  if (reason) body.reason = reason
  if (code === 'E09' && !body.violations?.length) {
    body.violations = [{ source: 'BODY', field: '', message: '요청이 계약과 맞지 않습니다.' }]
  }
  return body
}

const NO_STORE = { 'Cache-Control': 'no-store' }

/** JSON response with the contract's `Cache-Control: no-store`. */
export function jsonResponse(
  body: JsonBodyType,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return HttpResponse.json(body, { status, headers: { ...NO_STORE, ...headers } })
}

/** `application/problem+json` response whose HTTP status is the body's `status`. */
export function problemResponse(
  body: ProblemDetails,
  headers: Record<string, string> = {},
): Response {
  return HttpResponse.json(body, {
    status: body.status,
    headers: { ...NO_STORE, 'Content-Type': 'application/problem+json', ...headers },
  })
}

/** 400 E09 whose detail names where the first violation sits. */
export function invalidInput(violations: FieldViolation[]): Response {
  const detail =
    violations[0].source === 'PATH'
      ? '경로 파라미터 형식이 올바르지 않습니다.'
      : violations[0].source === 'QUERY'
        ? '쿼리 파라미터가 계약과 맞지 않습니다.'
        : violations[0].field === ''
          ? '요청 본문 형식이 올바르지 않습니다.'
          : DETAILS.E09
  return problemResponse(problem('E09', 400, { detail, violations }))
}

export const COURSE_CODE_PATTERN = /^[A-Za-z0-9]{1,10}$/
export const TICKET_ID_PATTERN = /^[1-9][0-9]*$/
export const COURSE_CODE_MESSAGE = 'ASCII 영문자·숫자 1~10자여야 합니다.'

/** RFC 6901 JSON Pointer built from body member names and array indexes. */
export function pointer(...segments: (string | number)[]): string {
  return segments
    .map((segment) => `/${String(segment).replace(/~/g, '~0').replace(/\//g, '~1')}`)
    .join('')
}

export function pathViolations(
  name: string,
  value: string,
  pattern: RegExp,
  message: string,
): FieldViolation[] {
  return pattern.test(value) ? [] : [{ source: 'PATH', field: name, message }]
}

/** Undefined or repeated query parameters (contract 3: both are 400 E09). */
export function queryViolations(url: URL, allowed: readonly string[]): FieldViolation[] {
  const seen = new Set<string>()
  const violations: FieldViolation[] = []
  for (const key of url.searchParams.keys()) {
    if (!allowed.includes(key)) {
      violations.push({ source: 'QUERY', field: key, message: '정의되지 않은 쿼리 파라미터입니다.' })
    } else if (seen.has(key)) {
      violations.push({
        source: 'QUERY',
        field: key,
        message: '같은 쿼리 파라미터를 반복할 수 없습니다.',
      })
    }
    seen.add(key)
  }
  return violations
}

/**
 * Input check for operations without query parameters or a body: the given path violations,
 * any query parameter, and any body (`field: ''`) are all E09.
 */
export async function bodylessViolations(
  request: Request,
  url: URL,
  pathChecks: FieldViolation[] = [],
): Promise<FieldViolation[]> {
  const violations = [...pathChecks, ...queryViolations(url, [])]
  if ((await request.text()).length > 0) {
    violations.push({ source: 'BODY', field: '', message: '본문을 보내지 마십시오.' })
  }
  return violations
}

export type JsonObjectResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; violations: FieldViolation[] }

/**
 * Parses a required JSON object body. Missing bodies, a media type other than
 * `application/json` (parameters such as `charset` allowed), non-JSON and non-object bodies are
 * all E09 (contract 3: bodies are `application/json` only).
 */
export async function readJsonObject(request: Request): Promise<JsonObjectResult> {
  const text = await request.text()
  const whole = (message: string): JsonObjectResult => ({
    ok: false,
    violations: [{ source: 'BODY', field: '', message }],
  })
  if (text.length === 0) return whole('요청 본문이 필요합니다.')
  const mediaType = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase()
  if (mediaType !== 'application/json') {
    return whole('Content-Type은 application/json이어야 합니다.')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return whole('JSON 형식이 아닙니다.')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return whole('JSON 객체여야 합니다.')
  }
  return { ok: true, body: parsed as Record<string, unknown> }
}

/**
 * Body members outside `allowed` are E09. Members in `serverOwned` get the server-owned message
 * (for example `courseCode` in a course update body).
 */
export function unknownMemberViolations(
  body: Record<string, unknown>,
  allowed: readonly string[],
  serverOwned: readonly string[] = [],
): FieldViolation[] {
  return Object.keys(body)
    .filter((key) => !allowed.includes(key))
    .map(
      (key): FieldViolation => ({
        source: 'BODY',
        field: pointer(key),
        message: serverOwned.includes(key)
          ? '수정 본문에 넣을 수 없는 필드입니다.'
          : '정의되지 않은 필드입니다.',
      }),
    )
}

/**
 * Checks one required body member: absent → '필수 항목입니다.', present but failing `valid` →
 * `message`. Returns whether the member is valid so callers can run cross-field checks.
 */
export function checkMember(
  body: Record<string, unknown>,
  name: string,
  valid: (value: unknown) => boolean,
  message: string,
  violations: FieldViolation[],
): boolean {
  if (!(name in body)) {
    violations.push({ source: 'BODY', field: pointer(name), message: '필수 항목입니다.' })
    return false
  }
  if (!valid(body[name])) {
    violations.push({ source: 'BODY', field: pointer(name), message })
    return false
  }
  return true
}

export function isIntegerBetween(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

/** Non-empty string with at least one non-whitespace character; stored without trimming. */
export function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && /\S/.test(value)
}

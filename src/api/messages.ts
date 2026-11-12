import { ApiError, NetworkError, StaleAuthError } from './client'
import type {
  AuthFailureReason,
  CourseClosureItemCode,
  ProblemCode,
  TicketRequestType,
  TicketResultCode,
} from './types'

// 계획 5.6(HTTP 오류)·5.7(티켓 결과) 대응표. null이면 화면에 표시하지 않는다.

export type ProblemContext = 'default' | 'login-ticket' | 'ticket' | 'exchange'

export const NETWORK_ERROR_MESSAGE = '서버에 연결할 수 없습니다. 다시 시도하세요'
export const ACTIVE_TICKET_RETRY_MESSAGE = '진행 중인 요청이 있습니다. 2초 뒤 다시 시도하세요'
export const SESSION_ENDED_MESSAGE = '세션이 끝났습니다. 다시 로그인하세요'
export const REFRESH_UNCERTAIN_MESSAGE = '세션 상태를 확인할 수 없습니다. 다시 로그인하세요'
export const LOGIN_TICKET_FORBIDDEN_MESSAGE = '로그인 요청을 확인할 수 없습니다. 다시 로그인하세요'
export const TICKET_FORBIDDEN_MESSAGE = '요청 상태를 확인할 수 없습니다'
export const EXCHANGE_CONSUMED_MESSAGE = '이미 처리된 로그인입니다. 다시 로그인하세요'
export const ADMISSION_REQUIRED_MESSAGE = '화면 입장이 필요합니다'
export const FALLBACK_MESSAGE = '요청에 실패했습니다'

const SESSION_ENDED_REASONS: readonly AuthFailureReason[] = [
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'REFRESH_TOKEN_INVALID',
  'REFRESH_TOKEN_REUSED',
]

const CODE_MESSAGE: Partial<Record<ProblemCode, string>> = {
  E01: '로그인에 실패했습니다. 다시 로그인하세요',
  E03: '진행 중인 요청이 있습니다',
  E04: '과목을 찾을 수 없습니다',
  E05: '폐강된 과목입니다',
  E06: '이미 신청한 과목입니다',
  E10: '이미 사용된 과목코드입니다',
  E11: '정원은 현재 인원보다 작을 수 없습니다',
  E13: '학생 계정이 아닙니다',
  E14: '폐강 대상이 아닙니다',
  INTERNAL_ERROR: '일시적인 오류입니다',
}

function e02Message(error: ApiError, ctx: ProblemContext): string | null {
  const reason = error.reason
  if (error.status === 401) {
    // 갱신 대상 401은 표시하지 않는다(갱신·재전송 또는 세션 정리가 처리한다).
    if (reason === null || reason === 'ACCESS_TOKEN_EXPIRED') return null
    if (SESSION_ENDED_REASONS.includes(reason)) return SESSION_ENDED_MESSAGE
  }
  if (ctx === 'login-ticket') return LOGIN_TICKET_FORBIDDEN_MESSAGE
  if (ctx === 'ticket') return TICKET_FORBIDDEN_MESSAGE
  switch (reason) {
    case 'LOGIN_PROOF_INVALID':
    case 'LOGIN_PROOF_EXPIRED':
      return '로그인 요청이 만료되었습니다'
    case 'LOGIN_EXCHANGE_CONSUMED':
      return EXCHANGE_CONSUMED_MESSAGE
    case 'CSRF_CHECK_FAILED':
      return '요청 설정 오류입니다'
    default:
      return '권한이 없습니다'
  }
}

function violationsMessage(error: ApiError): string {
  const messages = error.problem?.violations?.map((v) => v.message).filter(Boolean) ?? []
  return messages.length > 0 ? messages.join('\n') : (error.problem?.detail ?? FALLBACK_MESSAGE)
}

/** 오류 → 표시 문구. null이면 표시하지 않는다(갱신 대상 401, E15, StaleAuthError). */
export function problemMessage(error: unknown, ctx: ProblemContext = 'default'): string | null {
  if (error instanceof StaleAuthError) return null
  if (error instanceof NetworkError) return NETWORK_ERROR_MESSAGE
  if (!(error instanceof ApiError)) return FALLBACK_MESSAGE
  if ((ctx === 'login-ticket' || ctx === 'ticket') && (error.status === 403 || error.status === 400)) {
    return ctx === 'login-ticket' ? LOGIN_TICKET_FORBIDDEN_MESSAGE : TICKET_FORBIDDEN_MESSAGE
  }
  switch (error.code) {
    case 'E02':
      return e02Message(error, ctx)
    case 'E03':
      return error.problem?.activeTicketId ? '진행 중인 요청이 있습니다' : ACTIVE_TICKET_RETRY_MESSAGE
    case 'E09':
      return violationsMessage(error)
    case 'E15':
      return null
    case null:
      return error.status >= 500 ? '일시적인 오류입니다' : FALLBACK_MESSAGE
    default:
      return CODE_MESSAGE[error.code] ?? FALLBACK_MESSAGE
  }
}

const TICKET_RESULT_MESSAGE: Record<Exclude<TicketResultCode, 'OK'>, string> = {
  E01: '아이디나 비밀번호가 맞지 않거나 대기 시간이 지났습니다',
  E02: '세션이 끝났습니다',
  E04: '과목을 찾을 수 없습니다',
  E05: '폐강된 과목입니다',
  E06: '이미 신청한 과목입니다',
  E07: '여석이 없습니다(대기 명단 없음)',
  E08: '현재 신청 내역이 없습니다',
  E15: ADMISSION_REQUIRED_MESSAGE,
  E99: '요청을 처리하지 못했습니다. 다시 시도하세요',
}

/** 티켓 결과 → 문구. LOGIN·ADMISSION의 OK는 표시하지 않는다(null). */
export function ticketResultMessage(
  requestType: TicketRequestType,
  code: TicketResultCode,
): string | null {
  if (code !== 'OK') return TICKET_RESULT_MESSAGE[code]
  if (requestType === 'ENROLLMENT') return '신청 완료'
  if (requestType === 'CANCELLATION') return '취소 완료'
  return null
}

const CLOSURE_ITEM_MESSAGE: Record<CourseClosureItemCode, string> = {
  OK: '폐강 완료',
  E02: '세션이 끝났습니다',
  E04: '과목을 찾을 수 없습니다',
  E14: '폐강 대상이 아닙니다',
}

export function closureItemMessage(code: CourseClosureItemCode): string {
  return CLOSURE_ITEM_MESSAGE[code]
}

export interface FormErrors {
  fields: Record<string, string>
  form: string | null
}

/** E09 violations의 field: 본문은 JSON Pointer('/capacity' → 'capacity'), 쿼리·경로는 이름 그대로. */
function violationFieldName(source: string, field: string): string {
  if (source !== 'BODY' || !field.startsWith('/')) return field
  return field
    .slice(1)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .join('.')
}

const CODE_FIELD: Partial<Record<ProblemCode, string>> = {
  E04: 'courseCode',
  E10: 'courseCode',
  E11: 'capacity',
  E13: 'studentId',
}

/** 폼 오류 매핑(설계 3.2절). 필드에 붙지 않는 오류는 form으로 간다. */
export function formErrorsFrom(error: unknown): FormErrors {
  if (error instanceof ApiError && error.code === 'E09' && error.problem?.violations) {
    const fields: Record<string, string> = {}
    const formMessages: string[] = []
    for (const violation of error.problem.violations) {
      const name = violationFieldName(violation.source, violation.field)
      if (name === '') formMessages.push(violation.message)
      else if (!(name in fields)) fields[name] = violation.message
    }
    return { fields, form: formMessages.length > 0 ? formMessages.join('\n') : null }
  }
  if (error instanceof ApiError && error.code !== null) {
    const field = CODE_FIELD[error.code]
    const message = problemMessage(error)
    if (field && message) return { fields: { [field]: message }, form: null }
  }
  return { fields: {}, form: problemMessage(error) }
}

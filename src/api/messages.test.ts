import { expect, it } from 'vitest'
import { closureItemMessage, formErrorsFrom, problemMessage, ticketResultMessage } from '@/api/messages'
import { ApiError, NetworkError, StaleAuthError } from '@/api/client'
import { problem } from '@/mocks/problems'

it.each([
  ['LOGIN', 'OK', null], ['ADMISSION', 'OK', null], ['ENROLLMENT', 'OK', '신청 완료'], ['CANCELLATION', 'OK', '취소 완료'],
  ['LOGIN', 'E01', '아이디나 비밀번호가 맞지 않거나 대기 시간이 지났습니다'],
  ['ADMISSION', 'E02', '세션이 끝났습니다'], ['ENROLLMENT', 'E02', '세션이 끝났습니다'], ['CANCELLATION', 'E02', '세션이 끝났습니다'],
  ['ENROLLMENT', 'E15', '화면 입장이 필요합니다'], ['CANCELLATION', 'E15', '화면 입장이 필요합니다'],
  ['ENROLLMENT', 'E04', '과목을 찾을 수 없습니다'], ['CANCELLATION', 'E04', '과목을 찾을 수 없습니다'],
  ['ENROLLMENT', 'E05', '폐강된 과목입니다'], ['CANCELLATION', 'E05', '폐강된 과목입니다'],
  ['ENROLLMENT', 'E06', '이미 신청한 과목입니다'], ['ENROLLMENT', 'E07', '여석이 없습니다(대기 명단 없음)'],
  ['CANCELLATION', 'E08', '현재 신청 내역이 없습니다'],
  ['LOGIN', 'E99', '요청을 처리하지 못했습니다. 다시 시도하세요'], ['ADMISSION', 'E99', '요청을 처리하지 못했습니다. 다시 시도하세요'],
  ['ENROLLMENT', 'E99', '요청을 처리하지 못했습니다. 다시 시도하세요'], ['CANCELLATION', 'E99', '요청을 처리하지 못했습니다. 다시 시도하세요'],
] as const)('%s %s 티켓 결과', (type, code, message) => expect(ticketResultMessage(type, code)).toBe(message))
it.each([['OK', '폐강 완료'], ['E02', '세션이 끝났습니다'], ['E04', '과목을 찾을 수 없습니다'], ['E14', '폐강 대상이 아닙니다']] as const)('%s 폐강 결과', (code, message) => expect(closureItemMessage(code)).toBe(message))
it('E09 필드 오류에서 JSON Pointer를 필드 이름으로 바꾼다', () => {
  const body = problem('E09', 400, { violations: [{ source: 'BODY', field: '/capacity', message: '범위 오류' }] })
  const error = new ApiError(400, body)
  expect(formErrorsFrom(error).fields.capacity).toBe('범위 오류')
})

it.each([
  ['E04', 404, '과목을 찾을 수 없습니다'], ['E05', 409, '폐강된 과목입니다'],
  ['E06', 409, '이미 신청한 과목입니다'], ['E10', 409, '이미 사용된 과목코드입니다'],
  ['E11', 409, '정원은 현재 인원보다 작을 수 없습니다'], ['E13', 422, '학생 계정이 아닙니다'],
  ['E14', 409, '폐강 대상이 아닙니다'], ['INTERNAL_ERROR', 500, '일시적인 오류입니다'],
] as const)('%s HTTP 오류 문구', (code, status, message) => {
  expect(problemMessage(new ApiError(status, problem(code, status)))).toBe(message)
})
it('인증 및 전송 오류 문구는 상황에 따라 구분한다', () => {
  expect(problemMessage(new ApiError(401, problem('E01', 401)), 'exchange')).toBe('로그인에 실패했습니다. 다시 로그인하세요')
  expect(problemMessage(new ApiError(401, problem('E02', 401)))).toBeNull()
  expect(problemMessage(new ApiError(409, problem('E15', 409)))).toBeNull()
  expect(problemMessage(new StaleAuthError())).toBeNull()
  expect(problemMessage(new NetworkError())).toBe('서버에 연결할 수 없습니다. 다시 시도하세요')
  const forbidden = new ApiError(403, problem('E02', 403, { reason: 'FORBIDDEN' }))
  expect(problemMessage(forbidden)).toBe('권한이 없습니다')
  expect(problemMessage(forbidden, 'ticket')).toBe('요청 상태를 확인할 수 없습니다')
  expect(problemMessage(forbidden, 'login-ticket')).toBe('로그인 요청을 확인할 수 없습니다. 다시 로그인하세요')
})

it.each([
  ['SESSION_REVOKED', '세션이 끝났습니다. 다시 로그인하세요'],
  ['SESSION_EXPIRED', '세션이 끝났습니다. 다시 로그인하세요'],
  ['REFRESH_TOKEN_INVALID', '세션이 끝났습니다. 다시 로그인하세요'],
  ['REFRESH_TOKEN_REUSED', '세션이 끝났습니다. 다시 로그인하세요'],
  ['LOGIN_PROOF_INVALID', '로그인 요청이 만료되었습니다'],
  ['LOGIN_PROOF_EXPIRED', '로그인 요청이 만료되었습니다'],
  ['LOGIN_EXCHANGE_CONSUMED', '이미 처리된 로그인입니다. 다시 로그인하세요'],
  ['CSRF_CHECK_FAILED', '요청 설정 오류입니다'],
] as const)('%s 인증 오류 문구', (reason, message) => {
  const status = reason.startsWith('LOGIN_') || reason === 'CSRF_CHECK_FAILED' ? 403 : 401
  expect(problemMessage(new ApiError(status, problem('E02', status, { reason })))).toBe(message)
})
it.each([
  ['E10', 409, 'courseCode', '이미 사용된 과목코드입니다'],
  ['E11', 409, 'capacity', '정원은 현재 인원보다 작을 수 없습니다'],
  ['E13', 422, 'studentId', '학생 계정이 아닙니다'],
  ['E04', 404, 'courseCode', '과목을 찾을 수 없습니다'],
] as const)('%s 폼 필드 오류', (code, status, field, message) => {
  expect(formErrorsFrom(new ApiError(status, problem(code, status))).fields[field]).toBe(message)
})

it('입력 위반 위치와 폼 전체 오류를 구분한다', () => {
  const error = new ApiError(400, problem('E09', 400, { violations: [
    { source: 'QUERY', field: 'page', message: '페이지 오류' },
    { source: 'PATH', field: 'ticketId', message: '티켓 오류' },
    { source: 'BODY', field: '', message: '본문 오류' },
  ] }))
  expect(formErrorsFrom(error)).toEqual({ fields: { page: '페이지 오류', ticketId: '티켓 오류' }, form: '본문 오류' })
  expect(problemMessage(new ApiError(401, problem('E02', 401, { reason: 'ACCESS_TOKEN_EXPIRED' })))).toBeNull()
})

it('E03은 기존 티켓 유무에 맞게 안내한다', () => {
  expect(problemMessage(new ApiError(409, problem('E03', 409, { activeTicketId: '1' })))).toBe('진행 중인 요청이 있습니다')
  expect(problemMessage(new ApiError(409, problem('E03', 409)))).toBe('진행 중인 요청이 있습니다. 2초 뒤 다시 시도하세요')
})

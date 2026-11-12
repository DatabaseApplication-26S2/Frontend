import { expect, it } from 'vitest'
import { pollDelayMs } from '@/queue/ticketPoller'
import { queueStatusText } from '@/queue/statusText'

it.each([[null, 2000], ['bad', 2000], ['-1', 2000], ['1.5', 2000], ['0', 0], ['3', 3000]])('Retry-After %s → %i ms', (value, expected) => {
  expect(pollDelayMs(value)).toBe(expected)
})
it.each([
  ['login', '로그인 대기 중', '처리 중'],
  ['admission', '입장 대기 중', '처리 중'],
  ['request', '대기 중', '처리 중'],
  ['adopted', '진행 중인 요청이 있습니다', '진행 중인 요청이 있습니다 · 처리 중'],
] as const)('%s 대기열 문구', (context, waiting, processing) => {
  expect(queueStatusText(context, 'RECEIVED', null)).toBe(waiting)
  expect(queueStatusText(context, 'WAITING', 2)).toBe(`${waiting} · 순번 2`)
  expect(queueStatusText(context, 'PROCESSING', null)).toBe(processing)
})

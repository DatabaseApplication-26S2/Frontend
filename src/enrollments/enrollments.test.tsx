import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { mockDb } from '@/mocks/db'
import { mockScenario } from '@/mocks/scenario'
import { SEED } from '@/mocks/seed'
import { courseRow } from '@/test/flows'
import { renderApp } from '@/test/render'

it.each([
  ['T1-06', SEED.course.open, '신청 완료'],
  ['T1-07', SEED.course.full, '여석이 없습니다(대기 명단 없음)'],
  ['T3-01', SEED.course.e99, '요청을 처리하지 못했습니다. 다시 시도하세요'],
])('%s 신청 결과와 목록 재조회', async (_, code, message) => {
  mockScenario.signIn(SEED.student)
  renderApp(`/courses?q=${code}`)
  const row = await courseRow(code)
  const calls = mockDb.calls.searchCourses ?? 0
  const hold = mockScenario.holdNext('getTicket')
  await userEvent.click(row.getByRole('button', { name: '신청' }))
  await waitFor(() => expect(screen.getByTestId('request-active')).not.toBeEmptyDOMElement())
  hold.release()
  await waitFor(() => expect(screen.getByTestId('request-outcome')).toHaveTextContent(message), { timeout: 10000 })
  await waitFor(() => expect(mockDb.calls.searchCourses ?? 0).toBeGreaterThan(calls))
  if (code === SEED.course.open) await waitFor(async () => expect((await courseRow(code)).getByRole('button', { name: '취소' })).toBeEnabled())
  else expect(screen.getByTestId('request-outcome')).toHaveAttribute('role', 'alert')
})
it('T1-08 진행 중 다른 신청과 취소를 잠근다', async () => {
  mockScenario.signIn(SEED.student)
  const router = renderApp('/courses')
  const hold = mockScenario.holdNext('getTicket')
  await userEvent.click((await courseRow(SEED.course.open)).getByRole('button', { name: '신청' }))
  await waitFor(() => expect((mockDb.calls.getTicket ?? 0)).toBeGreaterThan(0))
  expect((await courseRow(SEED.course.enrolled)).getByRole('button', { name: '취소' })).toBeDisabled()
  await router.navigate(`/courses?q=${SEED.course.e99}`)
  expect((await courseRow(SEED.course.e99)).getByRole('button', { name: '신청' })).toBeDisabled()
  await router.navigate(`/courses?q=${SEED.course.closed}`)
  expect((await courseRow(SEED.course.closed)).getByRole('button', { name: '신청 불가' })).toBeDisabled()
  hold.release()
})
it('T1-16 취소 성공과 E08 결과', async () => {
  mockScenario.signIn(SEED.student)
  renderApp('/me/enrollments')
  const row = await screen.findByTestId(`enrollment-row-${SEED.course.enrolled}`)
  await userEvent.click(within(row).getByRole('button', { name: '취소' }))
  await waitFor(() => expect(screen.getByTestId('request-outcome')).toHaveTextContent('취소 완료'), { timeout: 10000 })
})

it('T1-16 취소 티켓 E08은 신청 내역 없음으로 표시한다', async () => {
  mockScenario.signIn(SEED.student)
  mockScenario.forceTicketResult('E08', { requestType: 'CANCELLATION', courseCode: SEED.course.enrolled })
  renderApp('/me/enrollments')
  const row = await screen.findByTestId(`enrollment-row-${SEED.course.enrolled}`)
  await userEvent.click(within(row).getByRole('button', { name: '취소' }))
  await waitFor(() => expect(screen.getByTestId('request-outcome')).toHaveTextContent('현재 신청 내역이 없습니다'), { timeout: 10000 })
})

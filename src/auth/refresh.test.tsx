import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { resetAppStateForTests } from '@/app/resetForTests'
import { api } from '@/api/client'
import { mockDb } from '@/mocks/db'
import { mockScenario } from '@/mocks/scenario'
import { SEED } from '@/mocks/seed'
import { courseRow, delay, waitForPath } from '@/test/flows'
import { renderApp } from '@/test/render'

it('T2-01 만료된 Access를 한 번 갱신하고 조회를 재전송한다', async () => {
  mockScenario.signIn(SEED.student)
  renderApp(`/courses/${SEED.course.open}`)
  await screen.findByRole('button', { name: '새로고침' })
  const refresh = mockDb.calls.refreshTokens ?? 0
  const calls = mockDb.calls.getCourse ?? 0
  mockScenario.expireAccess()
  await userEvent.click(await screen.findByRole('button', { name: '새로고침' }))
  await waitFor(() => expect(mockDb.calls.getCourse).toBe(calls + 2))
  expect(mockDb.calls.refreshTokens).toBe(refresh + 1)
})
it('T2-07 갱신 응답 유실은 자동 갱신을 막는다', async () => {
  mockScenario.signIn(SEED.student)
  const router = renderApp(`/courses/${SEED.course.open}`)
  await screen.findByRole('button', { name: '새로고침' })
  mockScenario.expireAccess()
  mockScenario.failNext('refreshTokens', 'network')
  await userEvent.click(await screen.findByRole('button', { name: '새로고침' }))
  await waitForPath(router, '/login')
  expect(await screen.findByTestId('entry-notice')).toHaveTextContent('세션 상태를 확인할 수 없습니다. 다시 로그인하세요')
  expect(localStorage.getItem('crs.refreshUncertainAt')).not.toBeNull()
  const calls = mockDb.calls.refreshTokens
  await router.navigate('/courses')
  await waitForPath(router, '/login')
  expect(mockDb.calls.refreshTokens).toBe(calls)
})
it('T2-08 폐기된 세션은 로그인으로 돌아간다', async () => {
  mockScenario.signIn(SEED.student)
  const router = renderApp(`/courses/${SEED.course.open}`)
  await screen.findByRole('button', { name: '새로고침' })
  mockScenario.revokeSession()
  await userEvent.click(await screen.findByRole('button', { name: '새로고침' }))
  await waitForPath(router, '/login')
  expect(await screen.findByTestId('entry-notice')).toHaveTextContent('세션이 끝났습니다. 다시 로그인하세요')
})
it.each([[SEED.student, '/me/enrollments'], [SEED.professor, '/professor/courses'], [SEED.admin, '/admin/settings']])('T2-09 %s 부트스트랩은 허용 경로를 유지한다', async (id, path) => {
  mockScenario.signIn(id)
  const router = renderApp(path)
  await screen.findByTestId('current-user')
  expect(router.state.location.pathname).toBe(path)
})
it('T2-09 미입장 학생은 입장 후 원래 경로에 간다', async () => {
  mockScenario.signIn(SEED.student, { admitted: false })
  const router = renderApp('/me/enrollments')
  await waitForPath(router, '/me/enrollments')
  expect(mockDb.calls.requestAdmission).toBeGreaterThan(0)
})

it.each([
  { nextUser: SEED.student2, caseId: 'T2-04' },
  { nextUser: SEED.student, caseId: 'T2-05' },
])('$caseId $nextUser 다른 세션으로 전환 시 원 요청을 재전송하지 않는다', async ({ nextUser }) => {
  mockScenario.signIn(SEED.student)
  renderApp(`/courses/${SEED.course.open}`)
  await screen.findByRole('button', { name: '새로고침' }, { timeout: 25000 })
  const before = mockDb.calls.getCourse ?? 0
  const previousUser = (await screen.findByTestId('current-user', {}, { timeout: 25000 })).textContent
  mockScenario.expireAccess()
  mockScenario.signIn(nextUser)
  await userEvent.click(await screen.findByRole('button', { name: '새로고침' }))
  await waitFor(() => expect(mockDb.calls.refreshTokens).toBe(2), { timeout: 25000 })
  await waitFor(() => expect(mockDb.calls.getCourse).toBe(before + 2), { timeout: 25000 })
  await delay(50)
  expect(mockDb.calls.getCourse).toBe(before + 2)
  if (nextUser !== SEED.student) await waitFor(() => expect(screen.getByTestId('current-user').textContent).not.toBe(previousUser), { timeout: 25000 })
}, 40000)
it('T2-06 보류된 갱신은 로그아웃을 되돌리지 않는다', async () => {
  mockScenario.signIn(SEED.student)
  const router = renderApp(`/courses/${SEED.course.open}`)
  await screen.findByRole('button', { name: '새로고침' })
  const hold = mockScenario.holdNext('refreshTokens')
  mockScenario.expireAccess()
  await userEvent.click(await screen.findByRole('button', { name: '새로고침' }))
  await waitFor(() => expect(mockDb.calls.refreshTokens).toBe(2))
  await userEvent.click(await screen.findByRole('button', { name: '로그아웃' }))
  await waitForPath(router, '/login')
  hold.release()
  await delay(50)
  expect(router.state.location.pathname).toBe('/login')
})

it('T2-03 신청 티켓 폴링 도중 만료되어도 갱신 후 결과를 표시한다', async () => {
  mockScenario.signIn(SEED.student)
  renderApp(`/courses?q=${SEED.course.open}`)
  const row = await courseRow(SEED.course.open)
  const hold = mockScenario.holdNext('getTicket')
  await userEvent.click(row.getByRole('button', { name: '신청' }))
  await waitFor(() => expect(mockDb.calls.getTicket).toBe(1))
  mockScenario.expireAccess()
  hold.release()
  await waitFor(() => expect(screen.getByTestId('request-outcome')).toHaveTextContent('신청 완료'), { timeout: 10000 })
  expect(mockDb.calls.refreshTokens).toBe(2)
})

it('T2-10 새로고침 후 신청 티켓과 잠금을 복구한다', async () => {
  mockScenario.signIn(SEED.student)
  const { ticketId } = mockScenario.seedPendingRequest(SEED.student, 'ENROLLMENT', SEED.course.open)
  sessionStorage.setItem('crs.pendingTicket', JSON.stringify({ ticketId, requestType: 'ENROLLMENT', courseCode: SEED.course.open }))
  const hold = mockScenario.holdNext('getTicket')
  renderApp(`/courses?q=${SEED.course.open}`)
  await waitFor(() => expect(mockDb.calls.getTicket).toBe(1))
  expect(screen.getByTestId('request-active')).not.toBeEmptyDOMElement()
  expect((await courseRow(SEED.course.open)).getByRole('button', { name: '신청' })).toBeDisabled()
  cleanup()
  resetAppStateForTests()
  hold.release()
  renderApp(`/courses?q=${SEED.course.open}`)
  await waitFor(() => expect(screen.getByTestId('request-outcome')).toHaveTextContent('신청 완료'), { timeout: 10000 })
  expect(sessionStorage.getItem('crs.pendingTicket')).toBeNull()
})

it('T2-02 동시 만료 요청들은 한 번만 갱신한다', async () => {
  mockScenario.signIn(SEED.student)
  renderApp(`/courses/${SEED.course.open}`)
  await screen.findByRole('button', { name: '새로고침' })
  const before = mockDb.calls.refreshTokens ?? 0
  mockScenario.expireAccess()
  const hold = mockScenario.holdNext('refreshTokens')
  const first = api.GET('/courses/{courseCode}', { params: { path: { courseCode: SEED.course.open } } })
  const second = api.GET('/me/enrollments')
  await waitFor(() => expect(mockDb.calls.refreshTokens).toBe(before + 1))
  hold.release()
  const results = await Promise.all([first, second])
  expect(results.every((result) => result.response.ok)).toBe(true)
  expect(mockDb.calls.refreshTokens).toBe(before + 1)
})

it('T2-09 허용되지 않은 복구 경로는 역할 첫 화면으로 이동한다', async () => {
  mockScenario.signIn(SEED.professor)
  const router = renderApp('/admin/settings')
  await waitForPath(router, '/professor/courses')
})

it('T2-10 이미 종결된 티켓도 복구 후 결과를 표시하고 기록을 지운다', async () => {
  mockScenario.signIn(SEED.student)
  const { ticketId } = mockScenario.seedPendingRequest(SEED.student, 'ENROLLMENT', SEED.course.open)
  const record = JSON.stringify({ ticketId, requestType: 'ENROLLMENT', courseCode: SEED.course.open })
  sessionStorage.setItem('crs.pendingTicket', record)
  renderApp(`/courses?q=${SEED.course.open}`)
  await waitFor(() => expect(screen.getByTestId('request-outcome')).toHaveTextContent('신청 완료'), { timeout: 10000 })
  cleanup()
  resetAppStateForTests()
  sessionStorage.setItem('crs.pendingTicket', record)
  renderApp(`/courses?q=${SEED.course.open}`)
  await waitFor(() => expect(screen.getByTestId('request-outcome')).toHaveTextContent('신청 완료'), { timeout: 10000 })
  expect(sessionStorage.getItem('crs.pendingTicket')).toBeNull()
})

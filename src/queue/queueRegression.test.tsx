import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { expect, it } from 'vitest'
import { API_BASE_URL } from '@/api/baseUrl'
import { api } from '@/api/client'
import { mockDb, resetMockDb } from '@/mocks/db'
import { problem } from '@/mocks/problems'
import { mockScenario } from '@/mocks/scenario'
import { SEED } from '@/mocks/seed'
import { server } from '@/mocks/server'
import { courseRow, delay, waitForPath } from '@/test/flows'
import { renderApp } from '@/test/render'

it('갱신 응답에 입장 시각이 있어도 입장 POST 200을 기다린다', async () => {
  resetMockDb({ retryAfterSeconds: 0, waitingPolls: 0 })
  mockScenario.signIn(SEED.student, { admitted: false })
  const firstPoll = mockScenario.holdNext('getTicket')
  const router = renderApp('/login')
  await waitFor(() => expect(mockDb.calls.getTicket).toBe(1))
  const terminalPoll = mockScenario.holdNext('getTicket')
  firstPoll.release()
  await waitFor(() => expect(mockDb.calls.getTicket).toBe(2))
  expect(mockDb.calls.requestAdmission).toBe(1)
  const before = mockDb.calls.refreshTokens ?? 0
  mockScenario.expireAccess()
  const request = await api.GET('/me/enrollments')
  expect(request.response.ok).toBe(true)
  expect(mockDb.calls.refreshTokens).toBe(before + 1)
  expect(router.state.location.pathname).toBe('/login')
  const admission = mockScenario.holdNext('requestAdmission')
  terminalPoll.release()
  await waitFor(() => expect(mockDb.calls.requestAdmission).toBe(2))
  expect(router.state.location.pathname).toBe('/login')
  admission.release()
  await waitForPath(router, '/courses')
})

it('갱신 뒤 티켓 재조회 네트워크 실패는 폴링과 잠금을 중단한다', async () => {
  mockScenario.signIn(SEED.student)
  renderApp(`/courses?q=${SEED.course.open}`)
  const row = await courseRow(SEED.course.open)
  const firstPoll = mockScenario.holdNext('getTicket')
  await userEvent.click(row.getByRole('button', { name: '신청' }))
  await waitFor(() => expect(mockDb.calls.getTicket).toBe(1))
  const before = mockDb.calls.refreshTokens ?? 0
  const refresh = mockScenario.holdNext('refreshTokens')
  mockScenario.expireAccess()
  firstPoll.release()
  await waitFor(() => expect(mockDb.calls.refreshTokens).toBe(before + 1))
  mockScenario.failNext('getTicket', 'network')
  refresh.release()
  await waitFor(() => expect(screen.getByTestId('request-outcome')).toHaveTextContent('서버에 연결할 수 없습니다. 다시 시도하세요'), { timeout: 25000 })
  expect(screen.getByTestId('request-outcome')).toHaveAttribute('role', 'alert')
  expect(sessionStorage.getItem('crs.pendingTicket')).toBeNull()
  await waitFor(async () => expect((await courseRow(SEED.course.open)).getByRole('button', { name: '신청' })).toBeEnabled(), { timeout: 25000 })
  const calls = mockDb.calls.getTicket
  await delay(2200)
  expect(mockDb.calls.getTicket).toBe(calls)
}, 40000)

it('입장 확인이 실패하면 의무를 유지하고 다시 시도해 200을 기다린다', async () => {
  resetMockDb({ retryAfterSeconds: 0, waitingPolls: 0 })
  mockScenario.signIn(SEED.student, { admitted: false })
  const firstPoll = mockScenario.holdNext('getTicket')
  const router = renderApp('/login')
  await waitFor(() => expect(mockDb.calls.getTicket).toBe(1), { timeout: 25000 })
  const terminalPoll = mockScenario.holdNext('getTicket')
  firstPoll.release()
  await waitFor(() => expect(mockDb.calls.getTicket).toBe(2), { timeout: 25000 })
  expect(mockDb.calls.requestAdmission).toBe(1)
  const before = mockDb.calls.refreshTokens ?? 0
  mockScenario.expireAccess()
  expect((await api.GET('/me/enrollments')).response.ok).toBe(true)
  expect(mockDb.calls.refreshTokens).toBe(before + 1)
  expect(router.state.location.pathname).toBe('/login')
  mockScenario.failNext('requestAdmission', problem('INTERNAL_ERROR', 500))
  terminalPoll.release()
  await waitFor(() => expect(mockDb.calls.requestAdmission).toBe(2), { timeout: 25000 })
  expect(await screen.findByRole('alert', {}, { timeout: 25000 })).toHaveTextContent('일시적인 오류입니다')
  expect(router.state.location.pathname).toBe('/login')
  await userEvent.click(await screen.findByRole('button', { name: '입장 다시 시도' }, { timeout: 25000 }))
  await waitFor(() => expect(mockDb.calls.requestAdmission).toBe(3), { timeout: 25000 })
  await waitForPath(router, '/courses')
}, 40000)

it('갱신 뒤 티켓 재조회 500은 서버 오류를 표시하고 폴링과 잠금을 중단한다', async () => {
  mockScenario.signIn(SEED.student)
  renderApp(`/courses?q=${SEED.course.open}`)
  const row = await courseRow(SEED.course.open)
  const firstPoll = mockScenario.holdNext('getTicket')
  await userEvent.click(row.getByRole('button', { name: '신청' }))
  await waitFor(() => expect(mockDb.calls.getTicket).toBe(1), { timeout: 25000 })
  const before = mockDb.calls.refreshTokens ?? 0
  const refresh = mockScenario.holdNext('refreshTokens')
  mockScenario.expireAccess()
  firstPoll.release()
  await waitFor(() => expect(mockDb.calls.refreshTokens).toBe(before + 1), { timeout: 25000 })
  mockScenario.failNext('getTicket', problem('INTERNAL_ERROR', 500))
  refresh.release()
  await waitFor(() => expect(screen.getByTestId('request-outcome')).toHaveTextContent('일시적인 오류입니다'), { timeout: 25000 })
  expect(screen.getByTestId('request-outcome')).toHaveAttribute('role', 'alert')
  expect(sessionStorage.getItem('crs.pendingTicket')).toBeNull()
  await waitFor(async () => expect((await courseRow(SEED.course.open)).getByRole('button', { name: '신청' })).toBeEnabled(), { timeout: 25000 })
  const calls = mockDb.calls.getTicket
  await delay(2200)
  expect(mockDb.calls.getTicket).toBe(calls)
}, 40000)

it('갱신 뒤 티켓 재조회 본문 스트림 실패는 네트워크 오류를 표시하고 폴링을 중단한다', async () => {
  let ticketRequests = 0
  const capture = ({ request }: { request: Request }) => {
    if (/\/tickets\/[^/]+$/.test(new URL(request.url).pathname)) ticketRequests += 1
  }
  server.events.on('request:start', capture)
  try {
    mockScenario.signIn(SEED.student)
    renderApp(`/courses?q=${SEED.course.open}`)
    const row = await courseRow(SEED.course.open)
    const firstPoll = mockScenario.holdNext('getTicket')
    await userEvent.click(row.getByRole('button', { name: '신청' }))
    await waitFor(() => expect(mockDb.calls.getTicket).toBe(1), { timeout: 25000 })
    const before = mockDb.calls.refreshTokens ?? 0
    const refresh = mockScenario.holdNext('refreshTokens')
    mockScenario.expireAccess()
    firstPoll.release()
    await waitFor(() => expect(mockDb.calls.refreshTokens).toBe(before + 1), { timeout: 25000 })
    let replayed = false
    server.use(http.get(`${API_BASE_URL}/tickets/:ticketId`, () => {
      replayed = true
      const body = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('drop')) } })
      return new HttpResponse(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
    }, { once: true }))
    refresh.release()
    await waitFor(() => expect(replayed).toBe(true), { timeout: 25000 })
    await waitFor(() => expect(screen.getByTestId('request-outcome')).toHaveTextContent('서버에 연결할 수 없습니다. 다시 시도하세요'), { timeout: 25000 })
    expect(screen.getByTestId('request-outcome')).toHaveAttribute('role', 'alert')
    expect(sessionStorage.getItem('crs.pendingTicket')).toBeNull()
    await waitFor(async () => expect((await courseRow(SEED.course.open)).getByRole('button', { name: '신청' })).toBeEnabled(), { timeout: 25000 })
    const calls = ticketRequests
    await delay(2200)
    expect(ticketRequests).toBe(calls)
  } finally {
    server.events.removeListener('request:start', capture)
  }
}, 40000)

it('티켓 조회 403은 요청 상태를 확인할 수 없다고 표시하고 폴링을 중단한다', async () => {
  mockScenario.signIn(SEED.student)
  renderApp(`/courses?q=${SEED.course.open}`)
  const row = await courseRow(SEED.course.open)
  const firstPoll = mockScenario.holdNext('getTicket')
  await userEvent.click(row.getByRole('button', { name: '신청' }))
  await waitFor(() => expect(mockDb.calls.getTicket).toBe(1), { timeout: 25000 })
  mockScenario.failNext('getTicket', problem('E02', 403, { reason: 'FORBIDDEN' }))
  firstPoll.release()
  await waitFor(() => expect(screen.getByTestId('request-outcome')).toHaveTextContent('요청 상태를 확인할 수 없습니다'), { timeout: 25000 })
  expect(screen.getByTestId('request-outcome')).toHaveAttribute('role', 'alert')
  expect(sessionStorage.getItem('crs.pendingTicket')).toBeNull()
  await waitFor(async () => expect((await courseRow(SEED.course.open)).getByRole('button', { name: '신청' })).toBeEnabled(), { timeout: 25000 })
  const calls = mockDb.calls.getTicket
  await delay(2200)
  expect(mockDb.calls.getTicket).toBe(calls)
}, 40000)

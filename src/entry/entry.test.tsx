import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockDb, resetMockDb } from '@/mocks/db'
import { mockScenario } from '@/mocks/scenario'
import { problem } from '@/mocks/problems'
import { SEED } from '@/mocks/seed'
import { delay, login, waitForPath } from '@/test/flows'
import { renderApp } from '@/test/render'

describe('entry', () => {
  it('T1-01 학생 로그인과 입장을 한 번에 완료한다', async () => {
    resetMockDb({ retryAfterSeconds: 1, waitingPolls: 1 })
    const router = renderApp('/login')
    await login(SEED.student)
    await waitFor(() => expect(screen.getByTestId('entry-status')).toHaveTextContent('로그인 대기 중 · 순번'), { timeout: 25000 })
    await waitFor(() => expect(screen.getByTestId('entry-status')).toHaveTextContent('입장 대기 중 · 순번'), { timeout: 25000 })
    await waitFor(() => expect(router.state.location.pathname).toBe('/courses'), { timeout: 25000 })
  }, 40000)
  it.each([[SEED.professor, '/professor/courses'], [SEED.admin, '/admin/enrollments']])('T1-02 %s 역할 첫 화면', async (id, path) => {
    const router = renderApp('/login')
    await login(id)
    await waitForPath(router, path)
    expect(mockDb.calls.requestAdmission ?? 0).toBe(0)
  })
  it('T1-03 다른 세션 입장 완료 후 현재 세션 입장을 확인한다', async () => {
    mockScenario.seedOtherSessionAdmission(SEED.student)
    const hold = mockScenario.holdNext('requestAdmission')
    const router = renderApp('/login')
    await login(SEED.student)
    await waitFor(() => expect(mockDb.calls.requestAdmission).toBe(1))
    expect(router.state.location.pathname).toBe('/login')
    const secondAdmission = mockScenario.holdNext('requestAdmission')
    hold.release()
    await waitFor(() => expect(mockDb.calls.requestAdmission).toBe(2))
    expect(router.state.location.pathname).toBe('/login')
    secondAdmission.release()
    await waitForPath(router, '/courses')
    expect(mockDb.calls.requestAdmission).toBe(3)
  })
  it('T1-04 잘못된 비밀번호를 알린다', async () => {
    const router = renderApp('/login')
    await login(SEED.student, 'wrong')
    expect(await screen.findByRole('alert', {}, { timeout: 10000 })).toHaveTextContent('아이디나 비밀번호가 맞지 않거나 대기 시간이 지났습니다')
    expect(router.state.location.pathname).toBe('/login')
  })
  it('T1-05 진행 중인 로그인 티켓을 이어받는다', async () => {
    resetMockDb({ retryAfterSeconds: 1, waitingPolls: 1 })
    mockScenario.seedPendingLogin(SEED.student)
    const router = renderApp('/login')
    await login(SEED.student)
    await waitFor(() => expect(screen.getByTestId('entry-status')).toHaveTextContent('진행 중인 요청이 있습니다'), { timeout: 25000 })
    await waitFor(() => expect(router.state.location.pathname).toBe('/courses'), { timeout: 25000 })
  }, 40000)
  it('T1-10 StrictMode에서 토큰을 한 번만 수령한다', async () => {
    const router = renderApp('/login', { strict: true })
    await login(SEED.professor)
    await waitForPath(router, '/professor/courses')
    expect(mockDb.calls.exchangeLoginTokens).toBe(1)
  })
  it('T1-11 소비된 로그인 수령은 폼으로 돌아간다', async () => {
    mockScenario.failNext('exchangeLoginTokens', problem('E02', 403, { reason: 'LOGIN_EXCHANGE_CONSUMED' }))
    renderApp('/login')
    await login(SEED.professor)
    expect(await screen.findByRole('alert', {}, { timeout: 10000 })).toHaveTextContent('이미 처리된 로그인입니다. 다시 로그인하세요')
  })
  it('T1-12 로그인 증명 유실 시 기록을 지우고 폴링을 중단한다', async () => {
    const hold = mockScenario.holdNext('getTicket')
    renderApp('/login')
    await login(SEED.student)
    await waitFor(() => expect(mockDb.calls.getTicket).toBe(1))
    mockScenario.dropLoginProof()
    hold.release()
    expect(await screen.findByRole('alert')).toHaveTextContent('로그인 요청을 확인할 수 없습니다. 다시 로그인하세요')
    expect(sessionStorage.getItem('crs.pendingTicket')).toBeNull()
    expect(await screen.findByRole('button', { name: '로그인' })).toBeEnabled()
    const calls = mockDb.calls.getTicket
    await delay(50)
    expect(mockDb.calls.getTicket).toBe(calls)
  })
})

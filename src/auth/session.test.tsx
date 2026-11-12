import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { queryClient } from '@/app/queryClient'
import { getAuth } from '@/auth/session'
import { mockDb } from '@/mocks/db'
import { mockScenario } from '@/mocks/scenario'
import { delay, login, waitForPath } from '@/test/flows'
import { server } from '@/mocks/server'
import { SEED } from '@/mocks/seed'
import { renderApp } from '@/test/render'

it('T1-13 로그아웃 후 늦은 응답이 세션과 캐시를 복구하지 않는다', async () => {
  mockScenario.signIn(SEED.student)
  const hold = mockScenario.holdNext('searchCourses')
  const router = renderApp('/courses')
  await waitFor(() => expect(mockDb.calls.searchCourses).toBe(1))
  await userEvent.click(await screen.findByRole('button', { name: '로그아웃' }))
  await waitForPath(router, '/login')
  hold.release()
  await delay(50)
  await waitFor(() => expect(getAuth().status).toBe('anonymous'))
  expect(router.state.location.pathname).toBe('/login')
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
})
it('T1-14 웹 저장소에 토큰을 보관하지 않는다', async () => {
  mockScenario.signIn(SEED.student)
  const router = renderApp('/courses')
  await waitForPath(router, '/courses')
  await screen.findByTestId('current-user')
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of Object.keys(storage)) {
      expect(['crs.pendingTicket', 'crs.refreshUncertainAt']).toContain(key)
      expect(storage.getItem(key)).not.toMatch(/[\w-]+\.[\w-]+\.[\w-]+/)
    }
  }
})

it('T1-15 모든 요청은 credentials와 쿠키 연산 CSRF 헤더를 보낸다', async () => {
  const requests: Request[] = []
  const capture = ({ request }: { request: Request }) => requests.push(request)
  server.events.on('request:start', capture)
  try {
    const router = renderApp('/login')
    await login(SEED.professor)
    await waitForPath(router, '/professor/courses')
    await userEvent.click(await screen.findByRole('button', { name: '로그아웃' }))
    await waitForPath(router, '/login')
    await waitFor(() => expect(requests.some((r) => r.url.endsWith('/auth/logout'))).toBe(true))
    expect(requests.every((r) => r.credentials === 'include')).toBe(true)
    const cookieRequests = requests.filter((r) => /\/auth\/(login|refresh|logout|login-tickets\/[^/]+\/tokens)$/.test(new URL(r.url).pathname))
    for (const operation of [
      /\/auth\/login$/,
      /\/auth\/login-tickets\/[^/]+\/tokens$/,
      /\/auth\/refresh$/,
      /\/auth\/logout$/,
    ]) {
      expect(cookieRequests.some((request) => operation.test(new URL(request.url).pathname))).toBe(true)
    }
    for (const request of cookieRequests) expect(request.headers.get('X-CSRF-Protection')).toBe('1')
  } finally {
    server.events.removeListener('request:start', capture)
  }
})

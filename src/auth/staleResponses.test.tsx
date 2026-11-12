import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { expect, it } from 'vitest'
import { API_BASE_URL } from '@/api/baseUrl'
import { mockDb } from '@/mocks/db'
import { problem } from '@/mocks/problems'
import { mockScenario } from '@/mocks/scenario'
import { SEED } from '@/mocks/seed'
import { server } from '@/mocks/server'
import { delay, login, waitForPath } from '@/test/flows'
import { renderApp } from '@/test/render'

it('늦은 E15 본문은 로그아웃 후 새 학생 세션의 입장을 지우지 않는다', async () => {
  mockScenario.signIn(SEED.student)
  const router = renderApp(`/courses/${SEED.course.open}`)
  await screen.findByRole('button', { name: '새로고침' }, { timeout: 25000 })
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  server.use(http.get(`${API_BASE_URL}/courses/${SEED.course.open}`, () => {
    const body = new ReadableStream<Uint8Array>({ start(stream) { controller = stream } })
    return new HttpResponse(body, { status: 409, headers: { 'Content-Type': 'application/problem+json' } })
  }, { once: true }))
  await userEvent.click(await screen.findByRole('button', { name: '새로고침' }))
  await waitFor(() => expect(controller).toBeDefined(), { timeout: 25000 })
  await userEvent.click(await screen.findByRole('button', { name: '로그아웃' }))
  await waitForPath(router, '/login')
  await login(SEED.student2)
  await waitForPath(router, '/courses')
  controller!.enqueue(new TextEncoder().encode(JSON.stringify(problem('E15', 409))))
  controller!.close()
  await delay(100)
  expect(router.state.location.pathname).toBe('/courses')
  expect(await screen.findByTestId('current-user')).toBeInTheDocument()
}, 40000)

it('새 로그인 후 늦은 갱신 네트워크 오류는 불확실 표시를 남기지 않는다', async () => {
  mockScenario.signIn(SEED.student)
  const router = renderApp(`/courses/${SEED.course.open}`)
  await screen.findByRole('button', { name: '새로고침' }, { timeout: 25000 })
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  let started = false
  server.use(http.post(`${API_BASE_URL}/auth/refresh`, async () => {
    started = true
    await gate
    return HttpResponse.error()
  }, { once: true }))
  mockScenario.expireAccess()
  await userEvent.click(await screen.findByRole('button', { name: '새로고침' }))
  await waitFor(() => expect(started).toBe(true), { timeout: 25000 })
  await userEvent.click(await screen.findByRole('button', { name: '로그아웃' }))
  await waitForPath(router, '/login')
  await login(SEED.student2)
  await waitForPath(router, '/courses')
  release()
  await delay(100)
  expect(localStorage.getItem('crs.refreshUncertainAt')).toBeNull()
  await router.navigate(`/courses/${SEED.course.open}`)
  await screen.findByRole('button', { name: '새로고침' }, { timeout: 25000 })
  const before = mockDb.calls.refreshTokens ?? 0
  mockScenario.expireAccess()
  await userEvent.click(await screen.findByRole('button', { name: '새로고침' }))
  await waitFor(() => expect(mockDb.calls.refreshTokens).toBe(before + 1), { timeout: 25000 })
  expect(router.state.location.pathname).toBe(`/courses/${SEED.course.open}`)
  expect(localStorage.getItem('crs.refreshUncertainAt')).toBeNull()
}, 40000)

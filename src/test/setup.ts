import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeEach, vi } from 'vitest'
import { resetMockDb } from '@/mocks/db'
import { server } from '@/mocks/server'
configure({ asyncUtilTimeout: 5000 })

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: query.includes('prefers-reduced-motion'), media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(),
    removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })),
})
server.listen({ onUnhandledRequest: 'error' })
// The client captures fetch at import time, so MSW must listen before loading it.
const { resetAppStateForTests } = await import('@/app/resetForTests')
beforeEach(() => resetMockDb({ retryAfterSeconds: 0 }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetAppStateForTests()
  sessionStorage.clear()
  localStorage.clear()
})
afterAll(() => server.close())

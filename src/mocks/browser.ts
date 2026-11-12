import { setupWorker } from 'msw/browser'
import { mockDb, resetMockDb } from './db'
import { handlers } from './handlers/index'
import { mockScenario } from './scenario'

declare global {
  interface Window {
    /** `pnpm dev:mock` console controls, e.g. `__crsMock.scenario.expireAccess()`. */
    __crsMock?: {
      scenario: typeof mockScenario
      db: typeof mockDb
      reset: typeof resetMockDb
    }
  }
}

export const worker = setupWorker(...handlers)

window.__crsMock = { scenario: mockScenario, db: mockDb, reset: resetMockDb }

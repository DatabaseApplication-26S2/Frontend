import type { HttpHandler } from 'msw'
import { adminHandlers } from './admin'
import { admissionHandlers } from './admission'
import { authHandlers } from './auth'
import { courseHandlers } from './courses'
import { enrollmentHandlers } from './enrollments'
import { professorHandlers } from './professor'
import { ticketHandlers } from './tickets'

/** All 20 contract operations under `${API_BASE_URL}` (openapi.yaml 0.1.0). */
export const handlers: HttpHandler[] = [
  ...authHandlers,
  ...admissionHandlers,
  ...ticketHandlers,
  ...courseHandlers,
  ...enrollmentHandlers,
  ...professorHandlers,
  ...adminHandlers,
]

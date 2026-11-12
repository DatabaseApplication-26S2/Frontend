import type { HttpHandler } from 'msw'
import type { components } from '@/api/schema'
import { apiPath, createTicket, receiptHeaders, unfinishedTicketOf } from '../db'
import { authorize } from '../jwt'
import {
  bodylessViolations,
  invalidInput,
  jsonResponse,
  problem,
  problemResponse,
} from '../problems'
import { operation } from '../scenario'

type Schemas = components['schemas']

export const admissionHandlers: HttpHandler[] = [
  // Access(401) → STUDENT(403) → no body(400 E09) → this session already admitted(200, even with
  // an unfinished ticket) → the user's unfinished ticket(409 E03) → ADMISSION ticket(202).
  operation('requestAdmission', 'post', '/admission', async ({ request, url }) => {
    const gate = authorize(request, 'STUDENT')
    if ('response' in gate) return gate.response
    const { auth } = gate
    const violations = await bodylessViolations(request, url)
    if (violations.length > 0) return invalidInput(violations)

    if (auth.session.admittedAt !== null) {
      return jsonResponse(
        { admittedAt: auth.session.admittedAt } satisfies Schemas['AdmissionState'],
        200,
      )
    }
    const pending = unfinishedTicketOf(auth.user.userId)
    if (pending) {
      return problemResponse(problem('E03', 409, { activeTicketId: pending.ticketId }))
    }

    const ticket = createTicket({
      requestType: 'ADMISSION',
      courseCode: null,
      userId: auth.user.userId,
      sid: auth.session.sid,
    })
    return jsonResponse(
      {
        ticketId: ticket.ticketId,
        requestType: 'ADMISSION',
        status: 'WAITING',
        submittedAt: ticket.submittedAt,
        statusUrl: apiPath(`/tickets/${ticket.ticketId}`),
      } satisfies Schemas['TicketReceipt'],
      202,
      receiptHeaders(ticket),
    )
  }),
]

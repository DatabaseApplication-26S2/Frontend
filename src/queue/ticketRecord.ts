import type { TicketRequestType } from '@/api/types'

// D-12 진행 중 티켓 기록(계획 4.5). sessionStorage에 티켓 번호·유형·과목코드만 둔다. 토큰 값은 넣지 않는다.
export const PENDING_TICKET_KEY = 'crs.pendingTicket'

export interface PendingTicketRecord {
  ticketId: string
  requestType: TicketRequestType
  courseCode: string | null
}

const REQUEST_TYPES: readonly TicketRequestType[] = ['LOGIN', 'ADMISSION', 'ENROLLMENT', 'CANCELLATION']

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

function isRequestType(value: unknown): value is TicketRequestType {
  return REQUEST_TYPES.some((type) => type === value)
}

function isPendingTicketRecord(value: unknown): value is PendingTicketRecord {
  if (typeof value !== 'object' || value === null) return false
  if (!('ticketId' in value) || !('requestType' in value) || !('courseCode' in value)) return false
  const { ticketId, requestType, courseCode } = value
  return (
    typeof ticketId === 'string' &&
    isRequestType(requestType) &&
    (courseCode === null || typeof courseCode === 'string')
  )
}

export function readTicketRecord(): PendingTicketRecord | null {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(PENDING_TICKET_KEY)
    if (raw === null) return null
    const value: unknown = JSON.parse(raw)
    if (isPendingTicketRecord(value)) {
      return { ticketId: value.ticketId, requestType: value.requestType, courseCode: value.courseCode }
    }
    store.removeItem(PENDING_TICKET_KEY)
  } catch {
    // 읽을 수 없는 기록은 없는 것으로 본다.
  }
  return null
}

export function saveTicketRecord(record: PendingTicketRecord): void {
  const { ticketId, requestType, courseCode } = record
  try {
    storage()?.setItem(PENDING_TICKET_KEY, JSON.stringify({ ticketId, requestType, courseCode }))
  } catch {
    // 저장소를 쓸 수 없으면 새로고침 복구만 잃는다.
  }
}

/** ticketId를 주면 그 티켓의 기록일 때만 지운다(더 새 기록을 지우지 않게). */
export function clearTicketRecord(ticketId?: string): void {
  const store = storage()
  if (!store) return
  try {
    if (ticketId !== undefined && readTicketRecord()?.ticketId !== ticketId) return
    store.removeItem(PENDING_TICKET_KEY)
  } catch {
    // 무시
  }
}

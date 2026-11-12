import { useSyncExternalStore } from 'react'
import { ApiError, api, StaleAuthError, unwrapResponse } from '@/api/client'
import {
  ACTIVE_TICKET_RETRY_MESSAGE,
  ADMISSION_REQUIRED_MESSAGE,
  TICKET_FORBIDDEN_MESSAGE,
  problemMessage,
  ticketResultMessage,
} from '@/api/messages'
import type { TicketReceipt, TicketRequestType, TicketStatus } from '@/api/types'
import { queryClient } from '@/app/queryClient'
import { markAdmissionRequired } from '@/auth/session'
import { onSessionCleared } from '@/auth/tokenStore'
import { queueStatusText, type QueueContext } from '@/queue/statusText'
import { pollDelayMs, pollTicket } from '@/queue/ticketPoller'
import {
  clearTicketRecord,
  saveTicketRecord,
  type PendingTicketRecord,
} from '@/queue/ticketRecord'

// 신청·취소 흐름(계획 4.2, 설계 3.4절). 사용자당 미완료 요청은 1건이라(INV-5) 접수 중과
// 미완료 티켓이 있는 동안 모든 신청·취소 버튼을 잠근다. 모듈 상태라 화면을 옮겨도 이어진다.

export interface ActiveRequest {
  ticketId: string
  requestType: TicketRequestType // 이어받은 티켓이면 ADMISSION일 수 있다
  courseCode: string | null
  statusText: string
  adopted: boolean
}

export interface RequestOutcome {
  id: number // 결과마다 증가
  courseCode: string | null
  tone: 'success' | 'error' | 'info'
  message: string
}

export interface RequestFlowView {
  active: ActiveRequest | null
  outcome: RequestOutcome | null
  locked: boolean
}

const INITIAL: RequestFlowView = { active: null, outcome: null, locked: false }

let view: RequestFlowView = INITIAL
let submitting = false
let run = 0
let outcomeSeq = 0
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getView(): RequestFlowView {
  return view
}

function publish(patch: { active?: ActiveRequest | null; outcome?: RequestOutcome | null }): void {
  const active = patch.active === undefined ? view.active : patch.active
  const outcome = patch.outcome === undefined ? view.outcome : patch.outcome
  view = { active, outcome, locked: submitting || active !== null }
  for (const listener of listeners) listener()
}

function showOutcome(courseCode: string | null, tone: RequestOutcome['tone'], message: string): void {
  outcomeSeq += 1
  publish({ outcome: { id: outcomeSeq, courseCode, tone, message } })
}

/** 결과와 무관하게 과목 목록, 해당 과목 상세, 내 신청 내역을 다시 조회한다(계획 4.2 3번, 5.4). */
function invalidateEnrollmentViews(courseCode: string | null): void {
  void queryClient.invalidateQueries({ queryKey: ['courses'] })
  if (courseCode !== null) void queryClient.invalidateQueries({ queryKey: ['course', courseCode] })
  void queryClient.invalidateQueries({ queryKey: ['me', 'enrollments'] })
}

// 로그아웃·세션 종료·사용자 전환: 진행 표시와 잠금을 푼다(티켓 기록은 세션 쪽이 지운다).
onSessionCleared(() => {
  run += 1
  submitting = false
  view = INITIAL
  for (const listener of listeners) listener()
})

export function useRequestFlow(): RequestFlowView {
  return useSyncExternalStore(subscribe, getView, getView)
}

/** locked면 무시한다. */
export function requestEnrollment(courseCode: string): void {
  if (view.locked) return
  void submit('ENROLLMENT', courseCode)
}

/** locked면 무시한다. */
export function requestCancellation(courseCode: string): void {
  if (view.locked) return
  void submit('CANCELLATION', courseCode)
}

export function dismissOutcome(): void {
  if (view.outcome !== null) publish({ outcome: null })
}

/** 부트스트랩이 인증 + ENROLLMENT·CANCELLATION 기록일 때 부른다(새로고침 복구, 계획 4.5). */
export function resumeRequestTicket(record: PendingTicketRecord): void {
  if (view.locked) return
  void track(record.ticketId, {
    requestType: record.requestType,
    courseCode: record.courseCode,
    adopted: false,
    initialDelayMs: 0,
    receiptStatus: 'RECEIVED',
    myRun: run,
  })
}

type RequestKind = 'ENROLLMENT' | 'CANCELLATION'

/** 신청은 POST /me/enrollments, 취소는 DELETE /me/enrollments/{courseCode}. 202 접수증과 첫 조회 대기를 돌려준다. */
async function sendRequest(
  requestType: RequestKind,
  courseCode: string,
): Promise<{ receipt: TicketReceipt; delayMs: number }> {
  const { data, response } =
    requestType === 'ENROLLMENT'
      ? await unwrapResponse(api.POST('/me/enrollments', { body: { courseCode } }))
      : await unwrapResponse(
          api.DELETE('/me/enrollments/{courseCode}', { params: { path: { courseCode } } }),
        )
  return { receipt: data, delayMs: pollDelayMs(response.headers.get('Retry-After')) }
}

async function submit(requestType: RequestKind, courseCode: string): Promise<void> {
  const myRun = run
  submitting = true
  publish({ outcome: null })
  let accepted: { receipt: TicketReceipt; delayMs: number }
  try {
    accepted = await sendRequest(requestType, courseCode)
  } catch (error) {
    if (myRun !== run) return
    const activeTicketId =
      error instanceof ApiError && error.code === 'E03' ? error.problem?.activeTicketId : undefined
    if (activeTicketId) {
      // 미완료 티켓 이어받기. 판단은 조회 응답의 requestType·courseCode로 한다. 잠금은 그대로 이어진다.
      void track(activeTicketId, {
        requestType,
        courseCode: null,
        adopted: true,
        initialDelayMs: 0,
        receiptStatus: 'RECEIVED',
        myRun,
      })
      return
    }
    submitting = false
    publish({})
    if (error instanceof StaleAuthError) return
    if (error instanceof ApiError && error.code === 'E03') {
      showOutcome(courseCode, 'info', ACTIVE_TICKET_RETRY_MESSAGE)
      return
    }
    if (error instanceof ApiError && error.code === 'E15') {
      // admittedAt 삭제는 authFetch가 이미 했다(설계 3.3절 7번).
      showOutcome(courseCode, 'error', ADMISSION_REQUIRED_MESSAGE)
      return
    }
    const message = problemMessage(error)
    if (message !== null) showOutcome(courseCode, 'error', message)
    return
  }
  if (myRun !== run) return
  const { receipt, delayMs } = accepted
  saveTicketRecord({ ticketId: receipt.ticketId, requestType, courseCode })
  await track(receipt.ticketId, {
    requestType,
    courseCode,
    adopted: false,
    initialDelayMs: delayMs,
    receiptStatus: receipt.status,
    myRun,
  })
}

interface TrackOptions {
  requestType: TicketRequestType
  courseCode: string | null
  adopted: boolean
  initialDelayMs: number
  receiptStatus: TicketStatus
  myRun: number
}

async function track(ticketId: string, options: TrackOptions): Promise<void> {
  const { adopted, myRun } = options
  const ctx: QueueContext = adopted ? 'adopted' : 'request'
  let courseCode = options.courseCode
  submitting = false
  publish({
    active: {
      ticketId,
      requestType: options.requestType,
      courseCode,
      statusText: queueStatusText(ctx, options.receiptStatus, null),
      adopted,
    },
  })

  const result = await pollTicket(ticketId, {
    initialDelayMs: options.initialDelayMs,
    onUpdate: (ticket) => {
      if (myRun !== run) return
      courseCode = ticket.courseCode
      if (ticket.requestType === 'ENROLLMENT' || ticket.requestType === 'CANCELLATION') {
        saveTicketRecord({ ticketId, requestType: ticket.requestType, courseCode: ticket.courseCode })
      }
      publish({
        active: {
          ticketId,
          requestType: ticket.requestType,
          courseCode: ticket.courseCode,
          statusText: queueStatusText(ctx, ticket.status, ticket.queuePosition),
          adopted,
        },
      })
    },
  })
  if (myRun !== run) return

  if (result.kind === 'stopped') {
    publish({ active: null })
    return
  }
  clearTicketRecord(ticketId)
  if (result.kind === 'denied') {
    // 403·400 또는 갱신 뒤 재조회 실패: 폴링 중단, 기록 삭제, 잠금 해제, 목록 재조회(계획 4.3).
    // 403·400은 4.3 문구, 그 밖(500·연결 실패)은 그 오류의 문구다.
    publish({ active: null })
    const failure = problemMessage(result.error, 'ticket') ?? TICKET_FORBIDDEN_MESSAGE
    showOutcome(courseCode, 'error', failure)
    invalidateEnrollmentViews(courseCode)
    return
  }

  const { ticket } = result
  const code = ticket.result?.code ?? 'E99'
  if (code === 'E15') markAdmissionRequired()
  publish({ active: null })
  const message = ticketResultMessage(ticket.requestType, code)
  if (message !== null) showOutcome(ticket.courseCode, code === 'OK' ? 'success' : 'error', message)
  invalidateEnrollmentViews(ticket.courseCode)
}

export function resetRequestFlowForTests(): void {
  run += 1
  submitting = false
  view = INITIAL
  for (const listener of listeners) listener()
}

import type { TicketStatus } from '@/api/types'

export type QueueContext = 'login' | 'admission' | 'request' | 'adopted'

const WAITING_PREFIX: Record<QueueContext, string> = {
  login: '로그인 대기 중',
  admission: '입장 대기 중',
  request: '대기 중',
  adopted: '진행 중인 요청이 있습니다',
}

const PROCESSING_TEXT: Record<QueueContext, string> = {
  login: '처리 중',
  admission: '처리 중',
  request: '처리 중',
  adopted: '진행 중인 요청이 있습니다 · 처리 중',
}

/** 순번은 참고값이다. 예상 소요 시간이나 완료 순서를 뜻하지 않는다(계획 4.3). */
export function queueStatusText(
  ctx: QueueContext,
  status: TicketStatus,
  position: number | null,
): string {
  if (status === 'RECEIVED' || status === 'WAITING') {
    const prefix = WAITING_PREFIX[ctx]
    return status === 'WAITING' && position !== null ? `${prefix} · 순번 ${position}` : prefix
  }
  // PROCESSING, 그리고 결과를 처리하기 직전의 종결 상태
  return PROCESSING_TEXT[ctx]
}

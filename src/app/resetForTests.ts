import { resetRequestFlowForTests } from '@/enrollments/requestFlow'
import { resetEntryFlowForTests } from '@/entry/entryFlow'
import { resetRefreshForTests } from '@/auth/refresh'
import { resetSessionForTests } from '@/auth/session'
import { resetTokenStoreForTests } from '@/auth/tokenStore'
import { cancelAllPolls } from '@/queue/ticketPoller'
import { queryClient } from './queryClient'

/**
 * 테스트 사이 초기화: 토큰·인증 세대·모듈 Promise(부트스트랩·갱신·토큰 수령)·세 스토어(인증·진입·신청)를
 * 처음 상태로 되돌리고 진행 중인 폴링을 멈춘 뒤 질의 캐시를 비운다. 웹 저장소는 건드리지 않는다
 * (새로고침 복구 테스트가 기록을 남긴 채 다시 렌더한다).
 */
export function resetAppStateForTests(): void {
  resetTokenStoreForTests()
  cancelAllPolls()
  resetRefreshForTests()
  resetEntryFlowForTests()
  resetRequestFlowForTests()
  resetSessionForTests()
  queryClient.clear()
}

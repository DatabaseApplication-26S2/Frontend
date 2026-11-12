import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AppProviders } from '@/app/AppProviders'
import { router } from './routes'
import './index.css'

// MSW는 VITE_USE_MOCK === 'true'일 때만 켠다(pnpm dev:mock). 워커가 준비된 뒤 렌더해야
// AppProviders의 부트스트랩 갱신(POST /auth/refresh)이 모의 서버로 간다.
async function enableMocking(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCK !== 'true') return
  // 동적 가져오기: mock 모드가 아니면 MSW와 핸들러를 실서버용 번들에 넣지 않는다.
  const { worker } = await import('./mocks/browser')
  // quiet: 워커가 요청·응답(Authorization 헤더, TokenResponse 본문 포함)을 콘솔에 남기지 않게 한다(계획 3절 1번).
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
  // 브라우저는 오래 숨겨진 탭의 서비스 워커를 종료한다(타이머 제한으로 MSW keepalive가 끊긴다).
  // 다시 켜진 워커는 이 탭을 모의 대상에서 잊어 요청을 실제 네트워크로 흘리고, 백엔드가 없으니
  // Vite 프록시의 500이 "일시적인 오류입니다"로 보인다. 탭이 다시 보이면 등록을 다시 알린다.
  // 'MOCK_ACTIVATE'는 msw 2.15.0 public/mockServiceWorker.js의 메시지이며, 이미 등록됐으면 효과가 없다.
  const reactivate = () => {
    if (document.visibilityState === 'visible')
      navigator.serviceWorker.controller?.postMessage('MOCK_ACTIVATE')
  }
  document.addEventListener('visibilitychange', reactivate)
  window.addEventListener('focus', reactivate)
}

void enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  )
})

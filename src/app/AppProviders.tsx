import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, type JSX, type ReactNode } from 'react'
import { bootstrapAuth } from '@/auth/refresh'
import { Toaster } from '@/components/ui/sonner'
import { queryClient } from './queryClient'

export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  // 부트스트랩 갱신은 모듈 수준 Promise 하나다. StrictMode의 이중 효과에도 요청은 1회다(계획 3절 4번).
  useEffect(() => {
    void bootstrapAuth()
  }, [])
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  )
}

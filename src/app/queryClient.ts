import { QueryClient } from '@tanstack/react-query'

// 앱 전체의 단일 인스턴스. 질의·변경 모두 자동 재시도를 하지 않는다(계획 5.5).
export const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { api, unwrap, type ApiError, type NetworkError, type StaleAuthError } from '@/api/client'
import type { MyEnrollmentList } from '@/api/types'

type E = ApiError | NetworkError | StaleAuthError

/** ['me', 'enrollments'] */
export function useMyEnrollments(): UseQueryResult<MyEnrollmentList, E> {
  return useQuery<MyEnrollmentList, E>({
    queryKey: ['me', 'enrollments'],
    queryFn: () => unwrap(api.GET('/me/enrollments')),
  })
}

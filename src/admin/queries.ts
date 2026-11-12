import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { api, unwrap, type ApiError, type NetworkError, type StaleAuthError } from '@/api/client'
import type {
  AdminEnrollmentRequest,
  AdminEnrollmentResult,
  ClosureCandidatePage,
  CourseClosureBatchResult,
  ServiceSettings,
  ServiceSettingsUpdateRequest,
} from '@/api/types'

type E = ApiError | NetworkError | StaleAuthError

/** 관리자 배정. 성공하면 과목 목록·해당 과목 상세·폐강 대상을 무효화한다(계획 5.4). */
export function useAdminEnroll(): UseMutationResult<AdminEnrollmentResult, E, AdminEnrollmentRequest> {
  const client = useQueryClient()
  return useMutation<AdminEnrollmentResult, E, AdminEnrollmentRequest>({
    mutationFn: (body) => unwrap(api.POST('/admin/enrollments', { body })),
    onSuccess: (_result, { courseCode }) => {
      void client.invalidateQueries({ queryKey: ['courses'] })
      void client.invalidateQueries({ queryKey: ['course', courseCode] })
      void client.invalidateQueries({ queryKey: ['admin', 'closure-candidates'] })
    },
  })
}

/** ['admin', 'settings'] */
export function useServiceSettings(): UseQueryResult<ServiceSettings, E> {
  return useQuery<ServiceSettings, E>({
    queryKey: ['admin', 'settings'],
    queryFn: () => unwrap(api.GET('/admin/settings')),
  })
}

/** 설정 변경. 응답으로 ['admin', 'settings']를 갱신한다. */
export function useUpdateServiceSettings(): UseMutationResult<
  ServiceSettings,
  E,
  ServiceSettingsUpdateRequest
> {
  const client = useQueryClient()
  return useMutation<ServiceSettings, E, ServiceSettingsUpdateRequest>({
    mutationFn: (body) => unwrap(api.PUT('/admin/settings', { body })),
    onSuccess: (settings) => client.setQueryData(['admin', 'settings'], settings),
  })
}

/** ['admin', 'closure-candidates', page] */
export function useClosureCandidates(page: number): UseQueryResult<ClosureCandidatePage, E> {
  return useQuery<ClosureCandidatePage, E>({
    queryKey: ['admin', 'closure-candidates', page],
    queryFn: () => unwrap(api.GET('/admin/closure-candidates', { params: { query: { page } } })),
  })
}

/** 일괄 폐강. 폐강 대상·과목 목록·과목 상세 전체를 무효화한다. */
export function useCloseCourses(): UseMutationResult<CourseClosureBatchResult, E, string[]> {
  const client = useQueryClient()
  return useMutation<CourseClosureBatchResult, E, string[]>({
    mutationFn: (courseCodes) =>
      unwrap(api.POST('/admin/course-closures', { body: { courseCodes } })),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin', 'closure-candidates'] })
      void client.invalidateQueries({ queryKey: ['courses'] })
      void client.invalidateQueries({ queryKey: ['course'] })
    },
  })
}

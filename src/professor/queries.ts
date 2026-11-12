import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { api, unwrap, type ApiError, type NetworkError, type StaleAuthError } from '@/api/client'
import type {
  Course,
  CourseClosureResult,
  CourseCreateRequest,
  CourseList,
  CourseUpdateRequest,
} from '@/api/types'

type E = ApiError | NetworkError | StaleAuthError

/** 과목 등록·수정·폐강 뒤 무효화(계획 5.4). 상세는 수정·폐강일 때만. */
function invalidateCourseViews(client: QueryClient, courseCode?: string): void {
  void client.invalidateQueries({ queryKey: ['professor', 'courses'] })
  void client.invalidateQueries({ queryKey: ['courses'] })
  if (courseCode !== undefined) void client.invalidateQueries({ queryKey: ['course', courseCode] })
  void client.invalidateQueries({ queryKey: ['admin', 'closure-candidates'] })
}

/** ['professor', 'courses'] */
export function useProfessorCourses(): UseQueryResult<CourseList, E> {
  return useQuery<CourseList, E>({
    queryKey: ['professor', 'courses'],
    queryFn: () => unwrap(api.GET('/professor/courses')),
  })
}

export function useCreateCourse(): UseMutationResult<Course, E, CourseCreateRequest> {
  const client = useQueryClient()
  return useMutation<Course, E, CourseCreateRequest>({
    mutationFn: (body) => unwrap(api.POST('/professor/courses', { body })),
    onSuccess: () => invalidateCourseViews(client),
  })
}

export function useUpdateCourse(): UseMutationResult<
  Course,
  E,
  { courseCode: string; body: CourseUpdateRequest }
> {
  const client = useQueryClient()
  return useMutation<Course, E, { courseCode: string; body: CourseUpdateRequest }>({
    mutationFn: ({ courseCode, body }) =>
      unwrap(api.PUT('/professor/courses/{courseCode}', { params: { path: { courseCode } }, body })),
    onSuccess: (_course, { courseCode }) => invalidateCourseViews(client, courseCode),
  })
}

export function useCloseCourse(): UseMutationResult<CourseClosureResult, E, string> {
  const client = useQueryClient()
  return useMutation<CourseClosureResult, E, string>({
    mutationFn: (courseCode) =>
      unwrap(
        api.POST('/professor/courses/{courseCode}/closure', { params: { path: { courseCode } } }),
      ),
    onSuccess: (_result, courseCode) => invalidateCourseViews(client, courseCode),
  })
}

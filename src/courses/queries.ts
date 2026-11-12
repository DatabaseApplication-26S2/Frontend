import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { api, unwrap, type ApiError, type NetworkError, type StaleAuthError } from '@/api/client'
import type { Course, CourseCategoryFilter, CoursePage } from '@/api/types'

type E = ApiError | NetworkError | StaleAuthError

export interface CourseSearchParams {
  category: CourseCategoryFilter
  q: string
  page: number
}

/** ['courses', {category, q, page}]. category ALL과 빈 q는 쿼리에서 뺀다. 페이지 인자는 page뿐이다. */
export function useCourseSearch(params: CourseSearchParams): UseQueryResult<CoursePage, E> {
  const { category, q, page } = params
  return useQuery<CoursePage, E>({
    queryKey: ['courses', { category, q, page }],
    queryFn: () =>
      unwrap(
        api.GET('/courses', {
          params: {
            query: {
              page,
              ...(category === 'ALL' ? {} : { category }),
              ...(q === '' ? {} : { q }),
            },
          },
        }),
      ),
  })
}

/** ['course', courseCode] */
export function useCourse(courseCode: string): UseQueryResult<Course, E> {
  return useQuery<Course, E>({
    queryKey: ['course', courseCode],
    queryFn: () =>
      unwrap(api.GET('/courses/{courseCode}', { params: { path: { courseCode } } })),
  })
}

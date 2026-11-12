import { useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Search } from 'lucide-react'
import {
  CATEGORY_FILTER_LABEL,
  CATEGORY_LABEL,
  COURSE_STATUS_LABEL,
  EVALUATION_LABEL,
} from '@/api/labels'
import type { CourseCategoryFilter } from '@/api/types'
import { useAuth } from '@/auth/session'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Pagination } from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RequestActionButton, RequestStatus } from '@/enrollments/RequestStatus'
import { useRequestFlow } from '@/enrollments/requestFlow'
import { EmptyState, ErrorState, LoadingState } from '@/layout/PageStates'
import { inlineLinkClass } from '@/layout/styles'
import { useCourseSearch, type CourseSearchParams } from './queries'

const CATEGORY_FILTERS: CourseCategoryFilter[] = ['ALL', 'GENERAL', 'MAJOR']

/** The URL query is the source of truth: `category` (omitted = ALL), `q`, `page` (omitted = 1). */
function readSearch(params: URLSearchParams): CourseSearchParams {
  const category = params.get('category')
  const page = Number(params.get('page'))
  return {
    category: category === 'GENERAL' || category === 'MAJOR' ? category : 'ALL',
    q: params.get('q') ?? '',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  }
}

function writeSearch({ category, q, page }: CourseSearchParams): URLSearchParams {
  const params = new URLSearchParams()
  if (category !== 'ALL') params.set('category', category)
  if (q) params.set('q', q)
  if (page > 1) params.set('page', String(page))
  return params
}

/** `/courses`: filter, the student's request status, the course table and paging. */
export function CoursesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const params = readSearch(searchParams)
  const search = useCourseSearch(params)
  const { user } = useAuth()
  const { active, locked } = useRequestFlow()
  const isStudent = user?.role === 'STUDENT'

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h1>과목 검색</h1>
        </CardTitle>
        <CardDescription>여석은 조회 시점의 참고값이며 신청 성공을 보장하지 않습니다</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col">
        <SearchForm
          key={`${params.category}\n${params.q}`}
          initial={params}
          onSearch={(category, q) => setSearchParams(writeSearch({ category, q, page: 1 }))}
        />
        {isStudent ? <RequestStatus /> : null}
        {search.isPending ? (
          <LoadingState />
        ) : search.isError ? (
          <ErrorState error={search.error} onRetry={() => void search.refetch()} />
        ) : search.data.items.length === 0 ? (
          <>
            <EmptyState>검색 결과가 없습니다</EmptyState>
            {search.data.totalPages > 0 ? (
              <Pagination
                page={search.data.page}
                totalPages={search.data.totalPages}
                onPageChange={(page) => setSearchParams(writeSearch({ ...params, page }))}
              />
            ) : null}
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <Table>
              <TableCaption>
                과목 검색 결과 {search.data.totalItems}건
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>과목코드</TableHead>
                  <TableHead>과목명</TableHead>
                  <TableHead>이수구분</TableHead>
                  <TableHead>담당교수</TableHead>
                  <TableHead>평가유형</TableHead>
                  <TableHead className="text-right">정원</TableHead>
                  <TableHead className="text-right">현재 인원</TableHead>
                  <TableHead className="text-right">여석</TableHead>
                  <TableHead>강의실</TableHead>
                  <TableHead>상태</TableHead>
                  {isStudent ? <TableHead className="text-right">신청</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {search.data.items.map((course) => (
                  <TableRow
                    key={course.courseCode}
                    data-testid={`course-row-${course.courseCode}`}
                    data-pending={active?.courseCode === course.courseCode ? 'true' : undefined}
                  >
                    <TableCell className="whitespace-nowrap">
                      <Link
                        to={`/courses/${course.courseCode}`}
                        state={{ listSearch: location.search }}
                        className={inlineLinkClass}
                      >
                        {course.courseCode}
                      </Link>
                    </TableCell>
                    <TableCell className="min-w-40">{course.name}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {CATEGORY_LABEL[course.category]}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{course.professorName}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {EVALUATION_LABEL[course.evaluationType]}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{course.capacity}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {course.activeEnrollmentCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {course.remainingSeats}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{course.classroom}</TableCell>
                    <TableCell
                      className={
                        course.status === 'CLOSED'
                          ? 'whitespace-nowrap text-muted-foreground'
                          : 'whitespace-nowrap'
                      }
                    >
                      {COURSE_STATUS_LABEL[course.status]}
                    </TableCell>
                    {isStudent ? (
                      <TableCell className="text-right">
                        <RequestActionButton
                          courseCode={course.courseCode}
                          status={course.status}
                          enrolled={course.enrolled === true}
                          locked={locked}
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={search.data.page}
              totalPages={search.data.totalPages}
              onPageChange={(page) => setSearchParams(writeSearch({ ...params, page }))}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Filter form. Holds its own draft until submit; re-keyed by the URL so back/forward
 * navigation resets it to the query in the address bar.
 */
function SearchForm({
  initial,
  onSearch,
}: {
  initial: CourseSearchParams
  onSearch: (category: CourseCategoryFilter, q: string) => void
}) {
  const [category, setCategory] = useState(initial.category)
  const [q, setQ] = useState(initial.q)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSearch(category, q)
  }

  return (
    <form
      role="search"
      onSubmit={submit}
      className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-end"
    >
      <Field className="sm:w-40">
        <FieldLabel htmlFor="course-category">이수구분</FieldLabel>
        <NativeSelect
          id="course-category"
          name="category"
          value={category}
          onChange={(event) => setCategory(event.target.value as CourseCategoryFilter)}
        >
          {CATEGORY_FILTERS.map((value) => (
            <option key={value} value={value}>
              {CATEGORY_FILTER_LABEL[value]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field className="sm:flex-1">
        <FieldLabel htmlFor="course-q">검색어</FieldLabel>
        <Input
          id="course-q"
          name="q"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="과목명, 과목코드, 담당교수 이름…"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </Field>
      <Button type="submit" className="h-11 px-5">
        <Search aria-hidden="true" />
        검색
      </Button>
    </form>
  )
}

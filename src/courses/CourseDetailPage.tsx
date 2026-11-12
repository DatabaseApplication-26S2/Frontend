import type { ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import {
  CATEGORY_LABEL,
  COURSE_STATUS_LABEL,
  EVALUATION_LABEL,
} from '@/api/labels'
import type { Course } from '@/api/types'
import { useAuth } from '@/auth/session'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { RequestActionButton, RequestStatus } from '@/enrollments/RequestStatus'
import { useRequestFlow } from '@/enrollments/requestFlow'
import { ErrorState, LoadingState } from '@/layout/PageStates'
import { inlineLinkClass } from '@/layout/styles'
import { useCourse } from './queries'

/** `/courses/:courseCode`: every course field, a refresh, and the student's action. */
export function CourseDetailPage() {
  const { courseCode = '' } = useParams()
  const location = useLocation()
  // The list passes its query along so "목록으로" returns to the same page and filter
  const listSearch: string =
    typeof location.state?.listSearch === 'string' ? location.state.listSearch : ''
  const course = useCourse(courseCode)
  const { user } = useAuth()
  const { locked } = useRequestFlow()
  const isStudent = user?.role === 'STUDENT'

  return (
    <div className="flex flex-col gap-4">
      <Link
        to={`/courses${listSearch}`}
        className={`inline-flex items-center gap-1.5 self-start ${inlineLinkClass}`}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        목록으로
      </Link>
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h1>{course.data ? course.data.name : '과목 상세'}</h1>
          </CardTitle>
          {course.data ? (
            <CardDescription>
              {course.data.courseCode} · {course.data.professorName}
            </CardDescription>
          ) : null}
          <CardAction>
            <Button
              variant="outline"
              className="h-10 px-3"
              disabled={course.isFetching}
              onClick={() => void course.refetch()}
            >
              <RefreshCw aria-hidden="true" />
              새로고침
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col">
          {isStudent ? <RequestStatus /> : null}
          {course.isPending ? (
            <LoadingState />
          ) : course.isError ? (
            <ErrorState error={course.error} />
          ) : (
            <CourseFacts course={course.data}>
              {isStudent ? (
                <RequestActionButton
                  courseCode={course.data.courseCode}
                  status={course.data.status}
                  enrolled={course.data.enrolled === true}
                  locked={locked}
                />
              ) : null}
            </CourseFacts>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CourseFacts({ course, children }: { course: Course; children: ReactNode }) {
  const closed = course.status === 'CLOSED'
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg bg-muted px-4 py-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">여석</p>
          <p className="text-(length:--font-size-title) leading-(--line-height-title) font-bold tabular-nums">
            {closed ? COURSE_STATUS_LABEL.CLOSED : course.remainingSeats}
          </p>
        </div>
        {children}
        <p className="basis-full text-sm text-muted-foreground">
          여석은 조회 시점의 참고값이며 신청 성공을 보장하지 않습니다
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Fact label="과목코드" value={course.courseCode} />
        <Fact label="이수구분" value={CATEGORY_LABEL[course.category]} />
        <Fact label="담당교수" value={course.professorName} />
        <Fact label="평가유형" value={EVALUATION_LABEL[course.evaluationType]} />
        <Fact label="정원" value={course.capacity} />
        <Fact label="최소 수강인원" value={course.minimumEnrollment} />
        <Fact label="현재 인원" value={course.activeEnrollmentCount} />
        <Fact label="강의실" value={course.classroom} />
        <Fact label="상태" value={COURSE_STATUS_LABEL[course.status]} />
      </dl>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={typeof value === 'number' ? 'tabular-nums' : undefined}>{value}</dd>
    </div>
  )
}

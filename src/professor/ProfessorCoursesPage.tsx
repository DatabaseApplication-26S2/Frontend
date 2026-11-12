import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { Plus } from 'lucide-react'
import { CATEGORY_LABEL, COURSE_STATUS_LABEL, EVALUATION_LABEL } from '@/api/labels'
import type { Course } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useReturnFocus } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, ErrorState, LoadingState } from '@/layout/PageStates'
import { inlineLinkClass } from '@/layout/styles'
import { CloseCourseDialog } from './CloseCourseDialog'
import { CourseFormDialog } from './CourseFormDialog'
import { useProfessorCourses } from './queries'

// The target stays set while a dialog closes so its exit animation keeps its content
type DialogTarget = { open: boolean; course: Course | null }
const CLOSED: DialogTarget = { open: false, course: null }

/** `/professor/courses`: the professor's courses with register, edit and close. */
export function ProfessorCoursesPage() {
  const list = useProfessorCourses()
  const [formTarget, setFormTarget] = useState<DialogTarget>(CLOSED)
  const [closeTarget, setCloseTarget] = useState<DialogTarget>(CLOSED)
  const returnFocus = useReturnFocus()
  const headingRef = useRef<HTMLHeadingElement>(null)

  // When a row's button is disabled or gone on close, focus lands on that row's course code
  function rowFallback(courseCode: string) {
    return () =>
      document.getElementById(`professor-course-link-${courseCode}`) ?? headingRef.current
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h1 ref={headingRef} tabIndex={-1} className="focus:outline-none">
            담당 과목
          </h1>
        </CardTitle>
        <CardAction>
          <Button
            className="h-10 px-4"
            onClick={(event) => {
              returnFocus.from(event.currentTarget, () => headingRef.current)
              setFormTarget({ open: true, course: null })
            }}
          >
            <Plus aria-hidden="true" />
            과목 등록
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col">
        {list.isPending ? (
          <LoadingState />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.data.items.length === 0 ? (
          <EmptyState>담당 과목이 없습니다</EmptyState>
        ) : (
          <Table>
            <TableCaption>담당 과목 {list.data.items.length}건</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>과목코드</TableHead>
                <TableHead>과목명</TableHead>
                <TableHead>이수구분</TableHead>
                <TableHead>평가유형</TableHead>
                <TableHead className="text-right">정원</TableHead>
                <TableHead className="text-right">최소 수강인원</TableHead>
                <TableHead className="text-right">현재 인원</TableHead>
                <TableHead>강의실</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">수정</TableHead>
                <TableHead className="text-right">폐강</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((course) => {
                const closed = course.status === 'CLOSED'
                return (
                  <TableRow
                    key={course.courseCode}
                    data-testid={`professor-course-row-${course.courseCode}`}
                  >
                    <TableCell className="whitespace-nowrap">
                      <Link
                        id={`professor-course-link-${course.courseCode}`}
                        to={`/courses/${course.courseCode}`}
                        className={inlineLinkClass}
                      >
                        {course.courseCode}
                      </Link>
                    </TableCell>
                    <TableCell className="min-w-40">{course.name}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {CATEGORY_LABEL[course.category]}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {EVALUATION_LABEL[course.evaluationType]}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{course.capacity}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {course.minimumEnrollment}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {course.activeEnrollmentCount}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{course.classroom}</TableCell>
                    <TableCell
                      className={
                        closed ? 'whitespace-nowrap text-muted-foreground' : 'whitespace-nowrap'
                      }
                    >
                      {COURSE_STATUS_LABEL[course.status]}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        className="min-w-16"
                        disabled={closed}
                        onClick={(event) => {
                          returnFocus.from(event.currentTarget, rowFallback(course.courseCode))
                          setFormTarget({ open: true, course })
                        }}
                      >
                        수정
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        className="min-w-16"
                        disabled={closed}
                        onClick={(event) => {
                          returnFocus.from(event.currentTarget, rowFallback(course.courseCode))
                          setCloseTarget({ open: true, course })
                        }}
                      >
                        폐강
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CourseFormDialog
        open={formTarget.open}
        course={formTarget.course}
        onOpenChange={(open) => setFormTarget((target) => ({ ...target, open }))}
        onCloseAutoFocus={returnFocus.onCloseAutoFocus}
      />
      <CloseCourseDialog
        open={closeTarget.open}
        course={closeTarget.course}
        onOpenChange={(open) => setCloseTarget((target) => ({ ...target, open }))}
        onCloseAutoFocus={returnFocus.onCloseAutoFocus}
        onCourseClosed={returnFocus.redirect}
      />
    </Card>
  )
}

import { Link } from 'react-router'
import { CATEGORY_LABEL, ENROLLMENT_TYPE_LABEL } from '@/api/labels'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useMyEnrollments } from './queries'
import { RequestStatus } from './RequestStatus'
import { requestCancellation, useRequestFlow } from './requestFlow'

const enrolledAtFormat = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

/** `/me/enrollments`: the student's enrollments with cancel, plus request progress and result. */
export function MyEnrollmentsPage() {
  const list = useMyEnrollments()
  const { active, locked } = useRequestFlow()

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h1>내 신청 내역</h1>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        <RequestStatus />
        {list.isPending ? (
          <LoadingState />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.data.items.length === 0 ? (
          <EmptyState>신청한 과목이 없습니다</EmptyState>
        ) : (
          <Table>
            <TableCaption>내 신청 내역 {list.data.items.length}건</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>과목코드</TableHead>
                <TableHead>과목명</TableHead>
                <TableHead>이수구분</TableHead>
                <TableHead>담당교수</TableHead>
                <TableHead>강의실</TableHead>
                <TableHead>신청 구분</TableHead>
                <TableHead>신청 시각</TableHead>
                <TableHead className="text-right">취소</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((item) => {
                const closed = item.status === 'CLOSED'
                return (
                  <TableRow
                    key={item.courseCode}
                    data-testid={`enrollment-row-${item.courseCode}`}
                    data-pending={active?.courseCode === item.courseCode ? 'true' : undefined}
                  >
                    <TableCell className="whitespace-nowrap">
                      <Link to={`/courses/${item.courseCode}`} className={inlineLinkClass}>
                        {item.courseCode}
                      </Link>
                    </TableCell>
                    <TableCell className="min-w-40">
                      {item.name}
                      {closed ? (
                        <span className="ml-2 whitespace-nowrap text-muted-foreground">폐강</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {CATEGORY_LABEL[item.category]}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{item.professorName}</TableCell>
                    <TableCell className="whitespace-nowrap">{item.classroom}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {ENROLLMENT_TYPE_LABEL[item.enrollmentType]}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      <time dateTime={item.enrolledAt}>
                        {enrolledAtFormat.format(new Date(item.enrolledAt))}
                      </time>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        className="min-w-20"
                        disabled={locked || closed}
                        onClick={() => requestCancellation(item.courseCode)}
                      >
                        취소
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

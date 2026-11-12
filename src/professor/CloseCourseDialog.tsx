import { toast } from 'sonner'
import { problemMessage } from '@/api/messages'
import type { Course } from '@/api/types'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { useCloseCourse } from './queries'

/**
 * Confirm closing one course. A refusal (E14) shows inside the dialog and keeps it open;
 * success calls `onCourseClosed`, closes it and shows a toast.
 */
export function CloseCourseDialog({
  open,
  course,
  onOpenChange,
  onCloseAutoFocus,
  onCourseClosed,
}: {
  open: boolean
  course: Course | null
  onOpenChange: (open: boolean) => void
  onCloseAutoFocus: (event: Event) => void
  /** The row's 수정/폐강 buttons become disabled, so the page moves focus elsewhere. */
  onCourseClosed: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        {course ? (
          <CloseCourseConfirm
            course={course}
            onDone={() => {
              onCourseClosed()
              onOpenChange(false)
            }}
          />
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  )
}

function CloseCourseConfirm({ course, onDone }: { course: Course; onDone: () => void }) {
  const close = useCloseCourse()
  const error = close.isError ? problemMessage(close.error) : null

  function confirm() {
    close.mutate(course.courseCode, {
      onSuccess: () => {
        toast.success('과목을 폐강했습니다')
        onDone()
      },
    })
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>과목 폐강</AlertDialogTitle>
        <AlertDialogDescription>
          폐강하면 되돌릴 수 없습니다. 현재 신청 내역은 폐강 상태로 보존됩니다.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <p className="rounded-lg bg-muted px-3 py-2.5">
        <span className="mr-2 font-bold">{course.courseCode}</span>
        {course.name}
      </p>
      {error ? <FieldError className="text-pretty">{error}</FieldError> : null}
      <AlertDialogFooter>
        <AlertDialogCancel asChild>
          <Button variant="outline" className="h-10 px-4">
            취소
          </Button>
        </AlertDialogCancel>
        <Button variant="secondary" className="h-10 px-4" disabled={close.isPending} onClick={confirm}>
          폐강
        </Button>
      </AlertDialogFooter>
    </>
  )
}

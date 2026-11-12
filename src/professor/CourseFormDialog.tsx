import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { CATEGORY_LABEL, EVALUATION_LABEL } from '@/api/labels'
import { formErrorsFrom } from '@/api/messages'
import type { Course, CourseCategory, EvaluationType } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { SelectField, TextField } from '@/components/ui/form-field'
import { useCreateCourse, useUpdateCourse } from './queries'
import { courseFormSchema, type CourseFormInput, type CourseFormOutput } from './schemas'

const CATEGORIES: CourseCategory[] = ['GENERAL', 'MAJOR']
const EVALUATIONS: EvaluationType[] = ['RELATIVE', 'ABSOLUTE', 'PASS_FAIL']
const FORM_FIELDS = [
  'courseCode',
  'name',
  'category',
  'evaluationType',
  'capacity',
  'minimumEnrollment',
  'classroom',
] as const satisfies readonly (keyof CourseFormInput)[]

/**
 * Register (`course` null) or edit a course. The form mounts with the dialog, so every
 * opening starts from the course's current values. Stays open on errors. The page passes
 * `onCloseAutoFocus` to send focus back to the button that opened it.
 */
export function CourseFormDialog({
  open,
  course,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean
  course: Course | null
  onOpenChange: (open: boolean) => void
  onCloseAutoFocus: (event: Event) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" onCloseAutoFocus={onCloseAutoFocus}>
        <CourseForm course={course} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CourseForm({ course, onDone }: { course: Course | null; onDone: () => void }) {
  const create = useCreateCourse()
  const update = useUpdateCourse()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<CourseFormInput, unknown, CourseFormOutput>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: course
      ? {
          courseCode: course.courseCode,
          name: course.name,
          category: course.category,
          evaluationType: course.evaluationType,
          capacity: String(course.capacity),
          minimumEnrollment: String(course.minimumEnrollment),
          classroom: course.classroom,
        }
      : {
          courseCode: '',
          name: '',
          category: 'MAJOR',
          evaluationType: 'RELATIVE',
          capacity: '',
          minimumEnrollment: '',
          classroom: '',
        },
  })
  const { errors } = form.formState
  const pending = create.isPending || update.isPending

  // Field problems go under their field; anything without a visible field joins the form error
  function showServerErrors(error: unknown) {
    const { fields, form: formMessage } = formErrorsFrom(error)
    const rest: string[] = []
    for (const [key, message] of Object.entries(fields)) {
      const field = FORM_FIELDS.find((name) => name === key)
      if (field && !(course && field === 'courseCode')) {
        form.setError(field, { type: 'server', message })
      } else {
        rest.push(message)
      }
    }
    const combined = [formMessage, ...rest].filter(Boolean).join(' ')
    setFormError(combined || null)
  }

  const submit = form.handleSubmit(({ courseCode, ...body }) => {
    setFormError(null)
    if (course) {
      update.mutate(
        { courseCode: course.courseCode, body },
        {
          onError: showServerErrors,
          onSuccess: () => {
            toast.success('과목 정보를 수정했습니다')
            onDone()
          },
        },
      )
    } else {
      create.mutate(
        { courseCode, ...body },
        {
          onError: showServerErrors,
          onSuccess: () => {
            toast.success('과목을 등록했습니다')
            onDone()
          },
        },
      )
    }
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>{course ? '과목 수정' : '과목 등록'}</DialogTitle>
        <DialogDescription>
          {course
            ? `${course.courseCode} · 과목코드는 바꿀 수 없습니다.`
            : '과목코드는 등록한 뒤 바꿀 수 없습니다.'}
        </DialogDescription>
      </DialogHeader>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <fieldset disabled={pending} className="grid min-w-0 gap-5 sm:grid-cols-2">
          {course ? null : (
            <TextField
              id="course-form-code"
              label="과목코드"
              error={errors.courseCode?.message}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="예: CSE4999…"
              {...form.register('courseCode')}
            />
          )}
          <TextField
            id="course-form-name"
            label="과목명"
            error={errors.name?.message}
            autoComplete="off"
            className={course ? 'sm:col-span-2' : undefined}
            {...form.register('name')}
          />
          <SelectField
            id="course-form-category"
            label="이수구분"
            error={errors.category?.message}
            {...form.register('category')}
          >
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABEL[value]}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="course-form-evaluation"
            label="평가유형"
            error={errors.evaluationType?.message}
            {...form.register('evaluationType')}
          >
            {EVALUATIONS.map((value) => (
              <option key={value} value={value}>
                {EVALUATION_LABEL[value]}
              </option>
            ))}
          </SelectField>
          <TextField
            id="course-form-capacity"
            label="정원"
            error={errors.capacity?.message}
            inputMode="numeric"
            autoComplete="off"
            {...form.register('capacity')}
          />
          <TextField
            id="course-form-minimum"
            label="최소 수강인원"
            error={errors.minimumEnrollment?.message}
            inputMode="numeric"
            autoComplete="off"
            {...form.register('minimumEnrollment')}
          />
          <TextField
            id="course-form-classroom"
            label="강의실"
            error={errors.classroom?.message}
            autoComplete="off"
            className="sm:col-span-2"
            {...form.register('classroom')}
          />
        </fieldset>
        {formError ? <FieldError className="text-pretty">{formError}</FieldError> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" className="h-10 px-4">
              닫기
            </Button>
          </DialogClose>
          <Button type="submit" className="h-10 px-4" disabled={pending}>
            {course ? '저장' : '등록'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

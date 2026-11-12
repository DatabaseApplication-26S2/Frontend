import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { ENROLLMENT_TYPE_LABEL } from '@/api/labels'
import { formErrorsFrom } from '@/api/messages'
import { Collapse } from '@/components/motion'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FieldError } from '@/components/ui/field'
import { TextField } from '@/components/ui/form-field'
import { useAdminEnroll } from './queries'
import { adminEnrollSchema, type AdminEnrollValues } from './schemas'

/** `/admin/enrollments`: assign a student to a course, then show the resulting head count. */
export function AdminEnrollmentsPage() {
  const enroll = useAdminEnroll()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<AdminEnrollValues>({
    resolver: zodResolver(adminEnrollSchema),
    defaultValues: { studentId: '', courseCode: '' },
  })
  const { errors } = form.formState
  const result = enroll.isSuccess ? enroll.data : null

  const submit = form.handleSubmit((values) => {
    setFormError(null)
    enroll.mutate(values, {
      onError: (error) => {
        const { fields, form: formMessage } = formErrorsFrom(error)
        const rest: string[] = []
        for (const [key, message] of Object.entries(fields)) {
          if (key === 'studentId' || key === 'courseCode') {
            form.setError(key, { type: 'server', message })
          } else {
            rest.push(message)
          }
        }
        const combined = [formMessage, ...rest].filter(Boolean).join(' ')
        setFormError(combined || null)
      },
    })
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h1>관리자 수강신청</h1>
        </CardTitle>
        <CardDescription>정원이 찬 과목에도 학생을 배정할 수 있습니다</CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={submit} className="flex max-w-md flex-col gap-5">
          <fieldset disabled={enroll.isPending} className="flex min-w-0 flex-col gap-5">
            <TextField
              id="admin-enroll-student"
              label="학번"
              error={errors.studentId?.message}
              autoComplete="off"
              spellCheck={false}
              {...form.register('studentId')}
            />
            <TextField
              id="admin-enroll-course"
              label="과목코드"
              error={errors.courseCode?.message}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              {...form.register('courseCode')}
            />
          </fieldset>
          {formError ? <FieldError className="text-pretty">{formError}</FieldError> : null}
          <Button type="submit" size="lg" className="self-start" disabled={enroll.isPending}>
            배정
          </Button>
        </form>
        <div data-testid="admin-enroll-result" role="status" className="max-w-md">
          <Collapse open={!!result}>
            {result ? (
              <div className="pt-6">
                <div className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3">
                  <p className="flex items-center gap-2 font-bold">
                    <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
                    배정 완료
                  </p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                    <dt className="text-muted-foreground">학번</dt>
                    <dd>{result.studentId}</dd>
                    <dt className="text-muted-foreground">과목코드</dt>
                    <dd>{result.courseCode}</dd>
                    <dt className="text-muted-foreground">신청 구분</dt>
                    <dd>{ENROLLMENT_TYPE_LABEL[result.enrollmentType]}</dd>
                    <dt className="text-muted-foreground">현재 인원 / 정원</dt>
                    <dd className="flex flex-wrap items-center gap-2">
                      <span className="tabular-nums">
                        {result.activeEnrollmentCount} / {result.capacity}
                      </span>
                      {result.overCapacity ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-bold">
                          <TriangleAlert aria-hidden="true" className="size-3.5" />
                          정원 초과
                        </span>
                      ) : null}
                    </dd>
                  </dl>
                </div>
              </div>
            ) : null}
          </Collapse>
        </div>
      </CardContent>
    </Card>
  )
}

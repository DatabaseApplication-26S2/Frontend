import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { formErrorsFrom } from '@/api/messages'
import type { ServiceSettings } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FieldError } from '@/components/ui/field'
import { TextField } from '@/components/ui/form-field'
import { ErrorState, LoadingState } from '@/layout/PageStates'
import { useServiceSettings, useUpdateServiceSettings } from './queries'
import { settingsSchema, type SettingsInput, type SettingsOutput } from './schemas'

const changedAtFormat = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'medium',
})

/** `/admin/settings`: queue capacity snapshot and the concurrency limit N. */
export function AdminSettingsPage() {
  const settings = useServiceSettings()

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h1>서비스 설정</h1>
          </CardTitle>
          <CardDescription>조회 시점 스냅샷이며 실시간 값이 아닙니다</CardDescription>
          <CardAction>
            <Button
              variant="outline"
              className="h-10 px-3"
              disabled={settings.isFetching}
              onClick={() => void settings.refetch()}
            >
              <RefreshCw aria-hidden="true" />
              새로고침
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {settings.isPending ? (
            <LoadingState />
          ) : settings.isError ? (
            <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
          ) : (
            <SettingsSnapshot settings={settings.data} />
          )}
        </CardContent>
      </Card>
      {settings.data ? <LimitForm current={settings.data.concurrencyLimit} /> : null}
    </>
  )
}

function SettingsSnapshot({ settings }: { settings: ServiceSettings }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
      <Stat label="현재 동시 처리 수" testId="settings-limit" value={settings.concurrencyLimit} />
      <Stat label="활성 슬롯" testId="settings-active" value={settings.activeSlots} />
      <Stat label="가용 슬롯" testId="settings-available" value={settings.availableSlots} />
      <Stat label="대기 중인 요청" testId="settings-waiting" value={settings.waitingCount} />
      <div className="col-span-2 flex flex-col gap-0.5 sm:col-span-4">
        <dt className="text-sm text-muted-foreground">최종 변경</dt>
        <dd data-testid="settings-last-changed">
          {settings.lastChangedBy ? (
            <>
              <span className="font-bold">{settings.lastChangedBy}</span>
              {settings.lastChangedAt ? (
                <>
                  {' · '}
                  <time dateTime={settings.lastChangedAt} className="tabular-nums">
                    {changedAtFormat.format(new Date(settings.lastChangedAt))}
                  </time>
                </>
              ) : null}
            </>
          ) : (
            '변경 이력 없음'
          )}
        </dd>
      </div>
    </dl>
  )
}

function Stat({ label, testId, value }: { label: string; testId: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        data-testid={testId}
        className="text-(length:--font-size-title) leading-(--line-height-title) font-bold tabular-nums"
      >
        {value}
      </dd>
    </div>
  )
}

/** Change N (1–1000). The draft starts at the current N and resets to the saved value. */
function LimitForm({ current }: { current: number }) {
  const update = useUpdateServiceSettings()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<SettingsInput, unknown, SettingsOutput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { concurrencyLimit: String(current) },
  })
  const { errors } = form.formState

  const submit = form.handleSubmit((values) => {
    setFormError(null)
    update.mutate(values, {
      onSuccess: (saved) => {
        form.reset({ concurrencyLimit: String(saved.concurrencyLimit) })
        toast.success('동시 처리 수를 변경했습니다')
      },
      onError: (error) => {
        const { fields, form: formMessage } = formErrorsFrom(error)
        const rest: string[] = []
        for (const [key, message] of Object.entries(fields)) {
          if (key === 'concurrencyLimit') form.setError(key, { type: 'server', message })
          else rest.push(message)
        }
        const combined = [formMessage, ...rest].filter(Boolean).join(' ')
        setFormError(combined || null)
      },
    })
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild className="text-xl leading-7">
          <h2>동시 처리 수 변경</h2>
        </CardTitle>
        <CardDescription>
          대기열에서 동시에 처리하는 요청 수입니다. 1부터 1000까지 정할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={submit} className="flex max-w-md flex-col gap-5">
          <fieldset disabled={update.isPending} className="min-w-0">
            <TextField
              id="settings-concurrency-limit"
              label="동시 처리 수 N"
              error={errors.concurrencyLimit?.message}
              inputMode="numeric"
              autoComplete="off"
              {...form.register('concurrencyLimit')}
            />
          </fieldset>
          {formError ? <FieldError className="text-pretty">{formError}</FieldError> : null}
          <Button type="submit" size="lg" className="self-start" disabled={update.isPending}>
            변경
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

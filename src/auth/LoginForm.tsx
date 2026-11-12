import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Collapse } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { FieldError, FieldGroup } from '@/components/ui/field'
import { TextField } from '@/components/ui/form-field'
import { submitLogin } from '@/entry/entryFlow'
import { loginSchema, type LoginValues } from './schemas'

/** Server error of the entry flow (`role="alert"`). Opens its own space above what follows. */
export function EntryError({ text }: { text: string | null }) {
  return (
    <Collapse open={!!text}>
      {text ? (
        <div className="pb-4">
          <FieldError className="text-pretty">{text}</FieldError>
        </div>
      ) : null}
    </Collapse>
  )
}

/**
 * User ID and password. One submit starts the whole entry flow; while it runs (`busy`) the
 * fieldset is disabled and the button keeps its label.
 */
export function LoginForm({
  busy,
  fieldErrors,
  errorText,
}: {
  busy: boolean
  fieldErrors: Partial<Record<'userId' | 'password', string>>
  errorText: string | null
}) {
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { userId: '', password: '' },
  })
  const { errors } = form.formState

  return (
    <form noValidate onSubmit={form.handleSubmit((values) => submitLogin(values))}>
      <fieldset disabled={busy} className="min-w-0">
        <FieldGroup>
          <TextField
            id="login-user-id"
            label="사용자ID"
            error={errors.userId?.message ?? fieldErrors.userId}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            {...form.register('userId')}
          />
          <TextField
            id="login-password"
            label="비밀번호"
            type="password"
            error={errors.password?.message ?? fieldErrors.password}
            autoComplete="current-password"
            {...form.register('password')}
          />
          <div>
            <EntryError text={errorText} />
            <Button type="submit" size="lg" className="w-full">
              로그인
            </Button>
          </div>
        </FieldGroup>
      </fieldset>
    </form>
  )
}

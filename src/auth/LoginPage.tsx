import { Info } from 'lucide-react'
import { ROLE_LABEL } from '@/api/labels'
import { Collapse } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { retryAdmission, useEntryFlow } from '@/entry/entryFlow'
import { QueueStatus } from '@/queue/QueueStatus'
import { EntryError, LoginForm } from './LoginForm'
import { logout, useAuth } from './session'

/**
 * `/login`: one centered card. After one submit the same card shows the queue position and
 * processing state until the guard moves the user on; nothing else needs a click.
 */
export function LoginPage() {
  const view = useEntryFlow()
  const { user } = useAuth()

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle asChild>
            <h1>로그인</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div data-testid="entry-notice" role="status">
            <Collapse open={!!view.noticeText}>
              {view.noticeText ? (
                <div className="pb-4">
                  <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-foreground">
                    <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span className="text-pretty">{view.noticeText}</span>
                  </p>
                </div>
              ) : null}
            </Collapse>
          </div>
          {view.admissionStalled ? (
            <div className="flex flex-col">
              {user ? (
                <p className="pb-4">
                  <span className="font-bold">{user.name}</span>{' '}
                  <span className="text-muted-foreground">{ROLE_LABEL[user.role]}</span>
                </p>
              ) : null}
              <EntryError text={view.errorText} />
              <div className="flex flex-col gap-2">
                <Button size="lg" className="w-full" disabled={view.busy} onClick={retryAdmission}>
                  입장 다시 시도
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => void logout()}
                >
                  로그아웃
                </Button>
              </div>
            </div>
          ) : (
            <LoginForm busy={view.busy} fieldErrors={view.fieldErrors} errorText={view.errorText} />
          )}
          <QueueStatus testId="entry-status" text={view.statusText} />
        </CardContent>
      </Card>
    </main>
  )
}

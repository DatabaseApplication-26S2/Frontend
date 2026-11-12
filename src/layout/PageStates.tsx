import type { ReactNode } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { problemMessage } from '@/api/messages'
import { Button } from '@/components/ui/button'

/** Loading line for a screen's data (`불러오는 중…`). */
export function LoadingState() {
  return (
    <p role="status" className="flex items-center gap-2 py-6 text-muted-foreground">
      <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
      불러오는 중…
    </p>
  )
}

/**
 * Failed query, as `role="alert"` on the white card. Renders nothing when the error has no
 * message to show (stale auth generation, refresh-target 401, E15).
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = problemMessage(error)
  if (!message) return null
  return (
    <div className="flex flex-col items-start gap-3 py-4">
      <p role="alert" className="flex items-start gap-2 text-destructive">
        <CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />
        <span className="text-pretty">{message}</span>
      </p>
      {onRetry ? (
        <Button variant="outline" className="h-10 px-3" onClick={onRetry}>
          다시 시도
        </Button>
      ) : null}
    </div>
  )
}

/** Empty list message, centered in the space the table would take. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-muted-foreground">{children}</p>
}

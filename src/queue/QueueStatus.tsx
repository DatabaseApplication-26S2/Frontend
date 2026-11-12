import { LoaderCircle } from 'lucide-react'
import { Collapse, Roll } from '@/components/motion'

/**
 * Queue progress line ("로그인 대기 중 · 순번 3", "처리 중").
 *
 * The `role="status"` region is always rendered so screen readers announce changes. It holds
 * one `sr-only` plain-text copy and one `aria-hidden` visual line, because `Roll` keeps the old
 * and the new text in the DOM while it rolls. Only the changed part rolls; the line opens and
 * closes with `Collapse`, which gets `null` children when there is nothing to show.
 */
export function QueueStatus({
  testId,
  text,
  label = null,
  gap = 'before',
  className,
}: {
  testId: string
  /** Current status text; `null` closes the line and empties the region. */
  text: string | null
  /** Static words before the rolling text, e.g. the course code. */
  label?: string | null
  /** Which side of the line carries its spacing, so a closed line leaves no gap. */
  gap?: 'before' | 'after'
  className?: string
}) {
  const spoken = text ? (label ? `${label} ${text}` : text) : ''
  return (
    <div data-testid={testId} role="status" className={className}>
      <span className="sr-only">{spoken}</span>
      <Collapse open={!!text} aria-hidden="true">
        {text ? (
          <div className={gap === 'before' ? 'pt-4' : 'pb-4'}>
            <p className="flex min-h-12 flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg bg-muted px-3 py-2.5 text-sm text-foreground sm:text-base">
              <LoaderCircle
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground motion-safe:animate-spin"
              />
              {label ? <span className="font-bold whitespace-nowrap">{label}</span> : null}
              <Roll className="tabular-nums">{text}</Roll>
            </p>
          </div>
        ) : null}
      </Collapse>
    </div>
  )
}

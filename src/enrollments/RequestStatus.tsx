import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import type { CourseStatus } from '@/api/types'
import { Collapse } from '@/components/motion'
import { Button } from '@/components/ui/button'
import { QueueStatus } from '@/queue/QueueStatus'
import {
  dismissOutcome,
  requestCancellation,
  requestEnrollment,
  useRequestFlow,
} from './requestFlow'

const OUTCOME_ICON = { success: CircleCheck, error: CircleAlert, info: Info } as const

/**
 * Progress (`request-active`) and result (`request-outcome`) of the student's enrollment or
 * cancellation request. Both regions are always rendered and empty when there is nothing to say.
 * An error result is `role="alert"`; the region is re-keyed by role so the alert is inserted
 * with its text, which screen readers announce reliably.
 */
export function RequestStatus() {
  const { active, outcome } = useRequestFlow()
  const role = outcome?.tone === 'error' ? 'alert' : 'status'
  const Icon = outcome ? OUTCOME_ICON[outcome.tone] : null
  return (
    <div>
      <QueueStatus
        testId="request-active"
        text={active?.statusText ?? null}
        label={active?.courseCode ?? null}
        gap="after"
      />
      <div key={role} role={role} data-testid="request-outcome">
        <Collapse open={!!outcome}>
          {outcome && Icon ? (
            <div className="pb-4">
              <div
                className={
                  outcome.tone === 'error'
                    ? 'flex items-start gap-2.5 rounded-lg border border-destructive bg-card py-1.5 pr-1.5 pl-3 text-destructive'
                    : 'flex items-start gap-2.5 rounded-lg border border-border bg-card py-1.5 pr-1.5 pl-3 text-foreground'
                }
              >
                <Icon aria-hidden="true" className="mt-2.5 size-4 shrink-0" />
                <p className="min-w-0 flex-1 py-1.5 text-pretty">
                  {outcome.courseCode ? (
                    <span className="mr-2 font-bold whitespace-nowrap">{outcome.courseCode}</span>
                  ) : null}
                  {outcome.message}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-foreground"
                  aria-label="결과 닫기"
                  onClick={dismissOutcome}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            </div>
          ) : null}
        </Collapse>
      </div>
    </div>
  )
}

/**
 * Row action for a student: `신청` (open, not enrolled), `취소` (enrolled), or a disabled
 * `신청 불가` (closed). While a request is in flight (`locked`) every action is disabled.
 * The label never changes while a request runs.
 */
export function RequestActionButton({
  courseCode,
  status,
  enrolled,
  locked,
}: {
  courseCode: string
  status: CourseStatus
  enrolled: boolean
  locked: boolean
}) {
  if (status === 'CLOSED') {
    return (
      <Button variant="outline" className="min-w-20" disabled>
        신청 불가
      </Button>
    )
  }
  if (enrolled) {
    return (
      <Button
        variant="outline"
        className="min-w-20"
        disabled={locked}
        onClick={() => requestCancellation(courseCode)}
      >
        취소
      </Button>
    )
  }
  return (
    <Button className="min-w-20" disabled={locked} onClick={() => requestEnrollment(courseCode)}>
      신청
    </Button>
  )
}

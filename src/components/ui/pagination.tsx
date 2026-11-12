import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Previous / next pager with a `{page} / {totalPages}` indicator (`data-testid="page-indicator"`).
 * The caller owns the page state (the URL query on list screens).
 */
function Pagination({
  page,
  totalPages,
  onPageChange,
  label = '페이지 이동',
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  label?: string
}) {
  return (
    <nav aria-label={label} className="flex items-center justify-center gap-3">
      <Button
        variant="outline"
        className="h-10 px-3"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft aria-hidden="true" />
        이전
      </Button>
      <p data-testid="page-indicator" className="min-w-16 text-center text-sm tabular-nums">
        {page} / {totalPages}
      </p>
      <Button
        variant="outline"
        className="h-10 px-3"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        다음
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  )
}

export { Pagination }

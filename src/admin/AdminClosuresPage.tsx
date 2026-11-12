import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { closureItemMessage, problemMessage } from '@/api/messages'
import type { ClosureCandidate, CourseClosureItemResult } from '@/api/types'
import { Collapse } from '@/components/motion'
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
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { useReturnFocus } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Pagination } from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, ErrorState, LoadingState } from '@/layout/PageStates'
import { useClosureCandidates, useCloseCourses } from './queries'

/**
 * `/admin/closures`: courses below their minimum enrollment. The selection survives paging and
 * is cleared after a batch; the batch result stays until the next one.
 */
export function AdminClosuresPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const pageParam = Number(searchParams.get('page'))
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1
  const candidates = useClosureCandidates(page)
  const closeCourses = useCloseCourses()
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Codes shown and sent by the open dialog; kept while it closes so its text does not change
  const [confirmCodes, setConfirmCodes] = useState<string[]>([])
  const [results, setResults] = useState<CourseClosureItemResult[] | null>(null)
  const returnFocus = useReturnFocus()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null)

  function toggle(codes: string[], on: boolean) {
    setSelected((previous) => {
      const next = new Set(previous)
      for (const code of codes) {
        if (on) next.add(code)
        else next.delete(code)
      }
      return next
    })
  }

  function openConfirm(opener: HTMLElement) {
    closeCourses.reset()
    // After a batch the selection is cleared and the opener disabled: focus the results instead
    returnFocus.from(opener, () => resultsHeadingRef.current ?? headingRef.current)
    setConfirmCodes([...selected])
    setConfirmOpen(true)
  }

  function confirm() {
    closeCourses.mutate(confirmCodes, {
      onSuccess: (batch) => {
        returnFocus.redirect()
        setResults(batch.items)
        setSelected(new Set())
        setConfirmOpen(false)
      },
    })
  }

  const confirmError = closeCourses.isError ? problemMessage(closeCourses.error) : null
  const okCount = results?.filter((item) => item.code === 'OK').length ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h1 ref={headingRef} tabIndex={-1} className="focus:outline-none">
            폐강 대상
          </h1>
        </CardTitle>
        <CardAction>
          <Button
            variant="outline"
            className="h-10 px-3"
            disabled={selected.size === 0}
            onClick={(event) => openConfirm(event.currentTarget)}
          >
            선택 과목 폐강 ({selected.size}건)
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col">
        {candidates.isPending ? (
          <LoadingState />
        ) : candidates.isError ? (
          <ErrorState error={candidates.error} onRetry={() => void candidates.refetch()} />
        ) : candidates.data.totalItems === 0 ? (
          <EmptyState>폐강 대상 과목이 없습니다</EmptyState>
        ) : (
          <div className="flex flex-col gap-4">
            {candidates.data.items.length === 0 ? (
              <EmptyState>이 페이지에는 과목이 없습니다</EmptyState>
            ) : (
              <CandidateTable
                items={candidates.data.items}
                totalItems={candidates.data.totalItems}
                selected={selected}
                onToggle={toggle}
              />
            )}
            <Pagination
              page={candidates.data.page}
              totalPages={candidates.data.totalPages}
              onPageChange={(next) =>
                setSearchParams(next > 1 ? { page: String(next) } : {})
              }
            />
          </div>
        )}
        <div data-testid="closure-results">
          <Collapse open={!!results}>
            {results ? (
              <div className="flex flex-col gap-3 pt-8">
                <h2
                  ref={resultsHeadingRef}
                  tabIndex={-1}
                  className="text-xl leading-7 font-bold text-heading focus:outline-none"
                >
                  폐강 처리 결과
                </h2>
                <Table>
                  <TableCaption>폐강 처리 결과 {results.length}건</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>과목코드</TableHead>
                      <TableHead>결과</TableHead>
                      <TableHead className="text-right">보존된 신청 수</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((item) => (
                      <TableRow
                        key={item.courseCode}
                        data-testid={`closure-result-${item.courseCode}`}
                      >
                        <TableCell className="font-bold whitespace-nowrap">
                          {item.courseCode}
                        </TableCell>
                        <TableCell className={item.code === 'OK' ? undefined : 'text-destructive'}>
                          {closureItemMessage(item.code)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.closedEnrollmentCount ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </Collapse>
          <p role="status" className="sr-only">
            {results ? `폐강 처리 결과 ${results.length}건 중 ${okCount}건 폐강 완료` : ''}
          </p>
        </div>
      </CardContent>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onCloseAutoFocus={returnFocus.onCloseAutoFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>선택 과목 폐강</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCodes.length}개 과목을 폐강합니다. 폐강하면 되돌릴 수 없습니다. 현재 신청
              내역은 폐강 상태로 보존됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="flex flex-wrap gap-1.5" aria-label="폐강할 과목">
            {confirmCodes.map((code) => (
              <li key={code} className="rounded-md bg-muted px-2 py-0.5 text-sm font-bold">
                {code}
              </li>
            ))}
          </ul>
          {confirmError ? <FieldError className="text-pretty">{confirmError}</FieldError> : null}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" className="h-10 px-4">
                취소
              </Button>
            </AlertDialogCancel>
            <Button
              variant="secondary"
              className="h-10 px-4"
              disabled={closeCourses.isPending || confirmCodes.length === 0}
              onClick={confirm}
            >
              폐강
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function CandidateTable({
  items,
  totalItems,
  selected,
  onToggle,
}: {
  items: ClosureCandidate[]
  totalItems: number
  selected: ReadonlySet<string>
  onToggle: (codes: string[], on: boolean) => void
}) {
  const codes = items.map((item) => item.courseCode)
  const selectedHere = codes.filter((code) => selected.has(code)).length
  const allHere = selectedHere === codes.length

  return (
    <Table>
      <TableCaption>폐강 대상 {totalItems}건</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 px-0">
            <label className="flex size-11 items-center justify-center">
              <Checkbox
                aria-label="이 페이지 모두 선택"
                checked={allHere}
                ref={(element) => {
                  if (element) element.indeterminate = selectedHere > 0 && !allHere
                }}
                onChange={(event) => onToggle(codes, event.target.checked)}
              />
            </label>
          </TableHead>
          <TableHead>과목코드</TableHead>
          <TableHead>과목명</TableHead>
          <TableHead>담당교수</TableHead>
          <TableHead className="text-right">현재 인원</TableHead>
          <TableHead className="text-right">최소 수강인원</TableHead>
          <TableHead className="text-right">정원</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.courseCode}>
            <TableCell className="w-12 px-0 py-0">
              <label className="flex size-11 items-center justify-center">
                <Checkbox
                  aria-label={`${item.courseCode} 선택`}
                  checked={selected.has(item.courseCode)}
                  onChange={(event) => onToggle([item.courseCode], event.target.checked)}
                />
              </label>
            </TableCell>
            <TableCell className="font-bold whitespace-nowrap">{item.courseCode}</TableCell>
            <TableCell className="min-w-40">{item.name}</TableCell>
            <TableCell className="whitespace-nowrap">{item.professorName}</TableCell>
            <TableCell className="text-right tabular-nums">{item.activeEnrollmentCount}</TableCell>
            <TableCell className="text-right tabular-nums">{item.minimumEnrollment}</TableCell>
            <TableCell className="text-right tabular-nums">{item.capacity}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

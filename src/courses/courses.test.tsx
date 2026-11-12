import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { mockDb } from '@/mocks/db'
import { mockScenario } from '@/mocks/scenario'
import { SEED } from '@/mocks/seed'
import { renderApp } from '@/test/render'

it('T2-15 상세 표시와 새로고침 및 없는 과목', async () => {
  mockScenario.signIn(SEED.professor)
  const router = renderApp(`/courses/${SEED.course.open}`)
  expect(await screen.findByText('여석은 조회 시점의 참고값이며 신청 성공을 보장하지 않습니다')).toBeInTheDocument()
  const before = mockDb.calls.getCourse ?? 0
  await userEvent.click(await screen.findByRole('button', { name: '새로고침' }))
  await waitFor(() => expect(mockDb.calls.getCourse ?? 0).toBeGreaterThan(before))
  await router.navigate(`/courses/${SEED.course.missing}`)
  expect(await screen.findByRole('alert')).toHaveTextContent('과목을 찾을 수 없습니다')
})
it('T2-16 검색 조건과 빈 결과', async () => {
  mockScenario.signIn(SEED.student)
  const router = renderApp('/courses')
  await screen.findByTestId(`course-row-${SEED.course.open}`)
  await userEvent.selectOptions(screen.getByLabelText('이수구분'), 'MAJOR')
  await userEvent.type(screen.getByLabelText('검색어'), '없는과목')
  await userEvent.click(screen.getByRole('button', { name: '검색' }))
  await waitFor(() => expect(router.state.location.search).toContain('category=MAJOR'))
  expect(router.state.location.search).toContain('q=')
  expect(await screen.findByText('검색 결과가 없습니다')).toBeInTheDocument()
})
it('T2-16 두 번째 페이지는 다섯 과목이다', async () => {
  mockScenario.signIn(SEED.student)
  renderApp('/courses?page=2')
  await waitFor(() => expect(screen.getByTestId('page-indicator')).toHaveTextContent('2 / 2'))
  await waitFor(() => expect(screen.getAllByTestId(/^course-row-/)).toHaveLength(5))
})

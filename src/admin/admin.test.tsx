import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { resetMockDb } from '@/mocks/db'
import { mockScenario } from '@/mocks/scenario'
import { SEED } from '@/mocks/seed'
import { renderApp } from '@/test/render'

it('T2-12 관리자는 정원 초과 배정을 확인한다', async () => {
  mockScenario.signIn(SEED.admin)
  renderApp('/admin/enrollments')
  await userEvent.type(await screen.findByLabelText('학번', {}, { timeout: 25000 }), SEED.student2)
  await userEvent.type(await screen.findByLabelText('과목코드'), SEED.course.full)
  await userEvent.click(await screen.findByRole('button', { name: '배정' }))
  await waitFor(() => expect(screen.getByTestId('admin-enroll-result')).toHaveTextContent('정원 초과'), { timeout: 25000 })
  expect(screen.getByTestId('admin-enroll-result')).toHaveTextContent(/4\s*\/\s*3/)
}, 40000)
it.each([[SEED.professor, SEED.course.open, '학생 계정이 아닙니다'], [SEED.student2, SEED.course.missing, '과목을 찾을 수 없습니다'], [SEED.student2, SEED.course.closed, '폐강된 과목입니다'], [SEED.student, SEED.course.enrolled, '이미 신청한 과목입니다']])('T2-12 %s %s 배정 오류', async (id, code, message) => {
  mockScenario.signIn(SEED.admin)
  renderApp('/admin/enrollments')
  await userEvent.type(await screen.findByLabelText('학번', {}, { timeout: 25000 }), id)
  await userEvent.type(await screen.findByLabelText('과목코드'), code)
  await userEvent.click(await screen.findByRole('button', { name: '배정' }))
  expect(await screen.findByText(message, {}, { timeout: 25000 })).toBeInTheDocument()
}, 40000)
it('T2-13 설정 현황과 변경', async () => {
  mockScenario.signIn(SEED.admin)
  renderApp('/admin/settings')
  expect(await screen.findByTestId('settings-limit')).toHaveTextContent('100')
  for (const id of ['settings-active', 'settings-available', 'settings-waiting', 'settings-last-changed']) expect(screen.getByTestId(id)).toBeInTheDocument()
  const input = screen.getByLabelText('동시 처리 수 N')
  await userEvent.clear(input)
  await userEvent.type(input, '125')
  await userEvent.click(screen.getByRole('button', { name: '변경' }))
  await waitFor(() => expect(screen.getByTestId('settings-limit')).toHaveTextContent('125'))
  expect(screen.getByTestId('settings-last-changed')).not.toHaveTextContent('변경 이력 없음')
  await userEvent.clear(input)
  await userEvent.type(input, '1001')
  await userEvent.click(screen.getByRole('button', { name: '변경' }))
  expect(await screen.findByRole('alert')).toBeInTheDocument()
})
it('T2-14 선택한 폐강 대상의 결과를 표시한다', async () => {
  mockScenario.signIn(SEED.admin)
  renderApp('/admin/closures')
  await userEvent.click(await screen.findByRole('checkbox', { name: `${SEED.course.closable} 선택` }))
  await userEvent.click(screen.getByRole('button', { name: /^선택 과목 폐강/ }))
  const dialog = await screen.findByRole('alertdialog')
  await userEvent.click(within(dialog).getByRole('button', { name: '폐강' }))
  expect(await screen.findByTestId(`closure-result-${SEED.course.closable}`)).toHaveTextContent('폐강 완료')
})

it('T2-14 두 페이지에서 선택한 폐강 대상의 개별 결과를 표시한다', async () => {
  resetMockDb({
    retryAfterSeconds: 0,
    data: { courses: Array.from({ length: 21 }, (_, i) => ({
      courseCode: `ZZZ${String(i).padStart(4, '0')}`, capacity: 30,
      minimumEnrollment: 5, activeEnrollmentCount: 0,
    })) },
  })
  mockScenario.signIn(SEED.admin)
  renderApp('/admin/closures')
  await userEvent.click(await screen.findByRole('checkbox', { name: 'ZZZ0000 선택' }))
  await userEvent.click(screen.getByRole('button', { name: '다음' }))
  await userEvent.click(await screen.findByRole('checkbox', { name: 'ZZZ0020 선택' }))
  await userEvent.click(screen.getByRole('button', { name: /^선택 과목 폐강/ }))
  const dialog = await screen.findByRole('alertdialog')
  await userEvent.click(within(dialog).getByRole('button', { name: '폐강' }))
  expect(await screen.findByTestId('closure-result-ZZZ0000')).toHaveTextContent('폐강 완료')
  expect(await screen.findByTestId('closure-result-ZZZ0020')).toHaveTextContent('폐강 완료')
})

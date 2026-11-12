import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { mockDb } from '@/mocks/db'
import { problem } from '@/mocks/problems'
import { mockScenario } from '@/mocks/scenario'
import { SEED } from '@/mocks/seed'
import { renderApp } from '@/test/render'

it('T2-11 교수 폐강 불가와 폐강 성공', async () => {
  mockScenario.signIn(SEED.professor)
  renderApp('/professor/courses')
  const open = await screen.findByTestId(`professor-course-row-${SEED.course.open}`)
  await userEvent.click(within(open).getByRole('button', { name: '폐강' }))
  let dialog = await screen.findByRole('alertdialog')
  await userEvent.click(within(dialog).getByRole('button', { name: '폐강' }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('폐강 대상이 아닙니다')
  await userEvent.click(within(dialog).getByRole('button', { name: '취소' }))
  const closable = await screen.findByTestId(`professor-course-row-${SEED.course.closable}`)
  await userEvent.click(within(closable).getByRole('button', { name: '폐강' }))
  dialog = await screen.findByRole('alertdialog')
  await userEvent.click(within(dialog).getByRole('button', { name: '폐강' }))
  await waitFor(() => expect(within(closable).getByRole('button', { name: '수정' })).toBeDisabled())
  expect(within(closable).getByRole('button', { name: '폐강' })).toBeDisabled()
  expect(within(closable).getAllByText('폐강')).toHaveLength(2)
})
it('T2-11 현재 인원보다 작은 정원은 거부한다', async () => {
  mockScenario.signIn(SEED.professor)
  renderApp('/professor/courses')
  const row = await screen.findByTestId(`professor-course-row-${SEED.course.open}`)
  await userEvent.click(within(row).getByRole('button', { name: '수정' }))
  const dialog = await screen.findByRole('dialog')
  const capacity = within(dialog).getByLabelText('정원')
  await userEvent.clear(capacity)
  await userEvent.type(capacity, '10')
  await userEvent.click(within(dialog).getByRole('button', { name: '저장' }))
  expect(await within(dialog).findByText('정원은 현재 인원보다 작을 수 없습니다')).toBeInTheDocument()
})

it.each([
  ['E09', problem('E09', 400, { violations: [{ source: 'BODY', field: '/capacity', message: '정원 오류' }] }), '정원 오류'],
  ['E05', problem('E05', 409), '폐강된 과목입니다'],
] as const)('T2-11 교수 수정 서버 오류 %s', async (_, failure, message) => {
  mockScenario.signIn(SEED.professor)
  renderApp('/professor/courses')
  const row = await screen.findByTestId(`professor-course-row-${SEED.course.open}`)
  await userEvent.click(within(row).getByRole('button', { name: '수정' }))
  const dialog = await screen.findByRole('dialog')
  mockScenario.failNext('updateProfessorCourse', failure)
  await userEvent.click(within(dialog).getByRole('button', { name: '저장' }))
  expect(await within(dialog).findByText(message)).toBeInTheDocument()
})
it('T2-11 이미 존재하는 과목코드 등록을 거부한다', async () => {
  mockScenario.signIn(SEED.professor)
  renderApp('/professor/courses')
  await userEvent.click(await screen.findByRole('button', { name: '과목 등록' }))
  const dialog = await screen.findByRole('dialog')
  await userEvent.type(within(dialog).getByLabelText('과목코드'), SEED.course.existing)
  await userEvent.type(within(dialog).getByLabelText('과목명'), '테스트 과목')
  await userEvent.selectOptions(within(dialog).getByLabelText('이수구분'), 'MAJOR')
  await userEvent.selectOptions(within(dialog).getByLabelText('평가유형'), 'ABSOLUTE')
  await userEvent.clear(within(dialog).getByLabelText('정원'))
  await userEvent.type(within(dialog).getByLabelText('정원'), '40')
  await userEvent.clear(within(dialog).getByLabelText('최소 수강인원'))
  await userEvent.type(within(dialog).getByLabelText('최소 수강인원'), '5')
  await userEvent.type(within(dialog).getByLabelText('강의실'), 'A101')
  await userEvent.click(within(dialog).getByRole('button', { name: '등록' }))
  expect(await within(dialog).findByText('이미 사용된 과목코드입니다')).toBeInTheDocument()
})

it('사용자 전환 시 이전 교수의 수정 요청을 재전송하지 않는다', async () => {
  mockScenario.signIn(SEED.professor)
  renderApp('/professor/courses')
  const row = await screen.findByTestId(`professor-course-row-${SEED.course.open}`)
  const oldUser = screen.getByTestId('current-user').textContent
  const originalRoom = mockDb.courses.find((course) => course.courseCode === SEED.course.open)?.classroom
  await userEvent.click(within(row).getByRole('button', { name: '수정' }))
  const dialog = await screen.findByRole('dialog')
  const classroom = within(dialog).getByLabelText('강의실')
  await userEvent.clear(classroom)
  await userEvent.type(classroom, '회귀 테스트 강의실')
  mockScenario.expireAccess()
  mockScenario.signIn(SEED.professor2)
  await userEvent.click(within(dialog).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.getByTestId('current-user').textContent).not.toBe(oldUser))
  expect(mockDb.calls.updateProfessorCourse).toBe(1)
  expect(mockDb.courses.find((course) => course.courseCode === SEED.course.open)?.classroom).toBe(originalRoom)
  expect(screen.queryByText('과목 정보를 수정했습니다')).not.toBeInTheDocument()
})

it.each(['Escape', '닫기'] as const)('과목 수정 대화상자를 %s로 닫으면 수정 버튼에 포커스를 돌린다', async (method) => {
  mockScenario.signIn(SEED.professor)
  renderApp('/professor/courses')
  const row = await screen.findByTestId(`professor-course-row-${SEED.course.open}`)
  const trigger = within(row).getByRole('button', { name: '수정' })
  await userEvent.click(trigger)
  const dialog = await screen.findByRole('dialog')
  if (method === 'Escape') await userEvent.keyboard('{Escape}')
  else await userEvent.click(within(dialog).getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(trigger).toHaveFocus())
})

it('폐강 성공으로 트리거가 비활성화되면 페이지 안의 대체 위치에 포커스를 둔다', async () => {
  mockScenario.signIn(SEED.professor)
  renderApp('/professor/courses')
  const row = await screen.findByTestId(`professor-course-row-${SEED.course.closable}`)
  await userEvent.click(within(row).getByRole('button', { name: '폐강' }))
  const dialog = await screen.findByRole('alertdialog')
  await userEvent.click(within(dialog).getByRole('button', { name: '폐강' }))
  await waitFor(() => expect(within(row).getByRole('button', { name: '폐강' })).toBeDisabled())
  await waitFor(() => {
    const active = document.activeElement
    expect(active).toBeInstanceOf(HTMLElement)
    expect(active).not.toBe(document.body)
    expect(screen.getByRole('heading', { name: '담당 과목' }).closest('main')).toContainElement(active as HTMLElement)
    expect((active as HTMLElement).tabIndex >= 0 || (active as HTMLElement).hasAttribute('tabindex')).toBe(true)
  })
})

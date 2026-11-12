import { screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { mockScenario } from '@/mocks/scenario'
import { SEED } from '@/mocks/seed'
import { waitForPath } from '@/test/flows'
import { renderApp } from '@/test/render'

it('T1-09 익명은 로그인으로 이동한다', async () => {
  const router = renderApp('/courses')
  await waitForPath(router, '/login')
})
it.each([
  [SEED.professor, '/admin/settings', '/professor/courses', ['과목 검색', '담당 과목 조회']],
  [SEED.student, '/professor/courses', '/courses', ['과목 검색', '내 신청 내역 조회']],
  [SEED.admin, '/', '/admin/enrollments', ['과목 검색', '관리자 수강신청', '서비스 설정 관리', '폐강 대상 조회·폐강 처리']],
] as const)('T1-09 %s 역할 가드와 메뉴', async (id, start, destination, labels) => {
  mockScenario.signIn(id)
  const router = renderApp(start)
  await waitForPath(router, destination)
  const links = within(await screen.findByRole('navigation', { name: '주 메뉴' })).getAllByRole('link')
  expect(links.map((link) => link.textContent?.trim())).toEqual(labels)
})

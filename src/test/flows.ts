import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MOCK_PASSWORD } from '@/mocks/seed'

export async function login(userId: string, password = MOCK_PASSWORD) {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('사용자ID', {}, { timeout: 25000 }), userId)
  await user.type(await screen.findByLabelText('비밀번호', {}, { timeout: 25000 }), password)
  await user.click(await screen.findByRole('button', { name: '로그인' }, { timeout: 25000 }))
  return user
}

export async function courseRow(code: string) {
  return within(await screen.findByTestId(`course-row-${code}`))
}

export async function waitForPath(router: { state: { location: { pathname: string } } }, path: string, timeout = 25000) {
  await waitFor(() => expect(router.state.location.pathname).toBe(path), { timeout })
}

export function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

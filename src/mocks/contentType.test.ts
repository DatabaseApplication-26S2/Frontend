import { expect, it } from 'vitest'
import { API_BASE_URL } from '@/api/baseUrl'

it('JSON 본문 연산에 text/plain을 보내면 E09로 거부한다', async () => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'text/plain', 'X-CSRF-Protection': '1' },
    body: '{"userId":"20260001","password":"crs-demo-1234"}',
  })
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({ code: 'E09' })
})

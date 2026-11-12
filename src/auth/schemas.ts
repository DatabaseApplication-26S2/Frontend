import { z } from 'zod'

// Login fields are sent as typed: the server compares the user ID exactly, so nothing is trimmed.
export const loginSchema = z.object({
  userId: z.string().min(1, '사용자ID를 입력하세요'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
})
export type LoginValues = z.infer<typeof loginSchema>

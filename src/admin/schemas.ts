import { z } from 'zod'
import { courseCodeSchema, intInRange } from '@/professor/schemas'

// User IDs are compared exactly by the server, so the student ID is not trimmed.
export const adminEnrollSchema = z.object({
  studentId: z.string().min(1, '학번을 입력하세요'),
  courseCode: courseCodeSchema,
})
export type AdminEnrollValues = z.infer<typeof adminEnrollSchema>

export const settingsSchema = z.object({
  concurrencyLimit: intInRange(1, 1000, '동시 처리 수는 1 이상 1000 이하의 정수로 입력하세요'),
})
export type SettingsInput = z.input<typeof settingsSchema>
export type SettingsOutput = z.output<typeof settingsSchema>

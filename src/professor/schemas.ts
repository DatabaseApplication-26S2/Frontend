import { z } from 'zod'

/** Same pattern as the `CourseCode` schema in the API contract. */
export const COURSE_CODE_PATTERN = /^[A-Za-z0-9]{1,10}$/
export const courseCodeSchema = z
  .string()
  .regex(COURSE_CODE_PATTERN, '과목코드는 영문자와 숫자 1~10자로 입력하세요')

const MAX_INT = 2147483647

/** A text input holding a whole number in [min, max]; parsed to a number on submit. */
export function intInRange(min: number, max: number, message: string) {
  return z
    .string()
    .regex(/^\d+$/, message)
    .transform(Number)
    .pipe(z.number().int(message).min(min, message).max(max, message))
}

export const courseFormSchema = z
  .object({
    courseCode: courseCodeSchema,
    // Not whitespace-only, sent untrimmed (contract `pattern: '\S'`)
    name: z.string().regex(/\S/, '과목명을 입력하세요'),
    category: z.enum(['GENERAL', 'MAJOR']),
    evaluationType: z.enum(['RELATIVE', 'ABSOLUTE', 'PASS_FAIL']),
    capacity: intInRange(1, MAX_INT, '정원은 1 이상 2147483647 이하의 정수로 입력하세요'),
    minimumEnrollment: intInRange(
      1,
      MAX_INT,
      '최소 수강인원은 1 이상 2147483647 이하의 정수로 입력하세요',
    ),
    classroom: z.string().regex(/\S/, '강의실을 입력하세요'),
  })
  .superRefine((values, ctx) => {
    if (values.minimumEnrollment > values.capacity) {
      ctx.addIssue({
        code: 'custom',
        path: ['minimumEnrollment'],
        message: '최소 수강인원은 정원 이하여야 합니다',
      })
    }
  })

export type CourseFormInput = z.input<typeof courseFormSchema>
export type CourseFormOutput = z.output<typeof courseFormSchema>

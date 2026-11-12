import type {
  CourseCategory,
  CourseCategoryFilter,
  CourseStatus,
  EnrollmentType,
  EvaluationType,
  UserRole,
} from './types'

export const ROLE_LABEL: Record<UserRole, string> = {
  STUDENT: '학생',
  PROFESSOR: '교수',
  ADMIN: '관리자',
}

export const CATEGORY_LABEL: Record<CourseCategory, string> = {
  GENERAL: '교양',
  MAJOR: '전공',
}

export const CATEGORY_FILTER_LABEL: Record<CourseCategoryFilter, string> = {
  ALL: '전체',
  GENERAL: '교양',
  MAJOR: '전공',
}

export const EVALUATION_LABEL: Record<EvaluationType, string> = {
  RELATIVE: '상대평가',
  ABSOLUTE: '절대평가',
  PASS_FAIL: 'P/F',
}

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  OPEN: '개설',
  CLOSED: '폐강',
}

export const ENROLLMENT_TYPE_LABEL: Record<EnrollmentType, string> = {
  STUDENT: '학생 신청',
  ADMIN: '관리자 배정',
}

import type { UserRole } from '@/api/types'

export interface MenuItem {
  to: string
  label: string
}

/** Role menus (plan 2.2). Labels are the unit-task names; order is the display order. */
export const MENU: Record<UserRole, readonly MenuItem[]> = {
  STUDENT: [
    { to: '/courses', label: '과목 검색' },
    { to: '/me/enrollments', label: '내 신청 내역 조회' },
  ],
  PROFESSOR: [
    { to: '/courses', label: '과목 검색' },
    { to: '/professor/courses', label: '담당 과목 조회' },
  ],
  ADMIN: [
    { to: '/courses', label: '과목 검색' },
    { to: '/admin/enrollments', label: '관리자 수강신청' },
    { to: '/admin/settings', label: '서비스 설정 관리' },
    { to: '/admin/closures', label: '폐강 대상 조회·폐강 처리' },
  ],
}

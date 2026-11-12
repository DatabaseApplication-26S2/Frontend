import type { UserRole } from '@/api/types'

// 역할별 첫 화면과 화면 접근(계획 2.2). 최종 권위는 서버 검사다.

export function homePathFor(role: UserRole): '/courses' | '/professor/courses' | '/admin/enrollments' {
  switch (role) {
    case 'STUDENT':
      return '/courses'
    case 'PROFESSOR':
      return '/professor/courses'
    case 'ADMIN':
      return '/admin/enrollments'
  }
}

const ROLE_PATHS: Record<UserRole, readonly string[]> = {
  STUDENT: ['/me/enrollments'],
  PROFESSOR: ['/professor/courses'],
  ADMIN: ['/admin/enrollments', '/admin/settings', '/admin/closures'],
}

/** pathname에 쿼리·해시가 붙어 있어도 경로 부분만 본다. */
export function canAccess(role: UserRole, pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0].replace(/(.)\/+$/, '$1')
  if (path === '/courses' || /^\/courses\/[^/]+$/.test(path)) return true
  return ROLE_PATHS[role].includes(path)
}

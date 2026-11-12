import { useEffect, type JSX } from 'react'
import { Navigate, Outlet, useLocation, type Location } from 'react-router'
import type { UserRole } from '@/api/types'
import { LoginPage } from '@/auth/LoginPage'
import { ensureAdmission, useAdmissionInProgress } from '@/entry/entryFlow'
import { FullPageLoading } from '@/layout/FullPageLoading'
import { canAccess, homePathFor } from './roles'
import { useAuth, useLoggedOut, useSessionSerial } from './session'

// 라우트 가드(설계 3.3절 가드 표). 이동은 여기서만 한다. 흐름 모듈은 navigate를 부르지 않는다.

function fromOf(location: Location): string {
  return `${location.pathname}${location.search}${location.hash}`
}

function stateFrom(location: Location): string | null {
  const { state } = location
  if (typeof state !== 'object' || state === null || !('from' in state)) return null
  return typeof state.from === 'string' ? state.from : null
}

/**
 * 학생이 아직 입장하지 않았거나, 입장 반복이 시작된 뒤 현재 세션의 POST /admission 200을 받지 못했으면
 * (진행 중이거나 멈춤) true. 그동안 갱신 응답이 admittedAt을 가져와도 /login(멈춤 카드 포함)에 둔다(계획 4.1 6번).
 * 반복이 없을 때 이미 입장한 세션(부트스트랩 복구)은 그대로 통과한다(계획 4.5).
 */
function useAdmissionPending(): boolean {
  const { status, user, session } = useAuth()
  const looping = useAdmissionInProgress()
  return status === 'authenticated' && user?.role === 'STUDENT' && (!session?.admittedAt || looping)
}

/**
 * bootstrapping → 로딩, anonymous → /login(state.from), 그 밖 → Outlet.
 * 명시적 로그아웃이면 이전 사용자의 경로를 다음 로그인에 넘기지 않는다(state 없이 /login).
 */
export function RequireAuth(): JSX.Element {
  const auth = useAuth()
  const loggedOut = useLoggedOut()
  const serial = useSessionSerial()
  const location = useLocation()
  if (auth.status === 'bootstrapping') return <FullPageLoading />
  if (auth.status === 'anonymous') {
    if (loggedOut) return <Navigate to="/login" replace />
    return <Navigate to="/login" replace state={{ from: fromOf(location) }} />
  }
  // 세션 수립·사용자 전환마다 하위 화면을 다시 마운트해 새 사용자로 재구성한다.
  return <Outlet key={serial} />
}

/** 역할이 맞지 않으면 그 역할의 첫 화면으로. */
export function RequireRole({ roles }: { roles: UserRole[] }): JSX.Element {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to={homePathFor(user.role)} replace />
  return <Outlet />
}

/** 학생이고 현재 세션이 입장 전(또는 입장 반복 중)이면 입장 흐름을 시작하고 /login(state.from)으로. 교수·관리자는 통과. */
export function AdmissionGate(): JSX.Element {
  const location = useLocation()
  const pendingAdmission = useAdmissionPending()
  useEffect(() => {
    if (pendingAdmission) ensureAdmission()
  }, [pendingAdmission])
  if (pendingAdmission) return <Navigate to="/login" replace state={{ from: fromOf(location) }} />
  return <Outlet />
}

/**
 * bootstrapping → 로딩. 인증됐고 (학생 아님 또는 입장 완료·반복 없음) → state.from이 허용되면 그곳, 아니면 역할 첫 화면.
 * 그 밖(익명, 입장 전이거나 입장 반복 중인 학생) → 로그인 카드.
 * /login에서 명시적으로 로그아웃했는데(입장 멈춤 카드) state.from이 남아 있으면 그 state를 지운다.
 * 다음 로그인이 이전 사용자의 경로로 가지 않게 하기 위해서다.
 */
export function LoginRoute(): JSX.Element {
  const auth = useAuth()
  const loggedOut = useLoggedOut()
  const location = useLocation()
  const { user } = auth
  const pendingAdmission = useAdmissionPending()
  const from = stateFrom(location)
  useEffect(() => {
    if (pendingAdmission) ensureAdmission()
  }, [pendingAdmission])

  if (auth.status === 'bootstrapping') return <FullPageLoading />
  if (auth.status === 'anonymous' && loggedOut && from !== null) return <Navigate to="/login" replace />
  if (auth.status === 'authenticated' && user && !pendingAdmission) {
    const target = from !== null && canAccess(user.role, from) ? from : homePathFor(user.role)
    return <Navigate to={target} replace />
  }
  return <LoginPage />
}

/** / → 역할 첫 화면. */
export function RoleHome(): JSX.Element {
  const { user } = useAuth()
  return <Navigate to={user ? homePathFor(user.role) : '/login'} replace />
}

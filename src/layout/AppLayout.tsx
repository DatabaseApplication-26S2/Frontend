import { Link, NavLink, Outlet } from 'react-router'
import { cn } from 'cn'
import { ROLE_LABEL } from '@/api/labels'
import { logout, useAuth } from '@/auth/session'
import { Button } from '@/components/ui/button'
import { MENU } from './menu'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

/**
 * App shell for signed-in screens: text wordmark, the role menu, the current user and logout.
 * Screens render their own cards inside `<main>`.
 */
export function AppLayout() {
  const { user } = useAuth()
  const items = user ? MENU[user.role] : []

  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main"
        className={cn(
          'sr-only rounded-lg bg-card px-3 py-2 font-bold text-link underline underline-offset-4 ring-1 ring-border focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50',
          focusRing,
        )}
      >
        본문으로 건너뛰기
      </a>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2">
          <Link
            to="/"
            className={cn(
              'rounded-sm py-2 text-(length:--font-size-cta) font-bold whitespace-nowrap text-heading',
              focusRing,
            )}
          >
            수강신청
          </Link>
          <nav
            aria-label="주 메뉴"
            className="order-last w-full pb-1 lg:order-none lg:w-auto lg:flex-1 lg:pb-0"
          >
            <ul className="flex flex-wrap gap-1">
              {items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'inline-flex min-h-10 items-center rounded-lg px-3 text-sm whitespace-nowrap transition-colors',
                        focusRing,
                        isActive
                          ? 'bg-accent font-bold text-accent-foreground'
                          : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          {user ? (
            <div className="ml-auto flex items-center gap-3">
              <p data-testid="current-user" className="flex items-baseline gap-1.5 text-sm">
                <span className="font-bold">{user.name}</span>{' '}
                <span className="text-muted-foreground">{ROLE_LABEL[user.role]}</span>
              </p>
              <Button variant="outline" className="h-10 px-3" onClick={() => void logout()}>
                로그아웃
              </Button>
            </div>
          ) : null}
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 focus:outline-none"
      >
        <Outlet />
      </main>
    </div>
  )
}

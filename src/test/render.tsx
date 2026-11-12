import { StrictMode } from 'react'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppProviders } from '@/app/AppProviders'
import { routes } from '@/routes'

export function renderApp(initialPath: string, opts?: { strict?: boolean }) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  const app = <AppProviders><RouterProvider router={router} /></AppProviders>
  render(opts?.strict ? <StrictMode>{app}</StrictMode> : app)
  return router
}

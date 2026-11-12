# Database Application Frontend

**English** | [한국어](README.ko.md)

Frontend for [DatabaseApplication-26S2/Frontend](https://github.com/DatabaseApplication-26S2/Frontend), initialized from [Lapis0875/hackathon-fe-vite](https://github.com/Lapis0875/hackathon-fe-vite) at commit `f258169720150ee45c2ba19957606719fa3f9a68`. The upstream source, dependency lockfile, reference documentation, and MIT license are preserved.

Web frontend for the queue-based course registration system. It has nine screens for three roles (student, professor, admin). Login and enrollment requests go through queue tickets, so the same screen shows the queue position counting down. Scope and order follow [`plans/구현계획-frontend.md`](../plans/구현계획-frontend.md).

The API contract is [`docs/openapi.yaml`](../docs/openapi.yaml) 0.1.0; `openapi.yaml` in this folder is a copy (its sha256 must match the original). **There is no backend yet.** Every feature has been verified only against the in-browser mock (MSW) and Vitest; the real-server switch (FE-08) and the cookie acceptance check (D-09) remain open.

## What's included

| Area            | Choice                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Build           | Vite 7, React 19, TypeScript (strict), pnpm                                                                |
| UI              | Tailwind v4, shadcn/ui-based components, radix-ui dialogs, stageshow motion parts (`Roll`, `Collapse`)     |
| Routing / data  | react-router v7 (`createBrowserRouter`), TanStack Query v5 (no automatic retries)                          |
| API client      | `openapi-typescript` + `openapi-fetch`: types are generated from `openapi.yaml`, so every call is typed    |
| Forms           | react-hook-form + zod                                                                                      |
| Mocking / tests | MSW v2 (all 20 operations, shared by `pnpm dev:mock` and tests), Vitest 4 + Testing Library                |
| Lint / format   | ESLint, Prettier                                                                                           |

## Screens

| Path                   | Role     | Content                                                          |
| ---------------------- | -------- | ---------------------------------------------------------------- |
| `/login`               | Anonymous | Login → login queue position → (students) admission queue → redirect |
| `/courses`             | All      | Course search; students enroll and cancel from the row           |
| `/courses/:courseCode` | All      | Course detail with refresh                                       |
| `/me/enrollments`      | Student  | My enrollments, cancel                                           |
| `/professor/courses`   | Professor | List, create, edit and close own courses                        |
| `/admin/enrollments`   | Admin    | Admin enrollment (shows over-capacity)                           |
| `/admin/settings`      | Admin    | Concurrency limit N and slot status                              |
| `/admin/closures`      | Admin    | Closure candidates and bulk closure                              |

`/` redirects to the role's first screen (student `/courses`, professor `/professor/courses`, admin `/admin/enrollments`). Student screens open only after the current session's `POST /admission` returns 200.

## Auth model

- The access token lives only in a JS module variable: never in React state, web storage or logs. The refresh token is an HttpOnly cookie.
- On startup the app calls `POST /auth/refresh` once to restore the session. Refresh runs once per tab (one shared Promise) and across tabs (Web Locks), and is never resent after a network error.
- Web storage holds two non-secret values only (D-12): `sessionStorage['crs.pendingTicket']` (pending ticket id, type, course code) and `localStorage['crs.refreshUncertainAt']` (a timestamp written when a refresh outcome is unknown).
- The four cookie operations send `X-CSRF-Protection: 1`; every request uses `credentials: 'include'`.
- There is no signup (out of scope).

Detailed rules follow sections 3 and 4 of the plan. One deviation: ticket polling is a module-level poller instead of a TanStack query (`['ticket', ticketId]`), so that the token exchange is sent once per ticket regardless of component lifetimes and StrictMode.

## Design and typography

[DESIGN.md](DESIGN.md) defines the LMS-derived colors, typography, component states, motion and accessibility adaptations; new screens follow it. Noto Sans KR 400/700 is self-hosted through `@fontsource/noto-sans-kr`; no external font CDN is required.

Noto Sans KR uses SIL OFL 1.1, which permits course assignments and web embedding. The upstream copyright and package license are bundled in [`public/licenses/NotoSansKR-OFL.txt`](public/licenses/NotoSansKR-OFL.txt) and served at `/licenses/NotoSansKR-OFL.txt`.

## Run

Use Node 26 and pnpm 11. Keep the dependency versions in `pnpm-lock.yaml`.

```bash
pnpm install --frozen-lockfile
pnpm dev        # http://localhost:5173 — proxies /api → http://localhost:8080 (backend must be running)
pnpm dev:mock   # same, but MSW serves /api/v1/* in the browser; no backend needed
```

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

### Mock accounts (`pnpm dev:mock` only)

| Role      | User ID               |
| --------- | --------------------- |
| Student   | `20260001`–`20260060` |
| Professor | `P1001`–`P1003`       |
| Admin     | `A0001`               |

The shared password is `crs-demo-1234`. The admin ID and password are **mock-only placeholders** pending the team decision D-20 and live only in `src/mocks/seed.ts`. Course `ERR0099` is a mock-only course that reproduces E99 (processing failure).

The mock advances tickets at 1-second intervals (two waiting polls → processing → done). In the browser console, `__crsMock.scenario.expireAccess()` and `revokeSession()` simulate an expired access token and a revoked session. Mock sessions live in page memory, so a reload means logging in again.

If mock mode shows "일시적인 오류입니다", MSW did not intercept the request and the Vite proxy returned 500 for the missing backend (`localhost:8080`). A tab left hidden for a long time recovers on its own when it becomes visible again; if DevTools' Service Worker "Bypass for network" is on, turn it off and reload.

## Environment variables

Copy `.env.example` to `.env` (git-ignored).

| Variable            | Default   | Notes                                                                          |
| ------------------- | --------- | ------------------------------------------------------------------------------ |
| `VITE_USE_MOCK`     | `false`   | `true` makes MSW intercept `/api/v1/*`. `pnpm dev:mock` sets it for you         |
| `VITE_API_BASE_URL` | `/api/v1` | API base path. Default goes through the Vite proxy; `http://localhost:8080/api/v1` calls directly |

## Project layout

```
src/
  main.tsx             starts MSW (when VITE_USE_MOCK=true), renders the router
  routes.tsx           route tree and guards (RequireAuth, RequireRole, AdmissionGate)
  app/                 QueryClient (no retries), providers, test state reset
  api/                 openapi-fetch client, authFetch (Bearer, 401 refresh, auth generation), error and ticket-result messages, labels
  api/schema.d.ts      generated by openapi-typescript — do not edit
  auth/                token store, session store, refresh/bootstrap, role guards, login screen
  queue/               ticket poller (Retry-After), pending ticket record, queue status line
  entry/               entry flow (login → token exchange → admission)
  courses/             course search and detail
  enrollments/         enroll/cancel flow, my enrollments
  professor/           professor course list, create, edit, close
  admin/               admin enrollment, service settings, closure candidates and bulk closure
  layout/              app shell and role menus
  mocks/               MSW: seed.ts, db.ts, scenario.ts, handlers/*.ts; browser.ts for dev, server.ts for tests
  components/ui/       shadcn/ui-based components
  components/motion/   Roll and Collapse copied from stageshow (MIT, LICENSE in the same folder)
  test/                Vitest setup, render helper, shared flows
openapi.yaml           copy of docs/openapi.yaml; input of `pnpm gen:api`
```

## Reference pack

`docs/refs/` holds Context7 snapshots of the official docs for every library above (React, Vite, Tailwind, shadcn/ui, React Router, TanStack Query, openapi-fetch, React Hook Form, Zod, Vitest, Testing Library, MSW, ESLint, Prettier, …). Start from [`docs/refs/INDEX.md`](docs/refs/INDEX.md); it lists each topic with its docs version, the project version, and the pinned Context7 ID.

It also covers libraries that are not dependencies yet but common in hackathon features: CSV and spreadsheets in the browser (Papa Parse, SheetJS), tables and large lists (TanStack Table with shadcn's data table, TanStack Virtual), dashboards and form inputs (shadcn charts with Recharts, date-fns, shadcn date picker with React DayPicker, Zustand), and end-to-end tests (Playwright). Their `INDEX.md` rows say "Not a dependency yet" and list the npm version to install.

Dependencies are pinned to exact versions that have a Context7 snapshot, so the docs match the code. Libraries without a snapshot for their major (Tailwind v4, Radix, React Hook Form, `@hookform/resolvers` v7, openapi-fetch/openapi-typescript) use docs from the library's default branch; `INDEX.md` marks them.

Refresh or extend: edit `docs/refs/manifest.json`, then run `node scripts/fetch-refs.mjs` (`--force` to refetch, `--only <text>` to filter). Requires Node ≥ 22.13 and `npx ctx7 login` (or `CONTEXT7_API_KEY`); each entry costs one Context7 API call.

## Extending

### Contract changed → regenerate types

```bash
cp ../docs/openapi.yaml openapi.yaml   # refresh the copy (sha256 must match the original)
pnpm gen:api && pnpm typecheck         # contract mismatches in handlers and screens surface here
```

Then `api.GET('/courses')` (no `/api/v1` prefix) is fully typed, path and body included.

### Add a query hook

```ts
// shape of src/courses/queries.ts
import { useQuery } from '@tanstack/react-query'
import { api, unwrap } from '@/api/client'

export function useCourse(courseCode: string) {
  return useQuery({
    queryKey: ['course', courseCode],
    queryFn: () => unwrap(api.GET('/courses/{courseCode}', { params: { path: { courseCode } } })),
  })
}
```

`unwrap` throws error responses as `ApiError`; `problemMessage()` in `src/api/messages.ts` turns them into the copy from the plan's tables 5.6 and 5.7.

### Add a page

1. Write the screen component in its feature folder (e.g. `src/courses/CoursesPage.tsx`).
2. Register it under the right guard in `src/routes.tsx`, and update `canAccess` in `src/auth/roles.ts` and the role menus in `src/layout/menu.ts`.

### Add a mock handler

Add the handler to the matching file in `src/mocks/handlers/`; check response bodies with `satisfies Schemas[...]`. It applies to both `pnpm dev:mock` and tests.

### Add a form

Follow `src/auth/LoginForm.tsx`: zod schema → `zodResolver` → `Field` / `FieldError`. `formErrorsFrom()` maps server errors (`violations`, E10, E11, E13, …) to field messages.

## License

Application code: MIT. Bundled Noto Sans KR font: SIL OFL 1.1; see the [font notice](public/licenses/NotoSansKR-OFL.txt). Stageshow copies in `src/components/motion/`: MIT (Copyright (c) 2026 Benji Taylor); the [notice](src/components/motion/LICENSE) stays in that folder.

# Database Application Frontend

[한국어](README.md) | **English**

Frontend for [DatabaseApplication-26S2/Frontend](https://github.com/DatabaseApplication-26S2/Frontend), initialized from [Lapis0875/hackathon-fe-vite](https://github.com/Lapis0875/hackathon-fe-vite) at commit `f258169720150ee45c2ba19957606719fa3f9a68`. The upstream source, dependency lockfile, reference documentation, and MIT license are preserved.

Web frontend for the queue-based course registration system (CRS). It has screens for three roles (student, professor, admin). Login and enrollment requests go through queue tickets, so the same screen shows the queue position counting down.

The real backend (API server) is the [DatabaseApplication-26S2/Backend](https://github.com/DatabaseApplication-26S2/Backend) repository. The API contract is `openapi.yaml` (version 0.1.0); `openapi.yaml` in this repository is the same file as `docs/openapi.yaml` in the Backend repository (the two files must be byte-identical). Both repositories are currently private, so cloning them requires an invitation to the repositories.

## Running at a glance

Pick the one route that fits your purpose.

| Route                        | Purpose                             | Backend                                      | URL                     | Login accounts                               |
| ---------------------------- | ----------------------------------- | -------------------------------------------- | ----------------------- | -------------------------------------------- |
| 1. Full stack (Docker)       | Grading, demos                      | Runs together in Docker                      | `http://localhost`      | Seed accounts, password `Demo-password1!`    |
| 2. Dev server + real backend | Frontend development                | Backend dev mode (`localhost:8080`)          | `http://localhost:5173` | Seed accounts, password `Demo-password1!`    |
| 3. Mock server only          | Check the screens without a backend | None (MSW, a mock server inside the browser) | `http://localhost:5173` | Mock-only accounts, password `crs-demo-1234` |

The two sets of accounts are different. See [Accounts](#accounts) for the full list.

### 1. Full stack (Docker, for grading and demos)

Starts four containers at once: PostgreSQL, Redis, the API and the web server. This repository alone cannot run it; you also need the Backend repository and the run configuration file `compose.yaml`. The submission ZIP package already contains `backend/`, `frontend/`, `compose.yaml` and `.env.example`; if you received the ZIP, skip steps 2 and 3 and continue from step 4 inside the unzipped `crs-package/` folder (the one holding `compose.yaml`). The ZIP's `README.md` (and `README.pdf`) describes the same steps in more detail.

1. Install Git and Docker. On Windows and macOS, install Docker Desktop and keep it running. On Linux, install Docker Engine and the Docker Compose plugin.
2. Create an empty folder and clone the two repositories side by side as `backend` and `frontend` (same on Windows PowerShell, macOS and Linux).

   ```sh
   mkdir crs
   cd crs
   git clone https://github.com/DatabaseApplication-26S2/Backend.git backend
   git clone https://github.com/DatabaseApplication-26S2/Frontend.git frontend
   ```

3. Save the `compose.yaml` content from the "전체 스택 실행" (full-stack run) section of the [Backend README](https://github.com/DatabaseApplication-26S2/Backend) into the same folder (`crs/`) as a file named `compose.yaml`. The same `compose.yaml` is also included in the submission ZIP package, so you can copy it from there instead. The folder must look like this:

   ```text
   crs/
     compose.yaml
     .env          (created in step 4)
     backend/      (Backend repository)
     frontend/     (this repository)
   ```

4. Create `.env` in the same folder. Two values are required. `JWT_SECRET` must be URL-safe Base64 of at least 32 bytes; if it contains standard Base64 `+` or `/`, the api fails to start with `Illegal base64 character`. `POSTGRES_PASSWORD` applies only when the DB volume is first created. The commands below overwrite the whole `.env`. Once the stack has been started, do not run them again: `POSTGRES_PASSWORD` would change and the api could no longer connect to the DB. To start over, first run `docker compose down -v` (deletes the DB data).

   macOS and Linux:

   ```sh
   cat > .env <<EOF
   JWT_SECRET=$(openssl rand -base64 48 | tr '+/' '-_')
   POSTGRES_PASSWORD=$(openssl rand -hex 24)
   EOF
   ```

   Windows PowerShell (run it in the folder that holds `compose.yaml`; it writes `.env` as ASCII, without UTF-16 or a BOM):

   ```powershell
   $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
   $b = New-Object byte[] 48; $rng.GetBytes($b)
   $jwt = [Convert]::ToBase64String($b).Replace('+','-').Replace('/','_')
   $p = New-Object byte[] 24; $rng.GetBytes($p)
   $pg = -join ($p | ForEach-Object { $_.ToString('x2') })
   Set-Content -Path .env -Encoding ascii -Value "JWT_SECRET=$jwt", "POSTGRES_PASSWORD=$pg"
   ```

5. Build and start (same on every OS). The first build downloads images and the Gradle and pnpm dependencies, so it needs an internet connection and takes several minutes.

   ```sh
   docker compose up -d --build --wait
   docker compose ps
   ```

   The stack is ready when `docker compose ps` shows `db`, `redis`, `api` and `web` all as `(healthy)`. Requesting `http://localhost/api/v1/courses` without a token returns 401 (body `code` `E02`); that is expected.

6. Open `http://localhost` in Chrome and log in with a seed account. Every seed account uses the password `Demo-password1!`.

   | Role      | User ID               | First screen after login             |
   | --------- | --------------------- | ------------------------------------ |
   | Student   | `20260001`–`20260060` | `/courses` after the admission queue |
   | Professor | `P1001`–`P1003`       | `/professor/courses`                 |
   | Admin     | `A1001`               | `/admin/enrollments`                 |

- If another program already uses port 80 (common on Windows), add the two lines `WEB_PORT=8080` and `APP_FRONTEND_ORIGIN=http://localhost:8080` to `.env`, run `docker compose up -d --build --wait` again, and open `http://localhost:8080`. `APP_FRONTEND_ORIGIN` must equal the origin in the browser's address bar exactly; otherwise login fails with 403 (`code` `E02`, `reason` `CSRF_CHECK_FAILED`).
- With the default `WEB_PORT`, the web port listens on all of this PC's network interfaces, so other PCs on the same network can reach it and could log in with the public seed password using a tool such as curl. To allow access from this PC only, put `WEB_PORT=127.0.0.1:80` in `.env`. With port 8080, put `WEB_PORT=127.0.0.1:8080` and `APP_FRONTEND_ORIGIN=http://localhost:8080`. The address to open stays `http://localhost` (`http://localhost:8080` with port 8080); opening `http://127.0.0.1` gives a different Origin, and login fails with 403.
- The auth cookies are always `Secure`. Browsers accept them on `http://localhost` without HTTPS, but logging in from a browser on another PC through a server IP or domain requires HTTPS (see [Deploy (Docker)](#deploy-docker)). Cookie behavior was checked in Chrome, so Chrome is recommended.
- Stop and restart with `docker compose stop` / `docker compose start`. `docker compose down` removes the containers but keeps the DB data. `docker compose down -v` also deletes the DB data; the next `docker compose up` seeds it again.

### 2. Dev server + real backend

1. Run the Backend repository in dev mode (default profile `local`) on `http://localhost:8080`; follow the [Backend README](https://github.com/DatabaseApplication-26S2/Backend) for how. Dev mode creates the same seed accounts, and the only browser origin the backend allows is `http://localhost:5173`.
2. In this repository's folder, set up the prerequisites from [Run](#run), then start the dev server.

   ```sh
   pnpm install --frozen-lockfile
   pnpm dev
   ```

3. Open `http://localhost:5173` in Chrome and log in with the same seed accounts as route 1 (password `Demo-password1!`).

The Vite dev server proxies `/api` requests to `http://localhost:8080`, so the browser sees a single origin. `strictPort` is on: if port 5173 is taken, the dev server fails to start instead of moving to another port, because any other port would not match the origin the backend allows and every cookie operation would return 403.

### 3. Mock server only

Check the screens without a backend. MSW answers `/api/v1/*` inside the browser.

```sh
pnpm install --frozen-lockfile
pnpm dev:mock
```

Open `http://localhost:5173`. The mock accounts differ from the real backend accounts: the admin is `A0001`, and every account uses the password `crs-demo-1234` (see [Accounts](#accounts)).

## What's included

| Area            | Choice                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Build           | Vite 7, React 19, TypeScript (strict), pnpm                                                             |
| UI              | Tailwind v4, shadcn/ui-based components, radix-ui dialogs, stageshow motion parts (`Roll`, `Collapse`)  |
| Routing / data  | react-router v7 (`createBrowserRouter`), TanStack Query v5 (no automatic retries)                       |
| API client      | `openapi-typescript` + `openapi-fetch`: types are generated from `openapi.yaml`, so every call is typed |
| Forms           | react-hook-form + zod                                                                                   |
| Mocking / tests | MSW v2 (all 20 operations, shared by `pnpm dev:mock` and tests), Vitest 4 + Testing Library             |
| Lint / format   | ESLint, Prettier                                                                                        |

## Screens

| Path                   | Role      | Content                                                              |
| ---------------------- | --------- | -------------------------------------------------------------------- |
| `/login`               | Anonymous | Login → login queue position → (students) admission queue → redirect |
| `/courses`             | All       | Course search; students enroll and cancel from the row               |
| `/courses/:courseCode` | All       | Course detail with refresh                                           |
| `/me/enrollments`      | Student   | My enrollments, cancel                                               |
| `/professor/courses`   | Professor | List, create, edit and close own courses                             |
| `/admin/enrollments`   | Admin     | Admin enrollment (shows over-capacity)                               |
| `/admin/settings`      | Admin     | Concurrency limit N and slot status                                  |
| `/admin/closures`      | Admin     | Closure candidates and bulk closure                                  |

`/` redirects to the role's first screen (student `/courses`, professor `/professor/courses`, admin `/admin/enrollments`). Student screens open only after the current session's `POST /admission` returns 200.

## Auth model

- The access token lives only in a JS module variable: never in React state, web storage or logs. The refresh token is an HttpOnly cookie.
- On startup the app calls `POST /auth/refresh` once to restore the session. Refresh runs once per tab (one shared Promise) and across tabs (Web Locks), and is never resent after a network error.
- Web storage holds two non-secret values only: `sessionStorage['crs.pendingTicket']` (pending ticket id, type, course code) and `localStorage['crs.refreshUncertainAt']` (a timestamp written when a refresh outcome is unknown).
- The four cookie operations send `X-CSRF-Protection: 1`; every request uses `credentials: 'include'`.
- There is no signup (out of scope).

Ticket polling is a module-level poller instead of a TanStack query (`['ticket', ticketId]`), so that the token exchange is sent once per ticket regardless of component lifetimes and StrictMode.

## Design and typography

[DESIGN.md](DESIGN.md) defines the LMS-derived colors, typography, component states, motion and accessibility adaptations; new screens follow it. Noto Sans KR 400/700 is self-hosted through `@fontsource/noto-sans-kr`; no external font CDN is required.

Noto Sans KR uses SIL OFL 1.1, which permits course assignments and web embedding. The upstream copyright and package license are bundled in [`public/licenses/NotoSansKR-OFL.txt`](public/licenses/NotoSansKR-OFL.txt) and served at `/licenses/NotoSansKR-OFL.txt`.

## Run

This section covers the dev server (routes 2 and 3). The full stack (route 1) needs only Docker, not Node.js or pnpm.

### Prerequisites

- Node.js 26
- pnpm 11. The Docker image pins pnpm 11.7.0. Node 25 and later no longer bundle corepack, so install the same version with npm (same on Windows PowerShell, macOS and Linux):

  ```sh
  npm install -g pnpm@11.7.0
  ```

- For route 2, the Backend running in dev mode on `http://localhost:8080` (see the [Backend README](https://github.com/DatabaseApplication-26S2/Backend))

### Commands

Keep the dependency versions in `pnpm-lock.yaml` (same on Windows PowerShell, macOS and Linux).

```sh
pnpm install --frozen-lockfile
pnpm dev        # http://localhost:5173 — proxies /api → http://localhost:8080 (backend must be running)
pnpm dev:mock   # same, but MSW serves /api/v1/* in the browser; no backend needed
```

`pnpm dev:mock` is a script that runs `VITE_USE_MOCK=true vite`, passing the environment variable with POSIX shell syntax. On Windows, pnpm runs scripts with cmd.exe, so this command fails there. Instead, put `VITE_USE_MOCK=true` in `.env` and run `pnpm dev` (same behavior; see [Environment variables](#environment-variables)). Before going back to route 2 (real backend), remove that line or set it to `VITE_USE_MOCK=false`; otherwise `pnpm dev` keeps using the mock server.

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

### Accounts

The real backend (routes 1 and 2) and the mock server (route 3) use different accounts. Student and professor user IDs are the same in both, but the passwords differ (`Demo-password1!` vs `crs-demo-1234`) and so does the admin ID (`A1001` vs `A0001`). As a result, mock accounts cannot log in to the real backend, and vice versa.

| Role            | Real backend seed (Docker, `pnpm dev`) | Mock server (`pnpm dev:mock` only) |
| --------------- | -------------------------------------- | ---------------------------------- |
| Student         | `20260001`–`20260060`                  | `20260001`–`20260060`              |
| Professor       | `P1001`–`P1003`                        | `P1001`–`P1003`                    |
| Admin           | `A1001`                                | `A0001`                            |
| Shared password | `Demo-password1!`                      | `crs-demo-1234`                    |

- Real backend seed: the Backend's Flyway seed (V900) inserts it under the `local` and `demo` profiles. The courses are `DEMO01`–`DEMO25` (`DEMO01` capacity 3, `DEMO02` capacity 1), and student `20260001` starts with one enrollment in `DEMO03` assigned by admin `A1001`. The concurrency limit N starts at 100.
- Mock server: its accounts and courses are mock-only values that live only in `src/mocks/seed.ts` and are never used against a real server. Its course codes also differ from the real seed (e.g. `CSE3010`), and course `ERR0099` is a mock-only course that reproduces E99 (processing failure).

### Mock server behavior

The mock advances tickets at 1-second intervals (two waiting polls → processing → done). In the browser console, `__crsMock.scenario.expireAccess()` and `__crsMock.scenario.revokeSession()` simulate an expired access token and a revoked session. Mock sessions live in page memory, so a reload means logging in again.

If mock mode shows "일시적인 오류입니다", MSW did not intercept the request and the Vite proxy returned 500 for the missing backend (`localhost:8080`). A tab left hidden for a long time recovers on its own when it becomes visible again; if DevTools' Service Worker "Bypass for network" is on, turn it off and reload.

## Environment variables

This is this repository's `.env`, read by `pnpm dev` and `pnpm dev:mock`. It is a different file from the full-stack `.env` (next to `compose.yaml`, holding `JWT_SECRET` and so on). Copy `.env.example` to `.env` only when you need it (git-ignored); without the file, the defaults below apply.

macOS and Linux:

```sh
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

| Variable            | Default   | Notes                                                                                             |
| ------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `VITE_USE_MOCK`     | `false`   | `true` makes MSW intercept `/api/v1/*`. `pnpm dev:mock` sets it for you                           |
| `VITE_API_BASE_URL` | `/api/v1` | API base path. Default goes through the Vite proxy; `http://localhost:8080/api/v1` calls directly |

## Deploy (Docker)

`Dockerfile` builds the image in two stages. Stage 1 (`node:26-alpine`) installs the dependencies with pnpm 11.7.0 and builds the SPA. Stage 2 (`caddy:2-alpine`) serves it with Caddy on port 80 (HTTP only). Caddy serves `dist/`, falls back to `index.html` for client routes, and proxies `/api/*` unchanged (including the `Origin` header) to `API_UPSTREAM` (default `api:8080`).

The image runs as the `web` service of the full stack. In `compose.yaml`, `web` builds `./frontend`, sets `API_UPSTREAM: api:8080`, and is the only one of the four services that publishes a port (`${WEB_PORT:-80}:80`). To run it, follow route 1 in [Running at a glance](#running-at-a-glance).

- The auth cookies carry the `__Host-` prefix and are always `Secure`. On `http://localhost` browsers accept them, so login works without HTTPS. Any address other than localhost (a server IP or domain) requires HTTPS; over plain HTTP, login breaks.
- The backend's `APP_FRONTEND_ORIGIN` must equal the origin the browser uses exactly (default `http://localhost`; `https://<domain>` on a public server). Any other value makes cookie operations return 403 (`code` `E02`, `reason` `CSRF_CHECK_FAILED`).
- `VITE_*` values are fixed at build time. `.dockerignore` keeps `.env` out of the build, so the image uses the defaults (`VITE_API_BASE_URL=/api/v1`, mock off).

When exposing it on a server:

- Run the same `compose.yaml` on a Linux host with Docker.
- Put a TLS-terminating reverse proxy (e.g. Nginx Proxy Manager, Caddy, nginx) in front of `web`'s port and force HTTPS.
- Set `APP_FRONTEND_ORIGIN=https://<domain>` in `.env`.
- Do not let the proxy rewrite the `Origin` header. Do not add Basic Auth, because the app uses the `Authorization: Bearer` header.
- Keep the db, redis and api ports unpublished.
- Before making the site public, change the seed account passwords: the admin ID `A1001` and the shared password `Demo-password1!` are public. Follow the "시드 계정 비밀번호 바꾸기" (changing seed account passwords) section of the [Backend README](https://github.com/DatabaseApplication-26S2/Backend).

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
openapi.yaml           same file as docs/openapi.yaml in the Backend repository; input of `pnpm gen:api`
Dockerfile, Caddyfile  deployment image (SPA build + Caddy)
```

## Reference pack

`docs/refs/` holds Context7 snapshots of the official docs for every library above (React, Vite, Tailwind, shadcn/ui, React Router, TanStack Query, openapi-fetch, React Hook Form, Zod, Vitest, Testing Library, MSW, ESLint, Prettier, …). Start from [`docs/refs/INDEX.md`](docs/refs/INDEX.md); it lists each topic with its docs version, the project version, and the pinned Context7 ID.

It also covers libraries that are not dependencies yet but common in hackathon features: CSV and spreadsheets in the browser (Papa Parse, SheetJS), tables and large lists (TanStack Table with shadcn's data table, TanStack Virtual), dashboards and form inputs (shadcn charts with Recharts, date-fns, shadcn date picker with React DayPicker, Zustand), and end-to-end tests (Playwright). Their `INDEX.md` rows say "Not a dependency yet" and list the npm version to install.

Dependencies are pinned to exact versions that have a Context7 snapshot, so the docs match the code. Libraries without a snapshot for their major (Tailwind v4, Radix, React Hook Form, `@hookform/resolvers` v7, openapi-fetch/openapi-typescript) use docs from the library's default branch; `INDEX.md` marks them.

Refresh or extend: edit `docs/refs/manifest.json`, then run `node scripts/fetch-refs.mjs` (`--force` to refetch, `--only <text>` to filter). Requires Node ≥ 22.13 and `npx ctx7 login` (or `CONTEXT7_API_KEY`); each entry costs one Context7 API call.

## Extending

### Contract changed → regenerate types

The source of the contract is `docs/openapi.yaml` in the Backend repository. If both repositories are cloned side by side as `backend/` and `frontend/`, run the following in the `frontend/` folder.

macOS and Linux:

```bash
cp ../backend/docs/openapi.yaml openapi.yaml   # refresh the copy (the two files must be byte-identical)
pnpm gen:api && pnpm typecheck                 # contract mismatches in handlers and screens surface here
```

Windows PowerShell:

```powershell
Copy-Item ..\backend\docs\openapi.yaml openapi.yaml
pnpm gen:api
pnpm typecheck
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

`unwrap` throws error responses as `ApiError`; `problemMessage()` in `src/api/messages.ts` turns them into on-screen messages per error code.

### Add a page

1. Write the screen component in its feature folder (e.g. `src/courses/CoursesPage.tsx`).
2. Register it under the right guard in `src/routes.tsx`, and update `canAccess` in `src/auth/roles.ts` and the role menus in `src/layout/menu.ts`.

### Add a mock handler

Add the handler to the matching file in `src/mocks/handlers/`; check response bodies with `satisfies Schemas[...]`. It applies to both `pnpm dev:mock` and tests.

### Add a form

Follow `src/auth/LoginForm.tsx`: zod schema → `zodResolver` → `Field` / `FieldError`. `formErrorsFrom()` maps server errors (`violations`, E10, E11, E13, …) to field messages.

## License

Application code: MIT. Bundled Noto Sans KR font: SIL OFL 1.1; see the [font notice](public/licenses/NotoSansKR-OFL.txt). Stageshow copies in `src/components/motion/`: MIT (Copyright (c) 2026 Benji Taylor); the [notice](src/components/motion/LICENSE) stays in that folder.

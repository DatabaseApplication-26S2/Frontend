# Database Application Frontend

[English](README.md) | **한국어**

[DatabaseApplication-26S2/Frontend](https://github.com/DatabaseApplication-26S2/Frontend)의 프론트엔드입니다. [Lapis0875/hackathon-fe-vite](https://github.com/Lapis0875/hackathon-fe-vite)의 커밋 `f258169720150ee45c2ba19957606719fa3f9a68`을 기반으로 초기 설정했습니다. 원본 코드 구조, 의존성 잠금 파일, 참조 문서와 MIT 라이선스를 유지합니다.

대기열 기반 수강신청 시스템의 웹 프런트엔드입니다. 학생·교수·관리자 세 역할의 화면 9개가 있고, 로그인과 수강신청 요청은 대기열 티켓으로 처리되어 같은 화면에서 순번이 줄어드는 모습을 보여 줍니다. 구현 범위와 순서는 [`plans/구현계획-frontend.md`](../plans/구현계획-frontend.md)를 따릅니다.

API 계약은 [`docs/openapi.yaml`](../docs/openapi.yaml) 0.1.0이며, 이 폴더의 `openapi.yaml`은 그 사본입니다(sha256이 원본과 같아야 합니다). **백엔드는 아직 없습니다.** 그래서 모든 기능은 브라우저 모의 서버(MSW)와 Vitest로만 검증했고, 실서버 전환(FE-08)과 쿠키 수용 실측(D-09)은 남아 있습니다.

## 포함된 것

| 영역            | 선택                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| 빌드            | Vite 7, React 19, TypeScript(strict), pnpm                                                               |
| UI              | Tailwind v4, shadcn/ui 기반 컴포넌트, radix-ui 대화상자, stageshow 모션 부품(`Roll`, `Collapse`)          |
| 라우팅 / 데이터 | react-router v7(`createBrowserRouter`), TanStack Query v5(자동 재시도 없음)                               |
| API 클라이언트  | `openapi-typescript` + `openapi-fetch`: `openapi.yaml`에서 타입을 생성하므로 모든 요청/응답에 타입이 붙음 |
| 폼              | react-hook-form + zod                                                                                    |
| 모킹 / 테스트   | MSW v2(20개 연산 전부, `pnpm dev:mock`과 테스트가 공유), Vitest 4 + Testing Library                       |
| 린트 / 포맷     | ESLint, Prettier                                                                                         |

## 화면

| 경로                   | 역할      | 내용                                                    |
| ---------------------- | --------- | ------------------------------------------------------- |
| `/login`               | 익명      | 로그인 → 로그인 대기 순번 → (학생) 입장 대기 순번 → 이동 |
| `/courses`             | 전 역할   | 과목 검색. 학생은 행에서 신청·취소                       |
| `/courses/:courseCode` | 전 역할   | 과목 상세, 새로고침                                     |
| `/me/enrollments`      | 학생      | 내 신청 내역, 취소                                      |
| `/professor/courses`   | 교수      | 담당 과목 조회·등록·수정·폐강                           |
| `/admin/enrollments`   | 관리자    | 관리자 수강신청(정원 초과 표시)                         |
| `/admin/settings`      | 관리자    | 동시 처리 수 N과 슬롯 현황                              |
| `/admin/closures`      | 관리자    | 폐강 대상 조회와 일괄 폐강                              |

`/`는 역할 첫 화면(학생 `/courses`, 교수 `/professor/courses`, 관리자 `/admin/enrollments`)으로 보냅니다. 학생 화면은 현재 세션의 `POST /admission`이 200을 준 뒤에만 열립니다.

## 인증 모델

- Access 토큰은 JS 모듈 변수에만 둡니다. React 상태, 웹 저장소, 로그에 넣지 않습니다. Refresh는 HttpOnly 쿠키입니다.
- 앱 시작 때 `POST /auth/refresh`를 한 번 호출해 세션을 복구합니다. 갱신은 탭 안에서 Promise 하나, 탭 사이에서는 Web Locks로 한 번만 실행하며 네트워크 오류면 다시 보내지 않습니다.
- 웹 저장소에는 비밀이 아닌 값 두 개만 둡니다(D-12): `sessionStorage['crs.pendingTicket']`(진행 중 티켓 번호·유형·과목코드), `localStorage['crs.refreshUncertainAt']`(갱신 결과를 알 수 없을 때의 시각).
- 쿠키 연산 4개에는 `X-CSRF-Protection: 1`을, 모든 요청에는 `credentials: 'include'`를 붙입니다.
- 회원가입은 범위 밖이라 없습니다.

자세한 규칙은 계획 문서 3절·4절을 따릅니다. 계획과 다른 점은 한 가지입니다. 티켓 폴링은 TanStack 질의(`['ticket', ticketId]`)가 아니라 모듈 수준 폴러로 구현했습니다. 토큰 수령을 티켓당 한 번만 보내려면 진입 흐름이 컴포넌트 수명·StrictMode와 분리돼야 하기 때문입니다.

## 디자인과 글꼴

[DESIGN.md](DESIGN.md)에 LMS 기반 색상, 타이포그래피, 컴포넌트 상태, 모션, 접근성 조정 기준을 정리했습니다. 새 화면도 이 규칙을 따릅니다. Noto Sans KR 400/700은 `@fontsource/noto-sans-kr`로 자체 호스팅하며 외부 폰트 CDN을 사용하지 않습니다.

Noto Sans KR의 SIL OFL 1.1 라이선스는 과제 사용과 웹 임베딩을 허용합니다. 업스트림 저작권 고지와 패키지 라이선스 전문을 [`public/licenses/NotoSansKR-OFL.txt`](public/licenses/NotoSansKR-OFL.txt)에 포함했으며, 빌드 후 `/licenses/NotoSansKR-OFL.txt`로 제공됩니다.

## 실행

Node 26과 pnpm 11을 사용합니다. 의존성 버전은 `pnpm-lock.yaml`을 유지합니다.

```bash
pnpm install --frozen-lockfile
pnpm dev        # http://localhost:5173 — /api → http://localhost:8080 프록시 (백엔드 실행 필요)
pnpm dev:mock   # 동일하지만 MSW가 브라우저에서 /api/v1/* 를 응답. 백엔드 불필요
```

검사: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`

### 모의 서버 계정 (`pnpm dev:mock` 전용)

| 역할   | 사용자ID                 |
| ------ | ------------------------ |
| 학생   | `20260001`~`20260060`    |
| 교수   | `P1001`~`P1003`          |
| 관리자 | `A0001`                  |

공통 비밀번호는 `crs-demo-1234`입니다. 관리자 ID와 비밀번호는 팀 결정(D-20) 전의 **모의 전용 임시값**이며 `src/mocks/seed.ts` 한 곳에만 있습니다. 시연용 과목 `ERR0099`는 E99(처리 실패)를 재현하는 모의 전용 과목입니다.

모의 서버는 티켓을 1초 간격으로 진행합니다(대기 2회 → 처리 중 → 종결). 브라우저 콘솔의 `__crsMock.scenario`로 Access 만료(`expireAccess()`)나 세션 폐기(`revokeSession()`)를 흉내 낼 수 있습니다. 모의 세션은 페이지 메모리에 있으므로 새로고침하면 다시 로그인해야 합니다.

모의 모드에서 "일시적인 오류입니다"가 나오면 MSW가 요청을 가로채지 못해 Vite 프록시가 없는 백엔드(`localhost:8080`) 대신 500을 돌려준 것입니다. 오래 숨겨 둔 탭은 앱이 다시 보일 때 자동으로 복구하지만, 개발자 도구의 서비스 워커 "Bypass for network"가 켜져 있으면 끄고 새로고침하세요.

## 환경 변수

`.env.example`을 `.env`로 복사해서 사용(git 제외).

| 변수                | 기본값    | 설명                                                                         |
| ------------------- | --------- | ---------------------------------------------------------------------------- |
| `VITE_USE_MOCK`     | `false`   | `true`면 MSW가 `/api/v1/*`를 가로챕니다. `pnpm dev:mock`이 자동 설정          |
| `VITE_API_BASE_URL` | `/api/v1` | API 기준 경로. 기본은 Vite 프록시 경유, `http://localhost:8080/api/v1`이면 직접 호출 |

## 배포 (Docker)

`Dockerfile`은 SPA를 빌드한 뒤 Caddy로 80번 포트(HTTP 전용)에서 서빙합니다. Caddy는 `dist/`를 제공하고, 클라이언트 경로는 `index.html`로 돌려주며, `/api/*`는 `Origin` 헤더를 포함해 그대로 `API_UPSTREAM`(기본 `api:8080`)으로 넘깁니다.

```yaml
# 백엔드 서비스와 같은 compose.yaml
services:
  web:
    build: ./frontend
    ports: ['80:80']
    environment:
      API_UPSTREAM: api:8080 # 같은 Compose 프로젝트의 백엔드 서비스
```

- TLS는 앞단에서 종료합니다(예: Nginx Proxy Manager → `http://<호스트>:80`). 백엔드 인증 쿠키는 항상 `Secure`라서 HTTP로 접속하면 로그인이 깨집니다.
- 백엔드의 `APP_FRONTEND_ORIGIN`은 공개 HTTPS 출처(예: `https://crs.example.com`)와 정확히 같아야 합니다. 다르면 쿠키 연산이 403을 돌려줍니다.
- `VITE_*` 값은 빌드 시점에 고정됩니다. `.dockerignore`가 `.env`를 빌드에서 빼므로 이미지는 기본값(`VITE_API_BASE_URL=/api/v1`, 모의 서버 꺼짐)을 씁니다.

## 프로젝트 구성

```
src/
  main.tsx             MSW 시작(VITE_USE_MOCK=true일 때), 라우터 렌더
  routes.tsx           라우트 트리와 가드(RequireAuth, RequireRole, AdmissionGate)
  app/                 QueryClient(재시도 없음), 공급자, 테스트용 상태 초기화
  api/                 openapi-fetch 클라이언트, authFetch(Bearer·401 갱신·인증 세대), 오류·티켓 결과 메시지, 라벨
  api/schema.d.ts      openapi-typescript 생성 파일 — 직접 수정 금지
  auth/                토큰 보관, 세션 스토어, 갱신·부트스트랩, 역할 가드, 로그인 화면
  queue/               티켓 폴러(Retry-After), 진행 중 티켓 기록, 순번 표시
  entry/               진입 흐름(로그인 → 토큰 수령 → 입장)
  courses/             과목 검색·상세
  enrollments/         신청·취소 흐름, 내 신청 내역
  professor/           담당 과목 조회·등록·수정·폐강
  admin/               관리자 수강신청, 서비스 설정, 폐강 대상·일괄 폐강
  layout/              앱 셸과 역할별 메뉴
  mocks/               MSW: seed.ts, db.ts, scenario.ts, handlers/*.ts. browser.ts는 개발용, server.ts는 테스트용
  components/ui/       shadcn/ui 기반 컴포넌트
  components/motion/   stageshow에서 복사한 Roll·Collapse (MIT, 같은 폴더의 LICENSE)
  test/                Vitest 설정, render 헬퍼, 공통 흐름
openapi.yaml           docs/openapi.yaml 사본. `pnpm gen:api`의 입력
```

## 참조 팩

`docs/refs/`에 위 라이브러리(React, Vite, Tailwind, shadcn/ui, React Router, TanStack Query, openapi-fetch, React Hook Form, Zod, Vitest, Testing Library, MSW, ESLint, Prettier 등)의 공식 문서를 Context7에서 받아 둔 스냅샷이 있습니다. [`docs/refs/INDEX.md`](docs/refs/INDEX.md)에서 시작하세요. 주제별 문서 버전, 프로젝트 버전, 고정된 Context7 ID가 정리되어 있습니다.

아직 의존성은 아니지만 해커톤 기능에 자주 쓰는 라이브러리도 포함했습니다: 브라우저 CSV·스프레드시트(Papa Parse, SheetJS), 표와 대용량 목록(TanStack Table + shadcn data table, TanStack Virtual), 대시보드와 입력 폼(shadcn charts + Recharts, date-fns, shadcn date picker + React DayPicker, Zustand), E2E 테스트(Playwright). `INDEX.md`에서 이 항목들은 "Not a dependency yet"로 표시되고 설치할 npm 버전이 함께 적혀 있습니다.

의존성은 Context7 스냅샷이 있는 정확한 버전으로 고정했습니다. 그래서 문서와 코드의 버전이 일치합니다. 해당 메이저의 스냅샷이 없는 라이브러리(Tailwind v4, Radix, React Hook Form, `@hookform/resolvers` v7, openapi-fetch/openapi-typescript)는 기본 브랜치 문서를 사용하며, `INDEX.md`에 표시해 두었습니다.

갱신·추가: `docs/refs/manifest.json`을 수정한 뒤 `node scripts/fetch-refs.mjs` 실행(`--force` 재수집, `--only <text>` 필터). Node 22.13 이상과 `npx ctx7 login`(또는 `CONTEXT7_API_KEY`)이 필요하고, 항목 하나당 Context7 API 호출 1회를 씁니다.

## 확장하기

### 계약이 바뀌었을 때 → 타입 재생성

```bash
cp ../docs/openapi.yaml openapi.yaml   # 사본 갱신(sha256이 원본과 같아야 함)
pnpm gen:api && pnpm typecheck         # 핸들러·화면의 계약 불일치를 여기서 잡는다
```

이후 `api.GET('/courses')`처럼 기준 경로(`/api/v1`) 없이 쓰면 경로와 본문까지 타입이 맞춰집니다.

### 조회 훅 추가

```ts
// src/courses/queries.ts 의 형태
import { useQuery } from '@tanstack/react-query'
import { api, unwrap } from '@/api/client'

export function useCourse(courseCode: string) {
  return useQuery({
    queryKey: ['course', courseCode],
    queryFn: () => unwrap(api.GET('/courses/{courseCode}', { params: { path: { courseCode } } })),
  })
}
```

`unwrap`은 오류 응답을 `ApiError`로 던집니다. 화면 문구는 `src/api/messages.ts`의 `problemMessage()`가 계획 5.6·5.7 표대로 만듭니다.

### 페이지 추가

1. 화면 컴포넌트를 해당 기능 폴더에 작성합니다(예: `src/courses/CoursesPage.tsx`).
2. `src/routes.tsx`의 알맞은 가드 아래에 등록하고, `src/auth/roles.ts`의 `canAccess`와 `src/layout/menu.ts`의 역할별 메뉴를 함께 갱신합니다.

### 모의 핸들러 추가

`src/mocks/handlers/` 아래 해당 파일에 핸들러를 더합니다. 응답 본문은 `satisfies Schemas[...]`로 계약 타입을 검사합니다. `pnpm dev:mock`과 테스트에 모두 적용됩니다.

### 폼 추가

`src/auth/LoginForm.tsx`를 따라 zod 스키마 → `zodResolver` → `Field` / `FieldError`. 서버 오류는 `formErrorsFrom()`이 필드별 문구(`violations`, E10·E11·E13 등)로 바꿔줍니다.

## 라이선스

앱 코드: MIT. 동봉한 Noto Sans KR 폰트: SIL OFL 1.1. [폰트 라이선스 고지](public/licenses/NotoSansKR-OFL.txt)를 참고하세요. `src/components/motion/`의 stageshow 복사본: MIT(Copyright (c) 2026 Benji Taylor), [고지](src/components/motion/LICENSE)를 같은 폴더에 둡니다.

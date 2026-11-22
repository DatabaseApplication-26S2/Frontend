# Database Application Frontend

**한국어** | [English](README.en.md)

[DatabaseApplication-26S2/Frontend](https://github.com/DatabaseApplication-26S2/Frontend)의 프런트엔드입니다. [Lapis0875/hackathon-fe-vite](https://github.com/Lapis0875/hackathon-fe-vite)의 커밋 `f258169720150ee45c2ba19957606719fa3f9a68`을 기반으로 초기 설정했습니다. 원본 코드 구조, 의존성 잠금 파일, 참조 문서와 MIT 라이선스를 유지합니다.

대기열 기반 수강신청 시스템(CRS)의 웹 프런트엔드입니다. 학생·교수·관리자 세 역할의 화면이 있고, 로그인과 수강신청 요청은 대기열 티켓으로 처리되어 같은 화면에서 순번이 줄어드는 모습을 보여 줍니다.

실제 백엔드(API 서버)는 [DatabaseApplication-26S2/Backend](https://github.com/DatabaseApplication-26S2/Backend) 저장소입니다. API 계약은 `openapi.yaml`(버전 0.1.0)이며, 이 저장소의 `openapi.yaml`은 Backend 저장소의 `docs/openapi.yaml`과 같은 파일입니다(두 파일은 바이트 단위로 같아야 합니다). 두 저장소는 현재 비공개이므로 클론하려면 저장소 초대가 필요합니다.

## 실행 방법 한눈에

용도에 맞는 방법 하나를 고릅니다.

| 방법                       | 용도                  | 백엔드                              | 접속 주소               | 로그인 계정                              |
| -------------------------- | --------------------- | ----------------------------------- | ----------------------- | ---------------------------------------- |
| 1. 전체 스택(Docker)       | 채점·시연             | Docker로 함께 실행                  | `http://localhost`      | 시드 계정, 비밀번호 `Demo-password1!`    |
| 2. 개발 서버 + 실제 백엔드 | 프런트엔드 개발       | Backend 개발 모드(`localhost:8080`) | `http://localhost:5173` | 시드 계정, 비밀번호 `Demo-password1!`    |
| 3. 모의 서버만             | 백엔드 없이 화면 확인 | 없음(브라우저 안의 모의 서버 MSW)   | `http://localhost:5173` | 모의 전용 계정, 비밀번호 `crs-demo-1234` |

두 종류의 계정은 서로 다릅니다. 전체 목록은 [계정](#계정)을 봅니다.

### 1. 전체 스택 (Docker, 채점·시연용)

PostgreSQL·Redis·API·웹 서버 컨테이너 네 개를 한 번에 띄웁니다. 이 저장소만으로는 실행할 수 없고 Backend 저장소와 실행 구성 파일 `compose.yaml`이 함께 필요합니다. 제출용 ZIP 패키지에는 `backend/`, `frontend/`, `compose.yaml`, `.env.example`이 이미 들어 있으므로, ZIP을 받았다면 2·3단계를 건너뛰고 ZIP에 동봉된 안내를 따릅니다.

1. Git과 Docker를 설치합니다. Windows·macOS는 Docker Desktop을 설치하고 실행해 둡니다. Linux는 Docker Engine과 Docker Compose 플러그인을 설치합니다.
2. 빈 폴더를 만들고 두 저장소를 `backend`, `frontend`라는 이름으로 나란히 클론합니다(Windows PowerShell·macOS·Linux 공통).

   ```sh
   mkdir crs
   cd crs
   git clone https://github.com/DatabaseApplication-26S2/Backend.git backend
   git clone https://github.com/DatabaseApplication-26S2/Frontend.git frontend
   ```

3. [Backend README](https://github.com/DatabaseApplication-26S2/Backend)의 "전체 스택 실행" 절에 있는 `compose.yaml` 내용을 같은 폴더(`crs/`)에 `compose.yaml`이라는 이름으로 저장합니다. 같은 `compose.yaml`은 제출용 ZIP 패키지에도 들어 있으므로 ZIP에서 복사해도 됩니다. 폴더 구성은 다음과 같아야 합니다.

   ```text
   crs/
     compose.yaml
     .env          (4단계에서 만듦)
     backend/      (Backend 저장소)
     frontend/     (이 저장소)
   ```

4. 같은 폴더에서 `.env`를 만듭니다. 필수 값은 두 개입니다. `JWT_SECRET`은 URL-safe Base64로 32바이트 이상이어야 합니다. 일반 Base64의 `+`, `/`가 섞이면 api가 `Illegal base64 character` 오류로 기동하지 못합니다. `POSTGRES_PASSWORD`는 DB 볼륨을 처음 만들 때만 적용됩니다.

   macOS·Linux:

   ```sh
   cat > .env <<EOF
   JWT_SECRET=$(openssl rand -base64 48 | tr '+/' '-_')
   POSTGRES_PASSWORD=$(openssl rand -hex 24)
   EOF
   ```

   Windows PowerShell(`compose.yaml`이 있는 폴더에서 실행하며, `.env`를 UTF-16이나 BOM 없이 ASCII로 씁니다):

   ```powershell
   $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
   $b = New-Object byte[] 48; $rng.GetBytes($b)
   $jwt = [Convert]::ToBase64String($b).Replace('+','-').Replace('/','_')
   $p = New-Object byte[] 24; $rng.GetBytes($p)
   $pg = -join ($p | ForEach-Object { $_.ToString('x2') })
   Set-Content -Path .env -Encoding ascii -Value "JWT_SECRET=$jwt", "POSTGRES_PASSWORD=$pg"
   ```

5. 빌드하고 기동합니다(모든 OS 공통). 첫 빌드는 이미지와 Gradle·pnpm 의존성을 내려받으므로 인터넷 연결이 필요하고 몇 분 걸립니다.

   ```sh
   docker compose up -d --build --wait
   docker compose ps
   ```

   `docker compose ps`에서 `db`, `redis`, `api`, `web`이 모두 `(healthy)`이면 준비된 것입니다. 토큰 없이 `http://localhost/api/v1/courses`를 요청하면 401(본문 `code`가 `E02`)이 오는 것이 정상입니다.

6. Chrome에서 `http://localhost`에 접속해 시드 계정으로 로그인합니다. 비밀번호는 모두 `Demo-password1!`입니다.

   | 역할   | 사용자ID              | 로그인 후 첫 화면       |
   | ------ | --------------------- | ----------------------- |
   | 학생   | `20260001`–`20260060` | 입장 대기 후 `/courses` |
   | 교수   | `P1001`–`P1003`       | `/professor/courses`    |
   | 관리자 | `A1001`               | `/admin/enrollments`    |

- 80번 포트를 다른 프로그램이 쓰고 있으면(Windows에서 흔함) `.env`에 `WEB_PORT=8080`과 `APP_FRONTEND_ORIGIN=http://localhost:8080` 두 줄을 추가하고 `docker compose up -d --build --wait`를 다시 실행한 뒤 `http://localhost:8080`에 접속합니다. `APP_FRONTEND_ORIGIN`은 브라우저 주소의 출처와 정확히 같아야 하며, 다르면 로그인이 403(`code` `E02`, `reason` `CSRF_CHECK_FAILED`)으로 실패합니다.
- 인증 쿠키는 항상 `Secure`입니다. 브라우저는 `http://localhost`에서는 HTTPS 없이도 이 쿠키를 받지만, 다른 PC에서 서버 IP나 도메인으로 접속하려면 HTTPS가 필요합니다([배포 (Docker)](#배포-docker) 참고). 쿠키 동작은 Chrome에서 확인했으므로 Chrome을 권장합니다.
- 중지와 재시작은 `docker compose stop` / `docker compose start`입니다. `docker compose down`은 컨테이너를 지우지만 DB 데이터는 남깁니다. `docker compose down -v`는 DB 데이터까지 지우며, 다음 `docker compose up`에서 시드를 다시 넣습니다.

### 2. 개발 서버 + 실제 백엔드

1. Backend 저장소를 개발 모드(기본 프로파일 `local`)로 `http://localhost:8080`에 띄웁니다. 실행 방법은 [Backend README](https://github.com/DatabaseApplication-26S2/Backend)를 따릅니다. 개발 모드도 같은 시드 계정을 만들며, 백엔드가 허용하는 브라우저 출처는 `http://localhost:5173`뿐입니다.
2. 이 저장소 폴더에서 [실행](#실행)의 준비물을 갖춘 뒤 개발 서버를 시작합니다.

   ```sh
   pnpm install --frozen-lockfile
   pnpm dev
   ```

3. Chrome에서 `http://localhost:5173`에 접속해 1번 방법과 같은 시드 계정(비밀번호 `Demo-password1!`)으로 로그인합니다.

Vite 개발 서버는 `/api` 요청을 `http://localhost:8080`으로 프록시하므로 브라우저 기준으로 같은 출처입니다. `strictPort`가 켜져 있어 5173번 포트가 사용 중이면 다른 포트로 옮기지 않고 시작에 실패합니다. 다른 포트로 열리면 백엔드가 허용하는 출처와 달라져 쿠키 연산이 모두 403이 되기 때문입니다.

### 3. 모의 서버만

백엔드 없이 화면을 확인합니다. MSW가 브라우저 안에서 `/api/v1/*`를 응답합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev:mock
```

`http://localhost:5173`에 접속합니다. 모의 서버 계정은 실제 백엔드 계정과 다릅니다. 관리자는 `A0001`, 비밀번호는 모든 계정 공통 `crs-demo-1234`입니다([계정](#계정) 참고).

## 포함된 것

| 영역            | 선택                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| 빌드            | Vite 7, React 19, TypeScript(strict), pnpm                                                                |
| UI              | Tailwind v4, shadcn/ui 기반 컴포넌트, radix-ui 대화상자, stageshow 모션 부품(`Roll`, `Collapse`)          |
| 라우팅 / 데이터 | react-router v7(`createBrowserRouter`), TanStack Query v5(자동 재시도 없음)                               |
| API 클라이언트  | `openapi-typescript` + `openapi-fetch`: `openapi.yaml`에서 타입을 생성하므로 모든 요청/응답에 타입이 붙음 |
| 폼              | react-hook-form + zod                                                                                     |
| 모킹 / 테스트   | MSW v2(20개 연산 전부, `pnpm dev:mock`과 테스트가 공유), Vitest 4 + Testing Library                       |
| 린트 / 포맷     | ESLint, Prettier                                                                                          |

## 화면

| 경로                   | 역할    | 내용                                                     |
| ---------------------- | ------- | -------------------------------------------------------- |
| `/login`               | 익명    | 로그인 → 로그인 대기 순번 → (학생) 입장 대기 순번 → 이동 |
| `/courses`             | 전 역할 | 과목 검색. 학생은 행에서 신청·취소                       |
| `/courses/:courseCode` | 전 역할 | 과목 상세, 새로고침                                      |
| `/me/enrollments`      | 학생    | 내 신청 내역, 취소                                       |
| `/professor/courses`   | 교수    | 담당 과목 조회·등록·수정·폐강                            |
| `/admin/enrollments`   | 관리자  | 관리자 수강신청(정원 초과 표시)                          |
| `/admin/settings`      | 관리자  | 동시 처리 수 N과 슬롯 현황                               |
| `/admin/closures`      | 관리자  | 폐강 대상 조회와 일괄 폐강                               |

`/`는 역할 첫 화면(학생 `/courses`, 교수 `/professor/courses`, 관리자 `/admin/enrollments`)으로 보냅니다. 학생 화면은 현재 세션의 `POST /admission`이 200을 준 뒤에만 열립니다.

## 인증 모델

- Access 토큰은 JS 모듈 변수에만 둡니다. React 상태, 웹 저장소, 로그에 넣지 않습니다. Refresh는 HttpOnly 쿠키입니다.
- 앱 시작 때 `POST /auth/refresh`를 한 번 호출해 세션을 복구합니다. 갱신은 탭 안에서 Promise 하나, 탭 사이에서는 Web Locks로 한 번만 실행하며 네트워크 오류면 다시 보내지 않습니다.
- 웹 저장소에는 비밀이 아닌 값 두 개만 둡니다: `sessionStorage['crs.pendingTicket']`(진행 중 티켓 번호·유형·과목코드), `localStorage['crs.refreshUncertainAt']`(갱신 결과를 알 수 없을 때의 시각).
- 쿠키 연산 4개에는 `X-CSRF-Protection: 1`을, 모든 요청에는 `credentials: 'include'`를 붙입니다.
- 회원가입은 범위 밖이라 없습니다.

티켓 폴링은 TanStack 질의(`['ticket', ticketId]`)가 아니라 모듈 수준 폴러로 구현했습니다. 토큰 수령을 티켓당 한 번만 보내려면 진입 흐름이 컴포넌트 수명·StrictMode와 분리돼야 하기 때문입니다.

## 디자인과 글꼴

[DESIGN.md](DESIGN.md)에 LMS 기반 색상, 타이포그래피, 컴포넌트 상태, 모션, 접근성 조정 기준을 정리했습니다. 새 화면도 이 규칙을 따릅니다. Noto Sans KR 400/700은 `@fontsource/noto-sans-kr`로 자체 호스팅하며 외부 폰트 CDN을 사용하지 않습니다.

Noto Sans KR의 SIL OFL 1.1 라이선스는 과제 사용과 웹 임베딩을 허용합니다. 업스트림 저작권 고지와 패키지 라이선스 전문을 [`public/licenses/NotoSansKR-OFL.txt`](public/licenses/NotoSansKR-OFL.txt)에 포함했으며, 빌드 후 `/licenses/NotoSansKR-OFL.txt`로 제공됩니다.

## 실행

개발 서버(방법 2·3)를 위한 내용입니다. 전체 스택(방법 1)은 Node.js와 pnpm 없이 Docker만으로 실행됩니다.

### 준비물

- Node.js 26
- pnpm 11. Docker 이미지는 pnpm 11.7.0을 고정합니다. Node 25부터 corepack이 기본 포함되지 않으므로 npm으로 같은 버전을 설치합니다(Windows PowerShell·macOS·Linux 공통).

  ```sh
  npm install -g pnpm@11.7.0
  ```

- 방법 2라면 `http://localhost:8080`에서 실행 중인 Backend 개발 모드([Backend README](https://github.com/DatabaseApplication-26S2/Backend) 참고)

### 명령

의존성 버전은 `pnpm-lock.yaml`을 유지합니다(Windows PowerShell·macOS·Linux 공통).

```sh
pnpm install --frozen-lockfile
pnpm dev        # http://localhost:5173 — /api → http://localhost:8080 프록시 (백엔드 실행 필요)
pnpm dev:mock   # 동일하지만 MSW가 브라우저에서 /api/v1/* 를 응답. 백엔드 불필요
```

`pnpm dev:mock`은 `VITE_USE_MOCK=true vite`를 실행하는 스크립트로, 환경 변수를 POSIX 셸 문법으로 넘깁니다. Windows에서 이 명령이 실패하면 `.env`에 `VITE_USE_MOCK=true`를 넣고 `pnpm dev`를 실행합니다(같은 동작, [환경 변수](#환경-변수) 참고). 방법 2(실제 백엔드)로 돌아가기 전에는 이 줄을 지우거나 `VITE_USE_MOCK=false`로 바꿉니다. 그대로 두면 `pnpm dev`도 계속 모의 서버를 씁니다.

검사: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`

### 계정

실제 백엔드(방법 1·2)와 모의 서버(방법 3)는 계정이 다릅니다. 모의 서버 계정으로는 실제 백엔드에 로그인할 수 없고, 반대도 마찬가지입니다.

| 역할          | 실제 백엔드 시드 (Docker, `pnpm dev`) | 모의 서버 (`pnpm dev:mock` 전용) |
| ------------- | ------------------------------------- | -------------------------------- |
| 학생          | `20260001`–`20260060`                 | `20260001`–`20260060`            |
| 교수          | `P1001`–`P1003`                       | `P1001`–`P1003`                  |
| 관리자        | `A1001`                               | `A0001`                          |
| 공통 비밀번호 | `Demo-password1!`                     | `crs-demo-1234`                  |

- 실제 백엔드 시드: Backend의 Flyway 시드(V900)가 `local`·`demo` 프로파일에서 넣습니다. 과목은 `DEMO01`–`DEMO25`(`DEMO01` 정원 3, `DEMO02` 정원 1)이고, 학생 `20260001`은 관리자 `A1001`이 배정한 `DEMO03` 신청 1건을 가진 상태로 시작합니다. 동시 처리 수 N의 초기값은 100입니다.
- 모의 서버: 계정·과목은 `src/mocks/seed.ts`에만 있는 모의 전용 값이며 실제 서버에는 쓰지 않습니다. 과목 코드도 실제 시드와 다르고(예: `CSE3010`), 시연용 과목 `ERR0099`는 E99(처리 실패)를 재현하는 모의 전용 과목입니다.

### 모의 서버 동작

모의 서버는 티켓을 1초 간격으로 진행합니다(대기 2회 → 처리 중 → 종결). 브라우저 콘솔의 `__crsMock.scenario`로 Access 만료(`expireAccess()`)나 세션 폐기(`revokeSession()`)를 흉내 낼 수 있습니다. 모의 세션은 페이지 메모리에 있으므로 새로고침하면 다시 로그인해야 합니다.

모의 모드에서 "일시적인 오류입니다"가 나오면 MSW가 요청을 가로채지 못해 Vite 프록시가 없는 백엔드(`localhost:8080`) 대신 500을 돌려준 것입니다. 오래 숨겨 둔 탭은 앱이 다시 보일 때 자동으로 복구하지만, 개발자 도구의 서비스 워커 "Bypass for network"가 켜져 있으면 끄고 새로고침하세요.

## 환경 변수

`pnpm dev`·`pnpm dev:mock`이 읽는 이 저장소의 `.env`입니다. 전체 스택의 `.env`(`compose.yaml` 옆, `JWT_SECRET` 등)와는 다른 파일입니다. 필요할 때만 `.env.example`을 `.env`로 복사해서 사용합니다(git 제외). 파일이 없으면 아래 기본값을 씁니다.

macOS·Linux:

```sh
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

| 변수                | 기본값    | 설명                                                                                 |
| ------------------- | --------- | ------------------------------------------------------------------------------------ |
| `VITE_USE_MOCK`     | `false`   | `true`면 MSW가 `/api/v1/*`를 가로챕니다. `pnpm dev:mock`이 자동 설정                 |
| `VITE_API_BASE_URL` | `/api/v1` | API 기준 경로. 기본은 Vite 프록시 경유, `http://localhost:8080/api/v1`이면 직접 호출 |

## 배포 (Docker)

`Dockerfile`은 두 단계로 이미지를 만듭니다. 1단계(`node:26-alpine`)에서 pnpm 11.7.0으로 의존성을 설치하고 SPA를 빌드합니다. 2단계(`caddy:2-alpine`)에서 Caddy가 80번 포트(HTTP 전용)로 서빙합니다. Caddy는 `dist/`를 제공하고, 클라이언트 경로는 `index.html`로 돌려주며, `/api/*`는 `Origin` 헤더를 포함해 그대로 `API_UPSTREAM`(기본 `api:8080`)으로 넘깁니다.

이 이미지는 전체 스택의 `web` 서비스로 실행합니다. `compose.yaml`의 `web`은 `./frontend`를 빌드하고 `API_UPSTREAM: api:8080`을 주며, 네 서비스 가운데 유일하게 포트(`${WEB_PORT:-80}:80`)를 공개합니다. 실행 절차는 [실행 방법 한눈에](#실행-방법-한눈에)의 1번 방법을 따릅니다.

- 인증 쿠키는 `__Host-` 접두사가 붙고 항상 `Secure`입니다. `http://localhost`에서는 브라우저가 이 쿠키를 받으므로 HTTPS 없이 로그인됩니다. localhost가 아닌 주소(서버 IP, 도메인)로 접속하면 HTTPS가 필요하며, HTTP로 접속하면 로그인이 깨집니다.
- 백엔드의 `APP_FRONTEND_ORIGIN`은 브라우저가 접속하는 출처와 정확히 같아야 합니다(기본 `http://localhost`, 공개 서버는 `https://<도메인>`). 다르면 쿠키 연산이 403(`code` `E02`, `reason` `CSRF_CHECK_FAILED`)을 돌려줍니다.
- `VITE_*` 값은 빌드 시점에 고정됩니다. `.dockerignore`가 `.env`를 빌드에서 빼므로 이미지는 기본값(`VITE_API_BASE_URL=/api/v1`, 모의 서버 꺼짐)을 씁니다.

서버에 공개할 때는 다음을 지킵니다.

- Docker가 설치된 Linux 서버에서 같은 `compose.yaml`로 실행합니다.
- `web`의 포트 앞에 TLS를 종료하는 리버스 프록시(예: Nginx Proxy Manager, Caddy, nginx)를 두고 HTTPS를 강제합니다.
- `.env`에 `APP_FRONTEND_ORIGIN=https://<도메인>`을 설정합니다.
- 프록시에서 `Origin` 헤더를 바꾸지 않습니다. 앱이 `Authorization: Bearer` 헤더를 쓰므로 Basic Auth를 추가하지 않습니다.
- db·redis·api 포트는 공개하지 않습니다.

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
openapi.yaml           Backend 저장소 docs/openapi.yaml과 같은 파일. `pnpm gen:api`의 입력
Dockerfile, Caddyfile  배포 이미지(SPA 빌드 + Caddy)
```

## 참조 팩

`docs/refs/`에 위 라이브러리(React, Vite, Tailwind, shadcn/ui, React Router, TanStack Query, openapi-fetch, React Hook Form, Zod, Vitest, Testing Library, MSW, ESLint, Prettier 등)의 공식 문서를 Context7에서 받아 둔 스냅샷이 있습니다. [`docs/refs/INDEX.md`](docs/refs/INDEX.md)에서 시작하세요. 주제별 문서 버전, 프로젝트 버전, 고정된 Context7 ID가 정리되어 있습니다.

아직 의존성은 아니지만 해커톤 기능에 자주 쓰는 라이브러리도 포함했습니다: 브라우저 CSV·스프레드시트(Papa Parse, SheetJS), 표와 대용량 목록(TanStack Table + shadcn data table, TanStack Virtual), 대시보드와 입력 폼(shadcn charts + Recharts, date-fns, shadcn date picker + React DayPicker, Zustand), E2E 테스트(Playwright). `INDEX.md`에서 이 항목들은 "Not a dependency yet"로 표시되고 설치할 npm 버전이 함께 적혀 있습니다.

의존성은 Context7 스냅샷이 있는 정확한 버전으로 고정했습니다. 그래서 문서와 코드의 버전이 일치합니다. 해당 메이저의 스냅샷이 없는 라이브러리(Tailwind v4, Radix, React Hook Form, `@hookform/resolvers` v7, openapi-fetch/openapi-typescript)는 기본 브랜치 문서를 사용하며, `INDEX.md`에 표시해 두었습니다.

갱신·추가: `docs/refs/manifest.json`을 수정한 뒤 `node scripts/fetch-refs.mjs` 실행(`--force` 재수집, `--only <text>` 필터). Node 22.13 이상과 `npx ctx7 login`(또는 `CONTEXT7_API_KEY`)이 필요하고, 항목 하나당 Context7 API 호출 1회를 씁니다.

## 확장하기

### 계약이 바뀌었을 때 → 타입 재생성

계약의 원본은 Backend 저장소의 `docs/openapi.yaml`입니다. 두 저장소를 `backend/`, `frontend/`로 나란히 클론했다면 `frontend/` 폴더에서 다음을 실행합니다.

macOS·Linux:

```bash
cp ../backend/docs/openapi.yaml openapi.yaml   # 사본 갱신(두 파일이 바이트 단위로 같아야 함)
pnpm gen:api && pnpm typecheck                 # 핸들러·화면의 계약 불일치를 여기서 잡는다
```

Windows PowerShell:

```powershell
Copy-Item ..\backend\docs\openapi.yaml openapi.yaml
pnpm gen:api
pnpm typecheck
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

`unwrap`은 오류 응답을 `ApiError`로 던집니다. 화면 문구는 `src/api/messages.ts`의 `problemMessage()`가 오류 코드별로 만듭니다.

### 페이지 추가

1. 화면 컴포넌트를 해당 기능 폴더에 작성합니다(예: `src/courses/CoursesPage.tsx`).
2. `src/routes.tsx`의 알맞은 가드 아래에 등록하고, `src/auth/roles.ts`의 `canAccess`와 `src/layout/menu.ts`의 역할별 메뉴를 함께 갱신합니다.

### 모의 핸들러 추가

`src/mocks/handlers/` 아래 해당 파일에 핸들러를 더합니다. 응답 본문은 `satisfies Schemas[...]`로 계약 타입을 검사합니다. `pnpm dev:mock`과 테스트에 모두 적용됩니다.

### 폼 추가

`src/auth/LoginForm.tsx`를 따라 zod 스키마 → `zodResolver` → `Field` / `FieldError`. 서버 오류는 `formErrorsFrom()`이 필드별 문구(`violations`, E10·E11·E13 등)로 바꿔줍니다.

## 라이선스

앱 코드: MIT. 동봉한 Noto Sans KR 폰트: SIL OFL 1.1. [폰트 라이선스 고지](public/licenses/NotoSansKR-OFL.txt)를 참고하세요. `src/components/motion/`의 stageshow 복사본: MIT(Copyright (c) 2026 Benji Taylor), [고지](src/components/motion/LICENSE)를 같은 폴더에 둡니다.

# DESIGN.md: 디자인 계약

이 문서는 프런트엔드 화면의 시각 규칙을 정리한다. 숭실대학교 LMS 공개 홈페이지에서 측정한 색과 글꼴을 이 앱의 토큰으로 옮겼다.

- **적용 화면** (9개 라우트): `/login`, `/`(역할 첫 화면으로 이동), `/courses`, `/courses/:courseCode`, `/me/enrollments`, `/professor/courses`, `/admin/enrollments`, `/admin/settings`, `/admin/closures`
- **토큰 값의 단일 출처**: `src/index.css` (`:root`, `.dark`, `@theme inline`)
- **컴포넌트**: `src/components/ui/{button,card,input,field,label,separator,sonner,dialog,alert-dialog,table,native-select,checkbox,pagination,form-field}.tsx`
- **모션**: `src/components/motion/` (stageshow `Roll`·`Collapse` 복사본, MIT. 4.13절)
- **화면**:
  - 로그인: `src/auth/{LoginPage,LoginForm}.tsx`
  - 앱 셸: `src/layout/{AppLayout,FullPageLoading,PageStates}.tsx`, `src/layout/{menu,styles}.ts`
  - 진행·결과 표시: `src/queue/QueueStatus.tsx`, `src/enrollments/RequestStatus.tsx`
  - 과목: `src/courses/{CoursesPage,CourseDetailPage}.tsx`, `src/enrollments/MyEnrollmentsPage.tsx`
  - 교수: `src/professor/{ProfessorCoursesPage,CourseFormDialog,CloseCourseDialog}.tsx`
  - 관리자: `src/admin/{AdminEnrollmentsPage,AdminSettingsPage,AdminClosuresPage}.tsx`

이 문서는 값을 복제하지 않고 토큰 이름과 사용 규칙만 적는다. 값을 바꿀 때는 `src/index.css`만 수정한다. 아래 표의 hex 값은 출처를 밝히려는 기록이다.

## 1. 출처와 범위

| 항목 | 내용 |
| --- | --- |
| 관측 대상 | LMS 공개 홈페이지 <https://lms.ssu.ac.kr/> |
| 관측일 | 2026-11-10 |
| 방법 | 브라우저 computed style과 CDP 플랫폼 폰트 조회 (데스크톱 1512×872 CSS px, DPR 2) |
| 색 값 기준 | computed style 값. 스크린샷 픽셀은 디스플레이 색공간 변환으로 채도가 달라져 사용하지 않았다. |
| 미관측 | 모바일·태블릿 폭, SSO 이후 비공개 화면, CTA 포커스 스타일 |

- `--palette-*`, `--heading` 같은 토큰 이름은 **이 앱의 별칭**이다. LMS에 같은 이름의 CSS 변수가 있다는 뜻이 아니다. LMS의 `:root`에는 Bootstrap 4.2.1 기본 변수만 있고, 측정한 컴포넌트는 그 변수를 쓰지 않았다.
- **가져오지 않은 것**: LMS 메뉴 구조, 로고, 배너, 이미지, 비공개 콘텐츠, 브랜드 문구. 이 앱은 숭실대학교나 LMS의 공식 서비스라고 주장하지 않는다.
- **레거시 일반 로그인 페이지는 제외**했다. `https://lms.ssu.ac.kr/login?type=xn-sso-dir-general`은 `login-general.php`로 이동하며, 별도 스타일(`#00A4CA` 헤더·버튼, hover `#0880A8`, Tahoma/Dotum 계열 시스템 글꼴, 웹폰트 없음)을 쓴다. 이 앱에는 그 색과 글꼴을 섞지 않는다.

## 2. 색상

### 2.1 관측 팔레트 (`--palette-*`, `:root`)

| 토큰 | 값 | LMS 관측 위치 | 앱 용도 |
| --- | --- | --- | --- |
| `--palette-teal` | `#13BEC9` | 통합 로그인 CTA 배경 | `--primary` |
| `--palette-teal-strong` | `#0A99A3` | 같은 CTA의 실제 hover 배경 | `--primary-hover` |
| `--palette-blue` | `#2B518C` | 일반 로그인 버튼 배경 | `--secondary`, `--ring`, `--link-hover` |
| `--palette-navy` | `#002255` | 섹션 제목(`.xnbw-title`), 버튼 박스 배경 | `--heading`, `--link` |
| `--palette-navy-deep` | `#00183D` | 버튼 박스 테두리 | `--primary-foreground` |
| `--palette-white` | `#FFFFFF` | 본문·헤더 배경 | `--card`, `--popover`, `--secondary-foreground` |
| `--palette-gray-50` | `#F5F5F5` | 더보기(+) 버튼 배경 | `--background`, `--muted` |
| `--palette-gray-100` | `#EEEEEE` | 메뉴·목록 hover 배경 | `--accent` |
| `--palette-gray-200` | `#DDDDDD` | 메뉴 구분선, 매뉴얼 링크 테두리 | `--border` |
| `--palette-gray-500` | `#888888` | 푸터 텍스트 | `--input` |
| `--palette-gray-600` | `#666666` | 헤더 텍스트 | `--muted-foreground` |
| `--palette-gray-900` | `#222222` | 게시글 제목 텍스트 | `--foreground`, 카드·팝오버 전경 |

관측했지만 채택하지 않은 값:

- `#333333`(메뉴 텍스트): 앱 셸의 주 메뉴는 회색 단계를 늘리지 않도록 기존 `--foreground`(`#222222`)를 쓴다.
- `#999999`(날짜 텍스트): 흰 배경 대비가 2.85:1이라 본문 텍스트에 쓸 수 없다. 보조 텍스트는 `#666666`을 쓴다.
- `rgba(25,61,119,.9)` 로그인 패널, `#3C3C3C`·`#333333` 푸터 배경: 해당하는 화면 영역이 없다.
- 흰 글자를 올린 teal CTA: LMS 원본 조합이지만 대비가 2.27:1이라 따르지 않는다(2.4절).

### 2.2 시맨틱 별칭 (light, `:root`)

shadcn/ui 변수 이름을 그대로 쓰고, 필요한 별칭 7개(`--primary-hover`, `--heading`, `--link`, `--link-hover`, `--secondary-hover`, `--overlay`, `--control-accent`)를 추가했다. `--control-accent`를 뺀 별칭은 `@theme inline`에서 `--color-*`로 연결되므로 Tailwind 유틸리티로 쓸 수 있다.

| 별칭 | 참조 | 용도 | 유틸리티 |
| --- | --- | --- | --- |
| `--background` | gray-50 | 페이지 바탕 | `bg-background` |
| `--foreground` | gray-900 | 기본 텍스트 | `text-foreground` |
| `--card`, `--popover` | white | 카드, 토스트 | `bg-card`, `bg-popover` |
| `--card-foreground`, `--popover-foreground` | gray-900 | 카드·토스트 텍스트 | `text-card-foreground` |
| `--primary` | teal | 주 CTA 배경 | `bg-primary` |
| `--primary-foreground` | navy-deep | 주 CTA 텍스트 | `text-primary-foreground` |
| `--primary-hover` | teal-strong | 주 CTA hover 배경 | `hover:bg-primary-hover` |
| `--secondary` / `--secondary-foreground` | blue / white | 확인 버튼(대화상자의 `폐강`) | `bg-secondary` |
| `--secondary-hover` | navy | 확인 버튼 hover 배경 | `hover:bg-secondary-hover` |
| `--muted` | gray-50 | 약한 면 | `bg-muted` |
| `--muted-foreground` | gray-600 | 설명, 로딩 문구 | `text-muted-foreground` |
| `--accent` / `--accent-foreground` | gray-100 / gray-900 | outline·ghost 버튼 hover 면, 주 메뉴의 현재 항목과 hover | `hover:bg-accent` |
| `--border` | gray-200 | 카드 경계, 구분선 | `ring-border`, `border-border` |
| `--input` | gray-500 | 입력창·outline 버튼 테두리 | `border-input` |
| `--ring` | blue | 키보드 포커스 표시 | `ring-ring`, `outline-ring` |
| `--heading` | navy | 카드 제목 | `text-heading` |
| `--link` / `--link-hover` | navy / blue | 인라인 링크와 그 hover | `text-link`, `hover:text-link-hover` |
| `--destructive` | 기존 값 `oklch(0.577 0.245 27.325)` ≈ `#E7000B` | 오류 텍스트, 오류 결과 상자 테두리 | `text-destructive`, `border-destructive` |
| `--overlay` | `color-mix(in srgb, var(--palette-navy-deep) 50%, transparent)` | 대화상자 뒤 스크림 | `bg-overlay` |
| `--control-accent` | blue | 네이티브 체크박스 채움(`accent-color`) | `src/index.css` base 규칙 |

- LMS에서 오류 색은 관측되지 않았다. 그래서 `--destructive`는 기존 shadcn 값을 유지한다.
- `--chart-*`, `--sidebar-*`는 현재 화면에서 쓰지 않아 기존 값을 유지한다. `--radius`는 현재 카드·컨트롤의 모서리에 사용하며 기존 값을 유지한다.
- `--muted`는 페이지 바탕과 같은 값(gray-50)이다. 흰 카드 안에서 표 머리글, 진행 표시, 안내 상자, 처리 중인 행의 면으로 쓴다.
- `--overlay`는 글자가 올라가지 않는 면이다. 대화상자의 글자는 모두 `--card` 위에 있다.
- 관측 hex 값은 OKLCH로 바꾸지 않고 hex 그대로 두었다. 측정값과 바로 대조할 수 있도록 하기 위해서다. `.dark`는 기존 OKLCH 값 그대로다.

### 2.3 다크 모드 (`.dark`)

LMS 다크 모드는 관측 근거가 없다. 그래서 `.dark`는 기존 neutral 스킴을 그대로 두고 LMS 색을 적용하지 않았다. 새 별칭은 이전 동작을 보존하는 값으로만 정의했다.

| 별칭 | 다크 값 | 이유 |
| --- | --- | --- |
| `--primary-hover` | `color-mix(in oklab, var(--primary) 80%, transparent)` | 이전 `hover:bg-primary/80`과 같은 결과 |
| `--heading` | `var(--card-foreground)` | 이전 카드 제목 색 |
| `--link` / `--link-hover` | `var(--foreground)` / `var(--muted-foreground)` | neutral 스킴 안에서 구분되는 링크 색 |
| `--secondary-hover` | `color-mix(in oklch, var(--secondary), var(--foreground) 5%)` | 이전 `secondary` 변형의 임의 hover 값과 같은 결과 |
| `--overlay` | `oklch(0 0 0 / 50%)` | shadcn 기본 `bg-black/50`과 같은 결과 |
| `--control-accent` | `auto` | 브라우저 기본 체크박스 색 |

현재 코드에는 `.dark` 클래스를 붙이는 테마 제공자가 없다. 기능만 보존한 상태다.

### 2.4 대비 규칙

WCAG 2.x 상대휘도 공식으로 계산했다. 일반 텍스트는 4.5:1 이상, 컨트롤 경계와 포커스 표시는 3:1 이상이어야 한다.

| 조합 (전경 / 배경) | 대비 | 쓰임 | 판정 |
| --- | --- | --- | --- |
| `#00183D` / `#13BEC9` | 7.71:1 | 주 CTA 기본 | 통과 |
| `#00183D` / `#0A99A3` | 5.09:1 | 주 CTA hover | 통과 |
| `#222222` / `#FFFFFF` | 15.91:1 | 카드 본문, 레이블, 입력값 | 통과 |
| `#222222` / `#EEEEEE` | 13.71:1 | outline 버튼 hover | 통과 |
| `#666666` / `#FFFFFF` | 5.74:1 | 카드 설명, 로딩 문구 | 통과 |
| `#002255` / `#FFFFFF` | 15.44:1 | 카드 제목, 링크 | 통과 |
| `#2B518C` / `#FFFFFF` | 7.90:1 | 링크 hover | 통과 |
| `#E7000B` / `#FFFFFF` | 4.77:1 | 카드 안 오류 문구 | 통과 |
| `#888888` / `#FFFFFF` | 3.54:1 | 입력창·outline 버튼 테두리 | 통과 (3:1) |
| `#2B518C` / `#FFFFFF`, `#2B518C` / `#13BEC9` | 7.90:1, 3.47:1 | 포커스 링 | 통과 (3:1) |
| `#222222` / `#F5F5F5` | 14.59:1 | 표 머리글(`bg-muted`), 진행 표시·안내 상자, 처리 중인 행, 바탕 위 본문 | 통과 |
| `#002255` / `#F5F5F5` | 14.16:1 | 바탕 위 `목록으로` 링크, 처리 중인 행의 과목코드 링크 | 통과 |
| `#666666` / `#F5F5F5` | 5.27:1 | 바탕 위 로딩 문구, `bg-muted` 위 보조 문구·아이콘 | 통과 |
| `#2B518C` / `#F5F5F5` | 7.25:1 | 바탕·`bg-muted` 위 링크 hover와 포커스 링 | 통과 (3:1, 4.5:1) |
| `#FFFFFF` / `#2B518C` | 7.90:1 | 확인 버튼(`secondary`) 글자, 체크된 체크박스의 체크 | 통과 |
| `#FFFFFF` / `#002255` | 15.44:1 | 확인 버튼 hover | 통과 |
| `#2B518C` / `#FFFFFF` (2px `ring-offset-card` 뒤) | 7.90:1 | 확인 버튼 포커스 링. 링이 버튼과 같은 색이라 흰 간격을 둔다 | 통과 (3:1) |
| `#666666` / `#FFFFFF` | 5.74:1 | 셀렉트 화살표 아이콘, 주 메뉴 옆 역할 라벨 | 통과 (3:1, 4.5:1) |
| `#FFFFFF` / 스크림 합성색 `#7B8799`(바탕 위) · `#808C9E`(흰 면 위) | 3.64:1, 3.41:1 | 대화상자 면과 스크림의 경계 | 통과 (3:1, 비텍스트) |
| `#E7000B` / `#F5F5F5` | 4.38:1 | 바탕·`bg-muted` 위 오류 문구 | **금지** |
| `#E7000B` / `#EEEEEE` | 4.11:1 | `bg-accent` 위 오류 문구 | **금지** |
| `#E7000B` / `#FDE6E7`(흰 바탕 위 `destructive/10`) | 4.01:1 | `destructive` 버튼 변형 | **금지** (변형 미사용) |
| `#FFFFFF` / `#13BEC9` | 2.27:1 | LMS 원본 CTA 글자 | **금지** |
| `#FFFFFF` / `#0A99A3` | 3.44:1 | LMS 원본 CTA hover 글자 | **금지** |
| `#002255` / `#0A99A3` | 4.48:1 | navy 글자 + hover 배경 | **금지** (4.5 미만) |
| `#999999` / `#FFFFFF` | 2.85:1 | LMS 날짜 색 | **금지** |
| `#13BEC9` / `#FFFFFF` | 2.27:1 | teal 텍스트·아이콘 | **금지** |

- teal(`--primary`)은 면 색으로만 쓴다. 텍스트나 의미 있는 아이콘 색으로 쓰지 않는다.
- teal 면 위의 글자는 항상 `--primary-foreground`(`#00183D`)를 쓴다.
- 카드 경계(`#DDDDDD`, 흰 배경 대비 1.36:1)와 카드·페이지 면 차이(1.09:1)는 비대화형 장식 경계다. 대비 요건 대상이 아니다.
- 비활성 컨트롤은 WCAG 1.4.3 예외에 해당한다.
- 오류 문구(`text-destructive`)는 흰 면(`bg-card`) 위에만 둔다. 표 머리글, 진행 표시, 안내 상자, 처리 중인 행 같은 `bg-muted` 면에는 오류를 두지 않는다.
- 표 행에는 hover 면을 두지 않는다. 처리 중인 행만 `bg-muted`가 된다.
- 체크박스 테두리(체크 전)는 브라우저가 그린다. Chrome 기본 `#767676`은 흰 바탕 대비 4.54:1이다 **[추론: 브라우저별 값 미측정]**.
- 스크림 합성색은 `--overlay`(navy-deep 50%)를 `#F5F5F5`·`#FFFFFF` 위에 sRGB로 섞어 계산했다.

## 3. 타이포그래피

### 3.1 글꼴

- **글꼴**: Noto Sans KR. **400(Regular)과 700(Bold) 두 굵기만** 로드한다.
- **LMS 근거**: 홈페이지가 Noto Sans KR 400/700 woff2를 로드했고, CDP 조회 결과 제목과 CTA는 `NotoSansKR-Bold`, 본문·날짜·라틴 텍스트는 `NotoSansKR-Regular`로 렌더됐다. `font-weight: 500`으로 선언된 내비게이션도 500 face가 없어 실제로는 Regular로 렌더됐다.
- **패키지**: `@fontsource/noto-sans-kr` `5.3.1` (npm `license: OFL-1.1`). LMS 서버의 폰트 파일을 복사하지 않았고 CDN 링크도 쓰지 않는다. 폰트는 앱 빌드에 포함된다.
- **import** (`src/index.css`):

  ```css
  @import '@fontsource/noto-sans-kr/400.css';
  @import '@fontsource/noto-sans-kr/700.css';
  ```

  각 파일에는 `@font-face` 124개가 unicode-range 서브셋(한국어, 라틴 등)으로 들어 있고 `font-display: swap`이다. 브라우저는 화면에 쓰인 글자가 속한 서브셋만 내려받는다.
- **글꼴 스택**: `--font-sans: 'Noto Sans KR', sans-serif`, `--font-heading: var(--font-sans)`. `html`에 `font-sans antialiased`를 적용한다. 버튼과 입력창은 Tailwind preflight의 `font: inherit`로 같은 글꼴을 쓴다.
- **이전 글꼴 제거**: `@fontsource-variable/geist` import와 `'Geist Variable'` 스택을 삭제했다.
- **토스트**: Sonner는 런타임에 `[data-sonner-toaster]`로 자체 시스템 글꼴 스택을 주입한다. `src/index.css`의 `[data-sonner-toaster][data-sonner-theme] { font-family: inherit; }` 규칙이 이것을 덮어쓴다. layer 밖에 두었고 명시도가 더 높다.

### 3.2 굵기 규칙

`font-normal`(400)과 `font-bold`(700)만 쓴다.

CSS 글꼴 매칭에서 `font-medium`(500)은 400 face로, `font-semibold`(600)은 700 face로 렌더된다. 결과가 선언과 달라 보이지 않도록 이 둘은 새로 쓰지 않는다. 남아 있는 예외는 다음과 같다.

- shadcn `label.tsx`의 기본 `font-medium`: `FieldLabel`의 `font-bold`가 `cn` 병합으로 덮어쓴다.
- Sonner 토스트 제목(라이브러리 기본 500, 13px): Regular로 렌더된다.
- `field.tsx`의 `FieldLegend`·`FieldTitle`과 `input.tsx`의 `file:font-medium`: shadcn 기본값이 남아 있지만 화면에서 쓰지 않는다.

새로 손으로 쓴 `dialog`, `alert-dialog`, `table`, `native-select`, `checkbox`, `pagination`, `form-field`와 모든 화면은 400·700만 쓴다.

### 3.3 크기

| 역할 | 크기 / 행간 | 굵기 | 색 | LMS 근거 | 구현 |
| --- | --- | --- | --- | --- | --- |
| 카드 제목 | 26px / 32px | 700 | `--heading` | `.xnbw-title` 26px/32px/700, `#002255` | `CardTitle`: `text-(length:--font-size-title) leading-(--line-height-title) font-bold text-heading text-balance` |
| 큰 버튼(주 CTA, 로그인 화면의 로그아웃) | 17.6px | 700 | 변형별 | 통합 로그인 CTA 17.6px/700 | `Button size="lg"`: `h-11 px-4 text-(length:--font-size-cta)` |
| 본문, 입력값 | 16px / 24px | 400 | `--foreground` | 게시글 제목 16px/400 | `Card` `text-base`, `Input` `text-base` (모든 폭) |
| 필드 레이블 | 14px | 700 | 상속, 오류 시 `--destructive` | 미관측. 앱에서 결정 | `FieldLabel` `font-bold` |
| 설명, 오류 | 14px | 400 | `--muted-foreground` / `--destructive` | 날짜 14px/400 (색은 `#999`→`#666`) | `CardDescription`, `FieldError` |
| 기본 크기 버튼 | 14px | 700 | 변형별 | — | `Button` 기본 `text-sm` |
| 페이지 제목 (`h1`) | 26px / 32px | 700 | `--heading` | 카드 제목과 같음 | `<CardTitle asChild><h1>…</h1></CardTitle>` |
| 구획·대화상자 제목 (`h2`, 대화상자 제목) | 20px / 28px | 700 | `--heading` | 미관측. 페이지 제목보다 한 단계 아래 | `text-xl leading-7 font-bold text-heading` (`DialogTitle`, `AlertDialogTitle`, 관리자 화면의 `h2`) |
| 서비스 이름(앱 셸 워드마크) | 17.6px | 700 | `--heading` | 텍스트만. 로고 없음 | `text-(length:--font-size-cta) font-bold text-heading` |
| 주 메뉴 항목 | 14px | 400, 현재 항목 700 | `--foreground` | 미관측 | `NavLink` `text-sm`, 현재 항목 `font-bold` |
| 표 머리글 | 14px | 700 | `--foreground` on `--muted` | 미관측 | `TableHead` `text-sm font-bold` |
| 표 셀 | 14px | 400 | `--foreground`, 폐강 상태는 `--muted-foreground` | 미관측. 열이 많아 본문보다 한 단계 작게 | `Table` `text-sm`. 숫자 열은 `text-right tabular-nums` |
| 강조 수치(여석, 설정 현황) | 26px / 32px | 700 | `--foreground` | 카드 제목 크기 재사용 | `text-(length:--font-size-title) leading-(--line-height-title) font-bold tabular-nums` |
| 진행 표시 문구 | 14px, `sm` 이상 16px | 400, 과목코드 700 | `--foreground` on `--muted` | 미관측 | `QueueStatus` |

- 크기 토큰 `--font-size-title`, `--line-height-title`, `--font-size-cta`는 `:root`에 있다.
- 사용자 정의 `text-title` 유틸리티를 쓰지 않는 이유가 있다. `cn`은 tailwind-merge와 같은 규칙으로 클래스를 병합하는데, `text-title`을 텍스트 색 클래스로 판단한다. 그래서 `text-heading`과 함께 쓰면 하나가 지워진다. `text-(length:…)` 형식은 글자 크기로 판단되어 충돌하지 않는다.
- 14px·16px·20px는 기존처럼 Tailwind 기본 크기 척도(`text-sm`, `text-base`, `text-xl`)를 쓴다. LMS에서 관측한 26px·17.6px만 토큰이다.

### 3.4 한국어 줄바꿈

- `body`에 `word-break: keep-all`과 `overflow-wrap: break-word`를 적용했다. 한국어는 어절 경계에서만 줄을 바꾸고, 긴 이메일이나 URL은 넘치지 않고 줄을 바꾼다.
- 카드 제목에는 `text-balance`를, 여러 줄이 될 수 있는 안내·오류 문구에는 `text-pretty`를 쓴다.
- 표의 과목코드·숫자·라벨 열은 `whitespace-nowrap`이고, 과목명 열만 `min-w-40`으로 어절 단위 줄바꿈을 허용한다.

## 4. 컴포넌트 규칙

### 4.1 Button (`src/components/ui/button.tsx`)

- **공통**:
  - `font-bold`를 쓴다.
  - 전환은 `transition-[color,background-color,border-color,box-shadow,translate]`로 속성을 지정한다. `transition-all`은 쓰지 않는다.
  - 누름 피드백은 기존 `translate-y-px`를 유지한다.
- **`default`(주 CTA)**: `bg-primary text-primary-foreground hover:bg-primary-hover`.
- **`outline`**: `border-input bg-card`, hover 시 `bg-accent text-accent-foreground`. 다크 모드의 `bg-input/30`, `hover:bg-input/50`는 기존 그대로다.
- **`ghost`**: hover 시 `bg-accent`.
- **`link`**: `text-link`, hover 시 `text-link-hover`와 밑줄.
- **`secondary`(확인 버튼)**: `bg-secondary text-secondary-foreground hover:bg-secondary-hover`. 포커스 링이 버튼 면과 같은 blue라서 `focus-visible:ring-offset-2 focus-visible:ring-offset-card`로 2px 흰 간격을 둔다. 이전의 임의 hover 값(`hover:bg-[color-mix(…)]`)은 `--secondary-hover` 토큰으로 옮겼다. 대화상자의 `폐강` 확인 버튼만 쓴다.
- **`destructive`**: 클래스는 바꾸지 않았고 쓰지 않는다. 흰 바탕 위 `destructive/10` 면의 글자 대비가 4.01:1이라 4.5 미달이다(2.4절).
- **행 버튼**: 학생의 `신청`은 `default`, `취소`·`신청 불가`·`수정`·`폐강`(목록)은 `outline`. 같은 열의 버튼은 `min-w-*`로 폭을 맞춘다.
- **`size="lg"`**: 높이 44px(`h-11`), 17.6px. 로그인 제출 버튼(`w-full`), 입장 멈춤 상태의 `입장 다시 시도`·`로그아웃`, 관리자 화면의 `배정`·`변경`이 쓴다. 앱 셸·표·대화상자의 버튼은 기본 크기에 `h-10`을 더해 40px로 맞춘다.
- **비활성**: 네이티브 `disabled`, `opacity-50`, `pointer-events-none`(기존 shadcn 규칙). 요청 중인 제출 버튼은 라벨을 바꾸지 않는다.

### 4.2 Input (`src/components/ui/input.tsx`)

- 높이 44px(`h-11`), `px-3`, 글자 16px. 기존 `md:text-sm`은 제거해 모든 폭에서 16px로 통일했다.
- 테두리는 `border-input`(`#888888`)이다.
- 포커스 시 `border-ring`과 3px 불투명 `ring-ring`이 나타난다.
- 비활성은 `bg-muted opacity-50`이다.
- `aria-invalid` 스타일은 기존 그대로다. `TextField`(4.4절)가 오류가 있을 때 `aria-invalid`와 오류 문구를 가리키는 `aria-describedby`를 넣는다. 오류 테두리 `#E7000B`는 흰 바탕 대비 4.77:1로 컨트롤 경계 기준(3:1)을 넘는다.

### 4.3 Card (`src/components/ui/card.tsx`)

- `bg-card`, `ring-1 ring-border`, 기본 글자 `text-base`.
- 제목은 3.3절의 규칙을 따른다. 설명은 기존 `text-sm text-muted-foreground`이다.
- 패딩(`--card-spacing` 16px), `rounded-xl`, 간격은 바꾸지 않았다.
- `CardTitle`에 `asChild`를 추가했다(`Slot.Root`). 화면 제목은 `<CardTitle asChild><h1>…</h1></CardTitle>`로 실제 제목 요소에 카드 제목 스타일을 입힌다.

### 4.4 Field (`src/components/ui/field.tsx`)

- `FieldLabel`은 `font-bold`다.
- `FieldDescription` 안 링크의 hover 색은 `text-link-hover`다. teal 텍스트를 쓰지 않으려는 조치다.
- `src/components/ui/form-field.tsx`의 `TextField`·`SelectField`가 `Field` + `FieldLabel` + 컨트롤 + `FieldError`를 한 번에 그린다. 모든 폼(로그인, 과목 등록·수정, 관리자 배정, 동시 처리 수)이 이것을 쓴다.
- 폼 전체 오류(필드에 붙지 않는 서버 오류)는 제출 버튼 위의 `FieldError`(`role="alert"`)로 보인다.

### 4.5 인라인 링크 (`src/layout/styles.ts`의 `inlineLinkClass`)

```text
rounded-sm font-bold text-link underline underline-offset-4 transition-colors
hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
```

밑줄과 굵기가 함께 있으므로 링크를 색으로만 구분하지 않는다. 표의 과목코드, 과목 상세의 `목록으로`, 앱 셸의 `본문으로 건너뛰기`가 이 규칙을 쓴다. 링크에는 hover 면을 두지 않는다.

### 4.6 포커스

- 버튼과 입력창은 `:focus-visible`에서 `border-ring`과 3px `ring-ring`(`#2B518C`, 불투명)을 쓴다.
- 링크는 2px `outline-ring`에 2px offset을 쓴다.
- 기존 클래스 `ring-ring/50`을 새 ring 색에 그대로 쓰면 흰 배경 대비가 약 2.4:1로 3:1에 못 미친다. 그래서 버튼과 입력창은 불투명 `ring-ring`으로 바꿨다.
- 전역 `* { outline-ring/50 }` 기본값은 유지한다.
- 주 메뉴 항목, 워드마크, 체크박스는 링크와 같은 2px `outline-ring` + 2px offset을 쓴다.
- 확인 버튼(`secondary`)은 4.1절의 흰 간격을 둔 링을 쓴다.
- 대화상자는 열릴 때 첫 입력(폼) 또는 `취소`(확인 대화상자)에 포커스를 둔다. 닫히면 `useReturnFocus`(4.8절)가 연 버튼으로 포커스를 돌려준다. 연 버튼이 비활성되거나 사라지면 미리 정한 대상으로 보낸다.

### 4.7 토스트 (`src/components/ui/sonner.tsx`, 변경 없음)

- `--popover`, `--popover-foreground`, `--border`, `--radius` 토큰을 그대로 쓰고, 글꼴은 3.1절 규칙으로 상속받는다.
- 크기와 굵기는 Sonner 기본값이다.
- 성공 토스트 문구는 4개다: `과목을 등록했습니다`, `과목 정보를 수정했습니다`, `과목을 폐강했습니다`, `동시 처리 수를 변경했습니다`. 오류는 토스트가 아니라 화면 안의 `role="alert"`로 보인다.

### 4.8 Dialog·AlertDialog (`src/components/ui/{dialog,alert-dialog}.tsx`)

- `radix-ui`의 `Dialog`·`AlertDialog`로 손으로 썼다. shadcn CLI 산출물을 쓰지 않은 이유는 `font-medium`과 `bg-black/50` 때문이다.
- 스크림은 `bg-overlay`(2.2절). 면은 `bg-card`, `ring-1 ring-border`, `rounded-xl`, `shadow-lg`, `p-6`, 최대 폭 `max-w-lg`(과목 폼은 `sm:max-w-2xl`). 좁은 화면에서는 좌우 16px 여백(`inset-x-4`)을 두고, 높이가 넘치면 안에서 스크롤한다(`overscroll-contain`).
- 등장·퇴장은 `tw-animate-css`의 `fade`·`zoom-95`이고 `motion-reduce:animate-none`으로 축소 모션에서 끈다.
- 제목은 3.3절의 20px 역할, 설명은 `text-sm text-muted-foreground`. 버튼 줄(`DialogFooter`)은 좁은 화면에서 세로로 쌓이고 주 버튼이 위에 온다.
- 확인 대화상자의 확정 버튼은 `AlertDialog.Action`이 아니라 일반 `Button`이다. 서버가 거절(E14 등)하면 대화상자 안에 오류를 보이고 닫지 않기 위해서다.
- 닫기 버튼은 하나만 둔다(`닫기` 또는 `취소`). 같은 이름의 X 아이콘 버튼을 따로 두지 않는다.
- **포커스 복귀**: 이 앱의 대화상자는 Radix `Trigger`가 아닌 일반 버튼으로 연다. Radix는 자기 `Trigger`에만 포커스를 돌려주므로 그대로 두면 포커스가 `<body>`로 떨어진다. 그래서 `dialog.tsx`의 `useReturnFocus()`를 쓴다. 열 때 `from(연 버튼, 대체 대상)`, 콘텐츠에 `onCloseAutoFocus`를 넘긴다. 닫힐 때 연 버튼이 연결돼 있고 비활성이 아니면 그 버튼으로, 아니면(또는 성공 처리에서 `redirect()`를 불렀으면) 대체 대상으로 보낸다.

  | 대화상자 | 취소·닫기 | 성공 뒤 |
  | --- | --- | --- |
  | `과목 등록` | `과목 등록` 버튼 | `과목 등록` 버튼 |
  | `과목 수정` | 그 행의 `수정` | 그 행의 `수정` |
  | `과목 폐강` | 그 행의 `폐강` | 그 행의 과목코드 링크(버튼이 비활성되므로) |
  | `선택 과목 폐강` | `선택 과목 폐강` 버튼 | `폐강 처리 결과` 제목(선택이 비워져 버튼이 비활성되므로) |

  행이 사라진 경우의 마지막 대체 대상은 화면 제목(`h1`)이다. 포커스를 받는 제목은 `tabIndex={-1}`과 `focus:outline-none`이다(조작 요소가 아니므로 포커스 표시 대상이 아니다).

### 4.9 Table (`src/components/ui/table.tsx`)

- 시맨틱 `<table>`. 컨테이너는 `overflow-x-auto rounded-lg border border-border`라서 좁은 화면에서는 표가 가로로 스크롤된다.
- 머리글 `bg-muted`, `font-bold`, `scope="col"`. 본문 `bg-card`. 행 구분선 `border-border`.
- 행 hover 면은 없다. `data-pending="true"`인 행(신청·취소 처리 중)만 `bg-muted`가 된다.
- `TableCaption`은 `sr-only`로 표 이름과 건수를 읽어 준다.

### 4.10 NativeSelect·Checkbox (`src/components/ui/{native-select,checkbox}.tsx`)

- `NativeSelect`: 네이티브 `<select>`에 `Input`과 같은 높이·테두리·포커스를 입혔다. 배경 `bg-card`와 글자 `text-foreground`를 명시하고, 화살표는 `ChevronDown`(`text-muted-foreground`, `aria-hidden`)이다.
- `Checkbox`: 네이티브 체크박스 20px. 채움은 `accent-color: var(--control-accent)`(`src/index.css` base 규칙). 표에서는 44×44px `<label>`로 감싸 누르는 영역을 넓히고, 이름은 `aria-label`(`{과목코드} 선택`)로 준다. 머리글 체크박스는 페이지 전체 선택이며 일부만 선택되면 `indeterminate`다.

### 4.11 Pagination (`src/components/ui/pagination.tsx`)

- `<nav aria-label="페이지 이동">` 안에 `이전`·`다음`(outline, 40px)과 `{page} / {totalPages}`(`data-testid="page-indicator"`, `tabular-nums`). 끝 페이지에서는 해당 버튼이 비활성이다.
- 페이지 상태는 호출하는 화면이 URL 쿼리(`page`)로 가진다.

### 4.12 진행·결과 표시 (`src/queue/QueueStatus.tsx`, `src/enrollments/RequestStatus.tsx`)

- 진행 영역(`entry-status`, `request-active`)과 결과 영역(`request-outcome`, `entry-notice`, `admin-enroll-result`, `closure-results`)은 항상 렌더한다. 값이 없으면 글자가 비어 있다. 그래서 화면 읽기 프로그램이 바뀐 내용을 읽는다.
- 진행 표시: `bg-muted` 상자 안에 회전 아이콘(`motion-safe:animate-spin`), 과목코드(굵게), 상태 문구. 상태 문구는 `Roll`로 바뀐 부분만 굴린다. `role="status"` 안에 `sr-only` 평문 1개와 `aria-hidden` 시각 줄 1개를 둔다(4.13절).
- 결과 표시: 흰 상자(`bg-card`)에 테두리. 성공·안내는 `border-border`와 `text-foreground`, 오류는 `border-destructive`와 `text-destructive`(흰 바탕 4.77:1). 아이콘(성공·오류·안내)과 문구가 함께 있어 색만으로 구분하지 않는다. 오류는 `role="alert"`, 그 밖은 `role="status"`이며 역할이 바뀌면 영역을 새로 끼워 넣어 알림이 확실히 읽히게 한다. `결과 닫기` 버튼(ghost)으로 지울 수 있다.
- 버튼 라벨은 요청 중에도 바뀌지 않는다. 잠금은 `disabled`로만 보인다.
- 화면 데이터의 로딩·오류·빈 상태는 `src/layout/PageStates.tsx`(`LoadingState`, `ErrorState`, `EmptyState`)로 통일했다. 오류는 흰 카드 위 `role="alert"`와 `다시 시도` 버튼이다.

### 4.13 모션 (`src/components/motion/`)

- **출처**: stageshow 키트(`Roll`, `Collapse`, `reduced-motion`)의 복사본이다. MIT 고지 전문은 `src/components/motion/LICENSE`, 원본 경로·해시·수정 목록은 같은 폴더의 `README.md`에 있다. 다른 키트 부품(Count, Swap, States 등)은 가져오지 않았다.
- **CSS 레이어**: 키트 CSS는 `@layer stageshow` 안에 있다. `src/index.css` 첫 줄 `@layer theme, base, stageshow, components, utilities;`로 순서를 고정하고, 키트 CSS는 `src/index.css`에서만 가져온다. 키트 규칙은 Tailwind preflight를 이기고 유틸리티에 진다.
- **색**: `Roll.css`의 `mask-image: linear-gradient(transparent, #000 …)`에 있는 `#000`은 마스크의 알파 값이다. 화면에 칠해지는 색이 아니므로 색 토큰 규칙(7절)의 대상이 아니다. 복사본의 다른 CSS에는 색이 없다.
- **쓰는 곳**: `Roll`은 순번·단계 문구(`entry-status`, `request-active`)에서 바뀐 부분만 굴린다. 줄의 마지막 인라인 요소로 둔다. `Collapse`는 진행 줄, 안내, 오류, 결과 상자, 배정 결과, 일괄 폐강 결과가 열리고 닫힐 때 아래 내용이 함께 움직이게 한다. 간격은 `Collapse` 안쪽 내용이 가지므로(`pt-*`·`pb-*`) 닫히면 빈 띠가 남지 않는다.
- **닫힘**: `Collapse`는 닫혀도 자식을 렌더하므로 닫을 때는 자식을 `null`로 넘긴다.
- **축소 모션**: `useReducedMotion()`이 OS 설정을 읽는다. `Roll`은 애니메이션 없이 최종 문구만 그린다. `Collapse`는 즉시 열리고 닫히며(수정본), CSS도 `prefers-reduced-motion: reduce`에서 `transition: none`이다. 회전 아이콘은 `motion-safe:`, 대화상자 애니메이션은 `motion-reduce:animate-none`으로 멈춘다.
- **접근성**: `Roll`은 굴리는 동안 옛 글자와 새 글자를 함께 DOM에 둔다. 그래서 `Roll`은 항상 `aria-hidden`이고, 같은 문구의 `sr-only` 평문을 `role="status"` 안에 둔다.
- 버튼 라벨, 메뉴, 표 셀에는 모션을 쓰지 않는다. 대화상자 등장·퇴장은 `tw-animate-css`를 쓴다.

## 5. 레이아웃과 동작

### 5.1 로그인 (`/login`)

- `main.flex.min-h-svh.items-center.justify-center.p-4` 안에 `Card.w-full.max-w-sm`을 두는 중앙 카드 구조를 유지한다. 회원가입 링크는 없다.
- 카드 순서: 제목 `로그인`(`h1`) → 안내(`entry-notice`) → `사용자ID`·`비밀번호` → 서버 오류 → `로그인`(`size="lg"`, `w-full`) → 진행 표시(`entry-status`).
- 한 번 제출하면 같은 카드 안에서 폼이 비활성되고 순번·처리 상태만 바뀐다. 이동은 가드가 한다.
- 입장이 멈춘 학생은 폼 자리에 이름·역할, 오류, `입장 다시 시도`, `로그아웃`을 본다.
- **크기**: 입력창과 큰 버튼은 44px다. 모서리 반경은 기존 `--radius: 0.625rem`을 유지한다(LMS CTA의 0px은 요소 하나에서만 관측되어 채택하지 않았다).

### 5.2 앱 셸 (`src/layout/AppLayout.tsx`)

- 머리글: `bg-card`, 아래 `border-border`. 안쪽 폭 `max-w-6xl`, 좌우 16px.
  - 서비스 이름 텍스트 `수강신청`(로고 아님, `/`로 가는 링크)
  - `<nav aria-label="주 메뉴">`: 역할별 링크(`src/layout/menu.ts`). 현재 항목은 `aria-current="page"`와 `bg-accent font-bold`. 항목 높이 40px
  - `data-testid="current-user"`: 이름(굵게)과 역할 라벨(`--muted-foreground`)
  - `로그아웃`(outline)
- `lg` 미만에서는 메뉴가 둘째 줄로 내려가고 항목이 줄바꿈된다.
- 맨 앞에 `본문으로 건너뛰기` 링크(포커스될 때만 보임)가 있다.
- 본문: `<main id="main">` 안쪽 폭 `max-w-6xl`, 좌우 16px, 위아래 24px. 화면 내용은 `Card` 안에 두고 카드 사이 간격은 24px다.
- 로고, 배너, 라이선스 링크는 추가하지 않았다.

### 5.3 화면

| 화면 | 구성 |
| --- | --- |
| `/courses` | `과목 검색`(`h1`)과 여석 안내 → 검색 폼(`이수구분` select, `검색어`, `검색`) → 학생의 진행·결과 → 표 → 페이지. 검색 조건은 URL 쿼리(`category`, `q`, `page`)가 원천이다 |
| `/courses/:courseCode` | 카드 밖 `목록으로` → 과목명(`h1`), `새로고침` → 학생의 진행·결과 → 여석(강조 수치)·학생 버튼·여석 안내 → 나머지 필드 |
| `/me/enrollments` | `내 신청 내역`(`h1`) → 진행·결과 → 표(`취소`) |
| `/professor/courses` | `담당 과목`(`h1`), `과목 등록` → 표(`수정`, `폐강`) → 폼 대화상자, 폐강 확인 대화상자 |
| `/admin/enrollments` | `관리자 수강신청`(`h1`) → `학번`·`과목코드`·`배정`(폭 `max-w-md`) → 배정 결과 |
| `/admin/settings` | `서비스 설정`(`h1`), `새로고침`, 스냅샷 안내 → 현황 수치 → 둘째 카드 `동시 처리 수 변경`(`h2`) |
| `/admin/closures` | `폐강 대상`(`h1`), `선택 과목 폐강 (n건)` → 표(체크박스) → 페이지 → 일괄 폐강 결과(`h2`, 표) |

- 빈 상태·로딩·오류는 표 자리에 4.12절의 공통 표시를 쓴다. 로딩 문구는 `불러오는 중…`이다.
- 요청 중인 제출 버튼은 비활성이고 라벨은 그대로다.

## 6. 폰트 라이선스

### 6.1 출처 (2026-11-10 확인)

- 공식 업스트림 라이선스: <https://raw.githubusercontent.com/google/fonts/main/ofl/notosanskr/OFL.txt>
  - 고지: `Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'`
  - 라이선스: SIL Open Font License 1.1
- Fontsource 안내: <https://fontsource.org/fonts/noto-sans-kr/about>
- npm 패키지 `@fontsource/noto-sans-kr@5.3.1`
  - `package.json`의 `license`: `OFL-1.1`
  - `LICENSE` 파일의 첫 줄 고지: `Google Inc.`
  - 업스트림 고지와 다르므로 두 고지를 모두 보존한다.
- 라이선스 본문에 적힌 SIL OFL 안내: <http://scripts.sil.org/OFL>

### 6.2 과제 사용 가능 여부

OFL 1.1의 허가 조항은 사용 목적을 제한하지 않는다. 허가 조항 원문은 다음과 같다.

> to use, study, copy, merge, embed, modify, redistribute, and sell modified and unmodified copies of the Font Software

따라서 다음 용도에 쓸 수 있다.

- 교육용 과제
- 스크린샷, 문서, 보고서
- 웹 임베딩
- 소프트웨어 번들

앱 코드와 문서는 OFL을 채택할 필요가 없다. 조건 2는 어떤 소프트웨어와도 번들을 허용하고, 조건 5는 폰트로 만든 문서에 OFL을 요구하지 않는다.

### 6.3 지켜야 할 조건 (OFL 1.1)

1. 폰트나 그 구성요소를 **단독으로 판매하지 않는다**.
2. 폰트를 번들하거나 재배포할 때는 각 사본에 **저작권 고지와 라이선스 전문**을 포함한다.
3. **수정본은 예약 폰트 이름 `Source`를 쓰지 않는다**.
   - Fontsource의 woff2 서브셋은 형식 변환과 서브셋 작업을 거쳤으므로 수정본에 해당할 수 있다.
   - 이 앱은 글꼴 이름 `Noto Sans KR`을 그대로 쓰며, `Source`라는 이름을 쓰지 않는다.
4. 저작권자나 저작자의 이름으로 수정본을 홍보하지 않는다. 기여 사실을 밝히는 것은 허용된다.
5. 폰트 자체는 OFL로만 배포한다.

### 6.4 이 저장소의 이행 방법

- 라이선스 파일 `public/licenses/NotoSansKR-OFL.txt`는 두 부분으로 되어 있다.
  - 첫 부분: 업스트림 저작권·출처 헤더
  - 이어서: 패키지 `LICENSE` 전문 원문
- Vite는 `public/`을 빌드 결과로 복사한다. 그래서 이 파일은 `dist/licenses/NotoSansKR-OFL.txt`에 포함되고 `/licenses/NotoSansKR-OFL.txt`로 제공된다. 빌드 시 `dist/assets`에 포함되는 woff2 파일과 같은 배포물에 라이선스가 함께 들어간다.
- 조건 2는 이 독립 텍스트 파일로 충족된다. 그래서 화면에 라이선스 링크를 추가하지 않았다.

## 7. 변경 규칙

- 색과 크기 값은 `src/index.css`에서만 바꾼다. 컴포넌트에 hex 값이나 임의 색을 직접 쓰지 않는다.
- 새 전경/배경 조합은 대비를 계산해 2.4절 표에 추가한 뒤에 쓴다.
- teal 면 위 글자는 `--primary-foreground`만 쓴다. teal을 텍스트 색으로 쓰지 않는다.
- 굵기는 400과 700만 쓴다. 다른 굵기 파일을 추가하려면 이 문서와 라이선스 이행 방법(6.4절)을 함께 갱신한다.
- 다크 모드에 LMS 색을 적용하려면 근거를 먼저 확보하고 2.3절을 갱신한다.
- 모션은 `src/components/motion/`의 복사본만 쓴다. 키트 CSS를 TSX에서 가져오지 않고, 버튼 라벨은 움직이지 않으며, 축소 모션에서 멈추는지 확인한다(4.13절). 복사본을 바꾸면 같은 폴더의 `README.md` 변경 목록을 갱신한다.

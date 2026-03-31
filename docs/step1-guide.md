# 1단계: 피그마 시안 기반 HTML, CSS, TypeScript 구현

> 이 문서는 TMDB API를 활용한 영화 리뷰 앱의 1단계 구현 과정을 상세히 설명합니다.
> 템플릿으로 제공된 HTML/CSS를 기반으로 실제 동작하는 앱을 완성하는 과정입니다.

---

## 목차

1. [프로젝트 환경 설정](#1-프로젝트-환경-설정)
2. [HTML 구조 설계](#2-html-구조-설계)
3. [CSS 아키텍처](#3-css-아키텍처)
4. [TypeScript 타입 정의](#4-typescript-타입-정의)
5. [API 클라이언트](#5-api-클라이언트)
6. [메인 앱 로직](#6-메인-앱-로직)
7. [주요 학습 포인트](#7-주요-학습-포인트)

---

## 1. 프로젝트 환경 설정

### 환경변수로 API 키 관리하기

TMDB API를 사용하려면 인증 토큰이 필요합니다. **이 토큰은 절대 git history에 남으면 안 됩니다.**

Vite는 `VITE_` 접두사가 붙은 환경변수만 클라이언트에 노출합니다.

```
# .env.local
VITE_TMDB_TOKEN=your_token_here
```

`.gitignore`에 `.env*`를 추가하여 환경변수 파일이 커밋되지 않도록 합니다.

```gitignore
*.local
.env*
```

TypeScript에서 환경변수에 접근하려면 `import.meta.env`를 사용합니다:

```typescript
const TOKEN = import.meta.env.VITE_TMDB_TOKEN;
```

> **왜 `process.env`가 아닌 `import.meta.env`인가?**
>
> Vite는 브라우저용 번들러입니다. `process.env`는 Node.js 런타임 전용이고,
> Vite는 빌드 시점에 `import.meta.env`의 값을 정적으로 치환(replace)합니다.
> 이는 Vite가 Webpack의 `DefinePlugin`과 유사한 방식으로 동작하기 때문입니다.

### Vite 타입 지원

`types/global.d.ts`에 `/// <reference types="vite/client" />`를 추가하면
`import.meta.env`의 타입이 자동으로 인식됩니다.

---

## 2. HTML 구조 설계

### 전체 레이아웃

```
index.html
├── #wrap                          (전체 래퍼)
│   ├── <header>                   (로고 + 검색)
│   │   └── .header-inner
│   │       ├── .logo
│   │       └── .search-container  (중앙 정렬)
│   │
│   ├── .background-container      (배너 영역 - header 바깥)
│   │   ├── .overlay
│   │   └── .top-rated-container
│   │
│   ├── .container                 (메인 콘텐츠)
│   │   └── <main>
│   │       └── <section>
│   │           ├── #sectionTitle
│   │           ├── #movieList     (영화 카드 그리드)
│   │           ├── #loadMoreContainer
│   │           ├── #errorContainer
│   │           └── #noResult
│   │
│   └── <footer>
│
└── .modal-background              (#wrap 바깥 - 모달)
```

### 핵심 설계 결정: header와 background-container 분리

```html
<!-- header: 로고 + 검색창만 담당 -->
<header>
  <div class="header-inner">
    <h1 class="logo">...</h1>
    <div class="search-container">...</div>
  </div>
</header>

<!-- 배너: header 바깥에 독립적으로 배치 -->
<div class="background-container" id="headerBackground">
  ...
</div>
```

**왜 분리했을까?**

처음 템플릿에서는 `<header>` 안에 `background-container`가 포함되어 있었습니다.
하지만 이렇게 하면:

- 헤더의 역할(네비게이션)과 배너의 역할(시각적 임팩트)이 섞입니다
- 검색 기능이 배너에 종속되어 재사용이 어렵습니다
- 검색 모드로 전환 시 배너를 숨기거나 교체하기 복잡해집니다

분리함으로써:
- **header**: 항상 화면 상단에 고정(absolute), 로고+검색 전담
- **background-container**: 독립적인 배너 영역, API 데이터로 동적 교체 가능

### 검색창 중앙 배치: `position: absolute` 방식

피그마 시안에서 검색창은 **헤더 전체 너비 기준 정확한 중앙**에 위치합니다.

```css
.header-inner {
  position: relative;    /* 자식의 absolute 기준점 */
  display: flex;
  align-items: center;
}

.search-container {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}
```

**왜 이 방식을 선택했는가?**

| 방식 | 장점 | 단점 |
|------|------|------|
| `gap` (flex) | 간단함 | 중앙 정렬이 아닌 로고 옆 배치 |
| `margin: auto` (flex) | 간단, 자동 중앙 | 로고 너비만큼 중앙이 치우침 |
| `grid 3-column` | 정확한 중앙 | 2개 요소에 3열은 과함 |
| **`absolute + translate`** | **정확한 중앙, 로고와 독립적** | **겹침 주의 필요** |

`position: absolute`를 선택한 이유:
- 검색창이 로고 너비에 영향을 받지 않고 **항상 정확한 중앙**
- 반응형에서도 `left: 50%; transform: translateX(-50%)`는 부모 기준 중앙 유지
- 요소가 2개뿐인 심플한 구조에서 가장 직관적

> **주의**: absolute 요소는 문서 흐름에서 빠지므로, 로고가 검색창 위로 겹칠 수 있습니다.
> `.logo`에 `z-index: 1`을 주어 항상 로고가 위에 오도록 합니다.

### 모달 구조

모달은 `#wrap` **바깥**에 위치합니다:

```html
<div class="modal-background" id="modalBackground">
  <div class="modal">
    <button class="close-modal" id="closeModal">...</button>
    <div class="modal-container">
      <div class="modal-image">...</div>
      <div class="modal-description">...</div>
    </div>
  </div>
</div>
```

**왜 `#wrap` 바깥인가?**

- 모달은 페이지 전체를 덮는 오버레이입니다
- `#wrap` 안에 넣으면 부모의 `overflow`, `z-index`, `transform` 등에 영향을 받을 수 있습니다
- 바깥에 두면 독립적인 stacking context를 가지므로 안전합니다

---

## 3. CSS 아키텍처

### CSS 파일 구조

```
src/styles/
├── index.css       ← 모든 CSS를 import하는 엔트리 포인트
├── header.css      ← 헤더 레이아웃 (absolute 기반)
├── search.css      ← 검색바 스타일 (pill 형태)
├── skeleton.css    ← 로딩 스켈레톤 UI
└── error.css       ← 에러/빈결과 상태

templates/styles/   ← 제공된 템플릿 CSS (수정하지 않음)
├── reset.css
├── colors.css      ← CSS 변수 정의
├── main.css        ← 기본 레이아웃, 버튼 등
├── tab.css
├── thumbnail.css   ← 영화 카드 그리드
└── modal.css
```

### CSS 엔트리 포인트 패턴

```css
/* src/styles/index.css */
@import "../../templates/styles/reset.css";
@import "../../templates/styles/colors.css";
@import "../../templates/styles/main.css";
@import "../../templates/styles/tab.css";
@import "../../templates/styles/thumbnail.css";
@import "../../templates/styles/modal.css";
@import "./header.css";
@import "./search.css";
@import "./skeleton.css";
@import "./error.css";
```

> **왜 하나의 엔트리 파일로 모으는가?**
>
> - HTML에 여러 `<link>` 태그를 넣는 대신, JS에서 CSS를 import하면
>   Vite가 **하나의 CSS 번들**로 합쳐줍니다
> - 순서를 명확히 제어할 수 있습니다 (reset → 변수 → 레이아웃 → 컴포넌트)
> - `main.ts`에서 `import "./styles/index.css"`만 하면 모든 스타일이 적용됩니다

### 스켈레톤 UI: shimmer 애니메이션

```css
@keyframes shimmer {
  0%   { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
}

.skeleton {
  background: linear-gradient(90deg,
    var(--color-bluegray-80) 25%,
    var(--color-bluegray-90) 50%,
    var(--color-bluegray-80) 75%
  );
  background-size: 200px 100%;
  animation: shimmer 1.5s infinite;
}
```

**동작 원리:**

1. `linear-gradient`로 밝은 부분이 있는 그라데이션을 만듭니다
2. `background-size`를 실제 요소보다 작게(200px) 설정합니다
3. `background-position`을 왼쪽→오른쪽으로 이동시키며 "빛나는" 효과를 줍니다
4. `infinite`로 무한 반복합니다

이 패턴은 YouTube, Facebook 등 대부분의 서비스에서 사용하는 업계 표준 방식입니다.

### 검색 인풋: pill 형태 디자인

```css
.search-input {
  border: 1px solid var(--color-bluegray-80);  /* 배경과 거의 동일한 미묘한 테두리 */
  border-radius: 24px;                         /* pill 형태 */
  background-color: var(--color-bluegray-100); /* 어두운 배경 */
  transition: border-color 0.2s;               /* 부드러운 전환 */
}

.search-input:focus {
  border-color: var(--color-bluegray-30);      /* focus 시 테두리만 밝아짐 */
}
```

- `border-radius: 24px`으로 높이보다 큰 값을 주면 pill 형태가 됩니다
- focus 시 화려한 색상 변화 대신 테두리만 약간 밝아지는 미묘한 피드백
- 돋보기 아이콘은 `position: absolute`로 input 안 우측에 배치

---

## 4. TypeScript 타입 정의

### `src/types.ts`

```typescript
export interface Movie {
  id: number;
  title: string;
  poster_path: string | null;      // null일 수 있음!
  backdrop_path: string | null;     // 배너용 이미지
  vote_average: number;
  overview: string;
  release_date: string;
  genre_ids: number[];              // 목록에서는 ID만 제공
}

export interface MovieDetail extends Movie {
  genres: Genre[];                  // 상세에서는 Genre 객체 배열
}
```

### 핵심 포인트: API 응답 타입 설계

**1. `string | null` 타입**

TMDB API에서 `poster_path`는 이미지가 없는 영화의 경우 `null`을 반환합니다.
이를 `string`으로만 선언하면 TypeScript가 null 체크를 강제하지 않아
런타임에 이미지 URL이 `"https://...null"`이 되는 버그가 발생할 수 있습니다.

```typescript
// 타입이 string | null이므로 컴파일러가 null 체크를 강제함
const posterSrc = movie.poster_path
  ? `${IMAGE_BASE_URL}${movie.poster_path}`
  : "/templates/images/star_empty.png";  // fallback 이미지
```

**2. `Movie` vs `MovieDetail`의 분리**

- 영화 **목록** API: `genre_ids: number[]` (ID만 반환)
- 영화 **상세** API: `genres: Genre[]` (이름 포함 객체 반환)

같은 "영화"지만 API 엔드포인트에 따라 응답 형태가 다릅니다.
`extends`로 공통 필드를 상속하고, 차이나는 필드만 추가하면 중복 없이 표현할 수 있습니다.

**3. API 응답 래퍼 타입**

```typescript
export interface MovieListResponse {
  page: number;
  results: Movie[];
  total_pages: number;    // 페이지네이션에 필수
  total_results: number;
}
```

TMDB는 목록을 반환할 때 항상 이 구조로 감쌉니다.
별도의 인터페이스로 정의하면 API 함수의 반환 타입이 명확해집니다.

---

## 5. API 클라이언트

### `src/api.ts`

```typescript
const BASE_URL = "https://api.themoviedb.org/3";
const TOKEN = import.meta.env.VITE_TMDB_TOKEN;

async function fetchTMDB<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json;charset=utf-8",
    },
  });

  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
```

### 학습 포인트

**1. 제네릭 함수 `fetchTMDB<T>`**

내부 헬퍼 함수 `fetchTMDB`는 제네릭 `<T>`를 사용합니다.
호출하는 쪽에서 응답 타입을 지정하면, TypeScript가 반환값의 타입을 추론합니다:

```typescript
// fetchTMDB의 반환값이 Promise<MovieListResponse>로 추론됨
export function fetchPopularMovies(page: number): Promise<MovieListResponse> {
  return fetchTMDB<MovieListResponse>(`/movie/popular?language=ko-KR&page=${page}`);
}
```

이렇게 하면:
- fetch 관련 로직(헤더, 에러 처리)을 한 곳에서 관리
- 각 API 함수는 엔드포인트와 타입만 지정하면 됨
- 새 API 추가 시 한 줄로 해결

**2. Bearer Token 인증**

TMDB API는 Bearer Token 방식의 인증을 사용합니다:

```
Authorization: Bearer eyJhbGci...
```

- API Key 방식(`?api_key=xxx`)도 있지만, Bearer Token 방식이 더 안전합니다
- URL에 키가 노출되지 않고, 헤더에만 포함됩니다

**3. 에러 처리: `response.ok` 체크**

`fetch`는 네트워크 에러가 아닌 한 **HTTP 4xx, 5xx 에러에서도 reject되지 않습니다.**
반드시 `response.ok`를 체크해야 합니다:

```typescript
if (!response.ok) {
  throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
}
```

| 상황 | fetch 동작 | response.ok |
|------|-----------|-------------|
| 200 OK | resolve | true |
| 404 Not Found | resolve | **false** |
| 500 Server Error | resolve | **false** |
| 네트워크 끊김 | **reject** | - |

> **흔한 실수**: `fetch`가 에러 응답에서도 resolve된다는 것을 모르고
> `.then(res => res.json())`만 하면, 에러 응답의 body를 정상 데이터로 파싱하려다
> 예상치 못한 동작이 발생합니다.

**4. `encodeURIComponent`로 검색어 인코딩**

```typescript
`/search/movie?query=${encodeURIComponent(query)}`
```

사용자가 `"해리 포터"`를 입력하면 공백이 `%20`으로 인코딩됩니다.
특수문자(`&`, `=`, `?` 등)도 안전하게 처리됩니다.
이를 빠뜨리면 `query=해리 포터&page=1`에서 `포터&page=1`이 잘려나갈 수 있습니다.

---

## 6. 메인 앱 로직

### `src/main.ts`의 구조

```
main.ts
├── 상수 정의 (IMAGE_BASE_URL 등)
├── 상태 변수 (currentPage, currentQuery 등)
├── DOM 요소 참조
├── 스켈레톤 UI 함수
├── 영화 렌더링 함수
├── UI 상태 제어 함수 (showError, hideError 등)
├── 헤더 업데이트 함수
├── 데이터 로딩 함수 (loadMovies)
├── 검색 함수
├── 모달 함수
├── 이벤트 리스너 등록
└── 초기화 (loadMovies 호출)
```

### 상태 관리

프레임워크 없이 전역 변수로 상태를 관리합니다:

```typescript
let currentPage = 1;       // 현재 로드된 페이지
let totalPages = 1;        // API가 알려준 전체 페이지 수
let currentQuery = "";     // 검색어 (빈 문자열이면 인기 영화 모드)
let isLoading = false;     // 중복 요청 방지 플래그
```

> **왜 `isLoading`이 필요한가?**
>
> 사용자가 "더 보기" 버튼을 빠르게 여러 번 클릭하면,
> 동일한 페이지를 여러 번 요청하여 중복된 영화가 표시될 수 있습니다.
> `isLoading` 플래그로 진행 중인 요청이 있으면 새 요청을 무시합니다.

### 핵심 함수: `loadMovies`

```typescript
async function loadMovies(page: number, append: boolean = false) {
  if (isLoading) return;       // 1. 중복 요청 방지
  isLoading = true;

  hideError();                 // 2. 이전 상태 초기화
  hideNoResult();

  if (!append) {               // 3. 새 검색이면 기존 목록 비우기
    movieList.innerHTML = "";
  }

  showSkeleton();              // 4. 로딩 UI 표시

  try {
    const data = currentQuery  // 5. 검색/인기 분기
      ? await searchMovies(currentQuery, page)
      : await fetchPopularMovies(page);

    removeSkeleton();          // 6. 로딩 UI 제거

    totalPages = data.total_pages;
    currentPage = data.page;

    if (data.results.length === 0 && !append) {
      showNoResult();          // 7. 결과 없음 처리
      return;
    }

    renderMovies(data.results);            // 8. 영화 카드 렌더링
    updateLoadMoreButton();                // 9. 더보기 버튼 상태 업데이트
  } catch (error) {
    removeSkeleton();
    showError(/* 에러 메시지 */);          // 10. 에러 UI 표시
  } finally {
    isLoading = false;                     // 11. 플래그 해제
  }
}
```

**`append` 파라미터의 역할:**

- `append = false` (기본): 새 검색이나 첫 로드 → 기존 목록을 지우고 새로 그림
- `append = true`: "더 보기" → 기존 목록 아래에 추가

### DOM 렌더링: `insertAdjacentHTML`

```typescript
function renderMovies(movies: Movie[]) {
  movieList.insertAdjacentHTML(
    "beforeend",
    movies.map(createMovieItem).join("")
  );
}
```

> **`innerHTML` vs `insertAdjacentHTML`**
>
> | | innerHTML | insertAdjacentHTML |
> |---|---|---|
> | 기존 내용 | **덮어씀** | **유지하고 추가** |
> | 이벤트 리스너 | 기존 자식 요소의 리스너 **제거됨** | 기존 리스너 **유지** |
> | 사용 시점 | 전체 교체 시 | 추가(append) 시 |
>
> "더 보기"에서는 기존 영화 카드를 유지하면서 추가해야 하므로 `insertAdjacentHTML`을 사용합니다.

### 이벤트 위임 (Event Delegation)

```typescript
// 20~40개의 영화 카드 각각에 리스너를 붙이는 대신
// 부모인 movieList에 하나만 붙입니다
movieList.addEventListener("click", (e) => {
  const item = (e.target as HTMLElement).closest<HTMLElement>("[data-movie-id]");
  if (item) {
    const movieId = Number(item.dataset.movieId);
    openModal(movieId);
  }
});
```

**왜 이벤트 위임을 사용하는가?**

1. **성능**: 20개 * N페이지 = 수십~수백 개의 리스너 대신 1개
2. **동적 요소 대응**: "더 보기"로 나중에 추가되는 카드에도 자동으로 동작
3. **메모리**: 리스너 객체가 1개만 생성됨

`closest("[data-movie-id]")`는 클릭된 요소부터 위로 올라가며
해당 selector와 일치하는 가장 가까운 조상을 찾습니다.
이미지, 텍스트, 별점 어디를 클릭하든 영화 카드를 찾아줍니다.

### 모달: 접근성과 UX

```typescript
// 닫기: 3가지 방법 제공
closeModal.addEventListener("click", closeModalHandler);     // X 버튼

modalBackground.addEventListener("click", (e) => {
  if (e.target === modalBackground) closeModalHandler();     // 배경 클릭
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModalHandler();               // ESC 키
});
```

모달을 닫는 방법을 여러 가지 제공하는 것은 접근성(a11y)의 기본입니다:
- 마우스 사용자: X 버튼, 배경 클릭
- 키보드 사용자: ESC 키

`body.classList.add("modal-open")`으로 모달이 열렸을 때 뒤쪽 스크롤을 방지합니다.

---

## 7. 주요 학습 포인트

### 이번 단계에서 사용한 Web API들

| API | 용도 | 위치 |
|-----|------|------|
| `fetch` | HTTP 요청 | api.ts |
| `insertAdjacentHTML` | DOM에 HTML 문자열 추가 | main.ts (렌더링) |
| `closest` | 이벤트 위임 시 부모 탐색 | main.ts (클릭 핸들러) |
| `classList.add/remove` | CSS 클래스 토글 | main.ts (모달) |
| `dataset` | `data-*` 속성 접근 | main.ts (영화 ID) |
| `import.meta.env` | 환경변수 접근 (Vite) | api.ts |

### 이번 단계에서 사용한 TypeScript 기능들

| 기능 | 용도 | 예시 |
|------|------|------|
| `interface` | API 응답 타입 정의 | `Movie`, `MovieDetail` |
| `extends` | 인터페이스 상속 | `MovieDetail extends Movie` |
| 제네릭 `<T>` | 범용 fetch 함수 | `fetchTMDB<T>()` |
| 유니온 타입 | null 가능 필드 | `string \| null` |
| `as` 타입 단언 | DOM 요소 타입 지정 | `$('#id') as HTMLElement` |
| `type` import | 타입만 가져오기 | `import type { Movie }` |

### 이번 단계에서 사용한 CSS 기법들

| 기법 | 용도 | 파일 |
|------|------|------|
| CSS 변수 (`var()`) | 디자인 토큰 재사용 | 모든 CSS |
| `position: absolute` + `transform` | 검색창 중앙 배치 | header.css |
| `@keyframes` + `linear-gradient` | 스켈레톤 shimmer | skeleton.css |
| `backdrop-filter: blur()` | 모달 배경 블러 | modal.css |
| `transition` | 부드러운 상태 전환 | search.css, modal.css |

### 현재 코드의 한계 (2단계에서 개선 예정)

1. **테스트 없음**: 기능이 올바르게 동작하는지 검증하는 자동화된 방법이 없음
2. **하나의 큰 파일**: `main.ts`에 모든 로직이 모여 있어 유지보수가 어려움
3. **전역 상태**: `let` 변수로 상태를 관리하여 추적이 어려움
4. **HTML 문자열**: `createMovieItem`에서 템플릿 리터럴로 HTML을 생성하여 XSS 위험
5. **타입 단언 남용**: `as HTMLElement`를 반복 사용하여 타입 안전성이 약함

> 이런 한계들은 의도적으로 남겨두었습니다.
> 2단계에서 테스트를 작성하고, 3~4단계에서 리팩토링하면서
> "왜 개선이 필요한지"를 체감하는 것이 학습의 핵심입니다.

---

## 파일 목록 정리

| 파일 | 역할 |
|------|------|
| `.env.local` | TMDB API 토큰 (git에서 제외) |
| `index.html` | 메인 HTML - 헤더, 배너, 영화목록, 모달, 에러 영역 |
| `src/types.ts` | Movie, MovieDetail, Genre 등 TypeScript 타입 |
| `src/api.ts` | TMDB API 클라이언트 (인기영화, 검색, 상세) |
| `src/main.ts` | 앱 전체 로직 (렌더링, 이벤트, 상태관리) |
| `src/styles/index.css` | CSS 통합 import |
| `src/styles/header.css` | 헤더 레이아웃 (absolute 기반) |
| `src/styles/search.css` | 검색바 스타일 (pill 형태) |
| `src/styles/skeleton.css` | 스켈레톤 로딩 애니메이션 |
| `src/styles/error.css` | 에러/빈결과 상태 스타일 |

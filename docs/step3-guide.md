# 3단계: 코드 리팩토링 — 컴포넌트 분리와 재사용성

> 이 문서는 1~2단계에서 완성한 영화 리뷰 앱의 코드를 **역할별로 분리**하고 **재사용성을 높이는** 리팩토링 과정을 설명합니다.
> 1단계(한 파일에 모든 것), 2단계(테스트 추가)와 비교하여 **구조가 어떻게 개선되었는지**를 중심으로 다룹니다.

---

## 목차

1. [1~2단계 vs 3단계 — 무엇이 달라졌는가?](#1-12단계-vs-3단계--무엇이-달라졌는가)
2. [리팩토링의 원칙](#2-리팩토링의-원칙)
3. [config.ts — 상수 분리](#3-configts--상수-분리)
4. [api.ts — 함수 → 클래스로](#4-apits--함수--클래스로)
5. [컴포넌트 분리](#5-컴포넌트-분리)
6. [main.ts — 조립만 담당하는 진입점](#6-maints--조립만-담당하는-진입점)
7. [테스트가 리팩토링을 가능하게 하는 이유](#7-테스트가-리팩토링을-가능하게-하는-이유)
8. [주요 학습 포인트](#8-주요-학습-포인트)

---

## 1. 1~2단계 vs 3단계 — 무엇이 달라졌는가?

### 1단계의 구조

```
src/
├── main.ts    ← 286줄. 모든 것이 여기에.
├── api.ts     ← 개별 함수 4개
├── types.ts
└── styles/
```

`main.ts` 하나에 다음이 전부 들어있었습니다:
- 이미지 URL 상수 3개
- 상태 변수 4개
- DOM 요소 참조 15개
- 스켈레톤 UI 함수 3개
- 영화 렌더링 함수 3개
- 에러/빈 결과 UI 함수 4개
- 헤더 업데이트 함수 1개
- 데이터 로딩 함수 1개
- 검색 함수 2개
- 모달 함수 2개
- 이벤트 리스너 8개

### 3단계의 구조

```
src/
├── main.ts           ← 110줄. 조립과 핵심 로직만.
├── api.ts            ← ApiClient 클래스
├── config.ts         ← 상수 모음
├── types.ts
├── components/
│   ├── MovieList.ts  ← 영화 목록 렌더링 + 스켈레톤
│   ├── Modal.ts      ← 모달 열기/닫기
│   ├── Header.ts     ← 헤더 배경/영화 정보
│   ├── Search.ts     ← 검색 입력/이벤트
│   └── ErrorDisplay.ts ← 에러 표시/숨기기
└── styles/
```

### 한눈에 보는 변화

| 측면 | 1단계 | 3단계 |
|------|-------|-------|
| **main.ts 크기** | 286줄 | 110줄 |
| **파일 수** | 3개 | 9개 |
| **각 파일의 역할** | 불명확 | 이름만 보면 알 수 있음 |
| **코드 수정 시** | main.ts에서 해당 부분 찾아야 함 | 해당 파일만 열면 됨 |
| **API 상수** | main.ts 상단에 흩어져 있음 | config.ts에 모여 있음 |
| **API 호출** | 개별 함수들 | 클래스의 메서드들 |

---

## 2. 리팩토링의 원칙

### 왜 리팩토링하는가?

코드가 동작한다고 끝이 아닙니다. **유지보수**가 시작입니다.

```
현재: "모달 닫기 버튼이 안 돼요"
1단계: main.ts를 열고 → 286줄에서 모달 관련 코드를 찾아야 함
3단계: components/Modal.ts를 열면 끝
```

### 리팩토링의 3가지 기준

1. **단일 책임 원칙(SRP)**: 하나의 파일/클래스는 하나의 역할만
   - `MovieList.ts`: 영화 목록 렌더링에만 집중
   - `Modal.ts`: 모달 열기/닫기에만 집중

2. **캡슐화(Encapsulation)**: 내부 구현을 숨기고 인터페이스만 노출
   - `Modal.open(movie)`, `Modal.close()` — 내부에서 어떤 DOM을 조작하는지 외부는 모름

3. **의존성 주입(DI)**: 컴포넌트가 외부 의존성을 직접 만들지 않고 받아서 사용
   - `new MovieList(listEl, container, noResultEl, onMovieClick)` — DOM 요소를 생성자에서 받음

### 리팩토링의 안전망: 테스트

2단계에서 작성한 테스트 덕분에, 리팩토링 후에도 **기존 기능이 깨지지 않았다는 것을 확인**할 수 있습니다:

```bash
$ npx vitest run
# ✓ 11 tests passed — API 기능이 여전히 정상 동작

$ npx cypress run
# ✓ 16 tests passed — 사용자 시나리오가 여전히 정상 동작
```

---

## 3. config.ts — 상수 분리

### Before (1단계: main.ts 상단에 흩어져 있음)

```typescript
// main.ts
const IMAGE_BASE_URL = "https://media.themoviedb.org/t/p/w440_and_h660_face";
const BANNER_BASE_URL = "https://image.tmdb.org/t/p/w1920_and_h800_multi_faces";
const POSTER_ORIGINAL_URL = "https://image.tmdb.org/t/p/original";
```

**문제점:**
- 이 상수들이 `main.ts`뿐만 아니라 다른 파일에서도 필요하면? `main.ts`에서 export해야 하는데, `main.ts`는 앱의 진입점이라 다른 파일이 import하기 부적절
- 이미지 URL을 변경하려면 `main.ts`를 열어야 함

### After (3단계: config.ts로 분리)

```typescript
// config.ts
export const IMAGE_URL = {
  THUMBNAIL: "https://media.themoviedb.org/t/p/w440_and_h660_face",
  BANNER: "https://image.tmdb.org/t/p/w1920_and_h800_multi_faces",
  ORIGINAL: "https://image.tmdb.org/t/p/original",
} as const;

export const FALLBACK_IMAGE = "/templates/images/star_empty.png";
export const MOVIES_PER_PAGE = 20;
```

**개선점:**
- 어떤 파일에서든 `import { IMAGE_URL } from "../config"` 가능
- 관련 상수가 한 곳에 모여 있어 찾기 쉬움
- `as const`로 **리터럴 타입** 보장 — 실수로 값을 변경하면 TypeScript가 에러를 냄
- `MOVIES_PER_PAGE` 같은 매직 넘버도 이름이 붙어 의미가 명확

### `as const`란?

```typescript
// as const 없이
const obj = { A: "hello" };
// obj.A의 타입: string (아무 문자열이나 가능)

// as const 사용
const obj = { A: "hello" } as const;
// obj.A의 타입: "hello" (정확히 이 값만 가능)
// obj.A = "bye"  // ← TypeScript 에러! readonly
```

---

## 4. api.ts — 함수 → 클래스로

### Before (1단계: 개별 함수)

```typescript
// api.ts (1단계)
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

export function fetchPopularMovies(page: number): Promise<MovieListResponse> {
  return fetchTMDB<MovieListResponse>(`/movie/popular?language=ko-KR&page=${page}`);
}

// 다른 함수들도 같은 패턴...
```

**문제점:**
- `BASE_URL`과 `TOKEN`이 모듈 최상위에 고정 → 테스트할 때 교체하기 어려움
- `fetchTMDB`가 모듈 스코프에 있어서 여러 API 서버를 사용하려면 코드 복사 필요

### After (3단계: ApiClient 클래스)

```typescript
// api.ts (3단계)
class ApiClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    // ... 동일한 로직
  }

  fetchPopularMovies(page: number): Promise<MovieListResponse> { ... }
  searchMovies(query: string, page: number): Promise<MovieListResponse> { ... }
  fetchMovieDetail(movieId: number): Promise<MovieDetail> { ... }
  fetchGenres(): Promise<GenreListResponse> { ... }
}

export const apiClient = new ApiClient(
  API_BASE_URL,
  import.meta.env.VITE_TMDB_TOKEN
);
```

### 클래스로 바꾸면 무엇이 좋아지는가?

#### 1. 생성자를 통한 설정 주입

```typescript
// 1단계: BASE_URL과 TOKEN이 코드에 고정
const BASE_URL = "...";  // 바꾸려면 코드 자체를 수정해야 함

// 3단계: 생성자에서 받음 — 다른 값을 넣을 수 있음
const client = new ApiClient("https://api.themoviedb.org/3", "real-token");
const testClient = new ApiClient("http://localhost:3000", "test-token");
```

#### 2. private으로 내부 구현 보호

```typescript
class ApiClient {
  private async fetch<T>(endpoint: string): Promise<T> { ... }
  //^^^^^^ 외부에서 직접 호출 불가!

  fetchPopularMovies(page: number) { ... }
  //외부에서 사용할 수 있는 메서드만 공개
}

apiClient.fetch("/some/endpoint");        // ❌ TypeScript 에러
apiClient.fetchPopularMovies(1);           // ✅ 정상
```

#### 3. 메서드 체이닝과 확장이 쉬움

```typescript
// 미래에 기능을 추가하고 싶다면, 클래스에 메서드만 추가하면 됨
class ApiClient {
  // 기존 메서드들...
  fetchMovieReviews(movieId: number) { ... }   // 새 기능 추가가 간단
}
```

### class 문법 정리

```typescript
class ApiClient {
  // 필드 선언 (인스턴스가 가지는 데이터)
  private baseUrl: string;     // private: 클래스 내부에서만 접근 가능
  private token: string;

  // 생성자: new ApiClient(...)할 때 실행
  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;    // this = 현재 인스턴스
    this.token = token;
  }

  // private 메서드: 내부에서만 사용
  private async fetch<T>(endpoint: string): Promise<T> {
    // this.baseUrl, this.token으로 인스턴스 데이터 접근
    const response = await fetch(`${this.baseUrl}${endpoint}`, { ... });
    return response.json();
  }

  // public 메서드: 외부에서 호출 가능 (기본값이 public)
  fetchPopularMovies(page: number) {
    return this.fetch<MovieListResponse>(`/movie/popular?...&page=${page}`);
  }
}

// 사용
const apiClient = new ApiClient("https://...", "token");
apiClient.fetchPopularMovies(1);  // public 메서드 호출
```

### 싱글턴 패턴

```typescript
// 모듈 최상위에서 인스턴스를 하나 만들어 export
export const apiClient = new ApiClient(API_BASE_URL, import.meta.env.VITE_TMDB_TOKEN);
```

앱 전체에서 `apiClient`를 import하면 **같은 인스턴스**를 공유합니다. API 클라이언트는 여러 개 만들 필요가 없으므로 이 패턴이 적합합니다.

---

## 5. 컴포넌트 분리

### 컴포넌트란?

여기서 **컴포넌트**는 React 컴포넌트가 아닙니다. **특정 DOM 영역을 담당하는 클래스**입니다:

```
HTML 구조                           담당 컴포넌트
─────────                          ──────────────
<header>                           → (직접 이벤트만)
  <input id="searchInput">         → Search
  <button id="searchButton">       → Search

<div id="headerBackground">        → Header
  <div id="topRatedMovie">         → Header

<ul id="movieList">                → MovieList
<div id="loadMoreContainer">       → MovieList

<div id="errorContainer">          → ErrorDisplay
<div id="modalBackground">         → Modal
```

### Before (1단계: 전부 main.ts에 함수로)

```typescript
// main.ts에 모달 관련 코드가 흩어져 있었음

const modalBackground = $("#modalBackground") as HTMLDivElement;
const closeModal = $("#closeModal") as HTMLButtonElement;

async function openModal(movieId: number) {
  // ... 20줄의 DOM 조작
  modalBackground.classList.add("active");
  document.body.classList.add("modal-open");
}

function closeModalHandler() {
  modalBackground.classList.remove("active");
  document.body.classList.remove("modal-open");
}

// 이벤트 리스너도 main.ts 하단에
closeModal.addEventListener("click", closeModalHandler);
modalBackground.addEventListener("click", (e) => {
  if (e.target === modalBackground) closeModalHandler();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModalHandler();
});
```

**문제점:**
- 모달 관련 코드가 main.ts의 여러 곳에 흩어져 있음 (변수 선언, 함수 정의, 이벤트 리스너)
- DOM 요소 참조, 함수, 이벤트가 같은 스코프에 섞여 있어 관계 파악이 어려움

### After (3단계: Modal 클래스)

```typescript
// components/Modal.ts
export class Modal {
  private backgroundEl: HTMLDivElement;
  private posterEl: HTMLImageElement;
  private titleEl: HTMLHeadingElement;
  // ... (모달 관련 DOM 참조가 클래스 안에)

  constructor(backgroundEl: HTMLDivElement) {
    this.backgroundEl = backgroundEl;
    // DOM 요소를 찾고, 이벤트 리스너를 등록 — 전부 생성자에서
    this.posterEl = backgroundEl.querySelector("#modalPoster") as HTMLImageElement;

    const closeBtn = backgroundEl.querySelector("#closeModal") as HTMLButtonElement;
    closeBtn.addEventListener("click", () => this.close());

    backgroundEl.addEventListener("click", (e) => {
      if (e.target === backgroundEl) this.close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.close();
    });
  }

  open(movie: MovieDetail) {
    this.posterEl.src = movie.poster_path ? `${IMAGE_URL.ORIGINAL}${movie.poster_path}` : "";
    this.titleEl.textContent = movie.title;
    // ... 모든 DOM 업데이트
    this.backgroundEl.classList.add("active");
  }

  close() {
    this.backgroundEl.classList.remove("active");
    document.body.classList.remove("modal-open");
  }
}
```

**개선점:**
- 모달 관련 코드가 **한 파일에 전부 모여 있음**
- `open(movie)`과 `close()`라는 명확한 인터페이스
- 내부 DOM 참조(`posterEl`, `titleEl`)는 `private`으로 숨겨짐

### 사용하는 쪽 (main.ts)

```typescript
// 1단계: main.ts에서 직접 DOM 조작
($("#modalPoster") as HTMLImageElement).src = posterSrc;
($("#modalTitle") as HTMLHeadingElement).textContent = movie.title;
// ... 10줄 더

// 3단계: 한 줄
modal.open(movie);
```

### MovieList 컴포넌트 — 콜백 패턴

```typescript
export class MovieList {
  constructor(
    listEl: HTMLUListElement,
    loadMoreContainer: HTMLDivElement,
    noResultEl: HTMLParagraphElement,
    onMovieClick: (movieId: number) => void    // ← 콜백 함수
  ) {
    // ...
    this.listEl.addEventListener("click", (e) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>("[data-movie-id]");
      if (item) {
        this.onMovieClick(Number(item.dataset.movieId));  // 콜백 실행
      }
    });
  }
}
```

**왜 콜백을 쓰는가?**

MovieList는 "영화 카드를 클릭하면 무엇을 할지"를 **모릅니다**. 모달을 열 수도 있고, 다른 페이지로 이동할 수도 있습니다. 이 결정은 MovieList를 **사용하는 쪽**(main.ts)이 합니다:

```typescript
// main.ts에서 결정
const movieList = new MovieList(
  listEl, container, noResultEl,
  (movieId) => openMovieDetail(movieId)   // ← 모달을 여는 것은 main.ts가 결정
);
```

이 패턴을 **콜백 패턴** 또는 **의존성 역전**이라고 합니다:
- MovieList: "클릭되면 알려줄게" (이벤트 감지만 담당)
- main.ts: "클릭되면 모달을 열어" (동작을 결정)

### Search 컴포넌트 — 이벤트 위임을 캡슐화

```typescript
export class Search {
  constructor(
    inputEl: HTMLInputElement,
    buttonEl: HTMLButtonElement,
    onSearch: (query: string) => void
  ) {
    buttonEl.addEventListener("click", () => this.handleSearch());
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handleSearch();
    });
  }

  private handleSearch() {
    const query = this.inputEl.value.trim();
    if (!query) return;
    this.onSearch(query);   // 검색어만 전달, 무엇을 할지는 외부가 결정
  }

  clear() {
    this.inputEl.value = "";
  }
}
```

**1단계 대비 개선점:**
- 검색 관련 이벤트 리스너가 Search 내부에 캡슐화
- "빈 검색어 무시" 로직도 Search 내부에
- 외부에서는 `search.clear()` 같은 명확한 인터페이스만 사용

### ErrorDisplay 컴포넌트

```typescript
export class ErrorDisplay {
  constructor(
    containerEl: HTMLDivElement,
    messageEl: HTMLParagraphElement,
    retryBtn: HTMLButtonElement,
    onRetry: () => void                  // 재시도 콜백
  ) {
    this.retryBtn.addEventListener("click", onRetry);
  }

  show(message: string) { ... }
  hide() { ... }
}
```

가장 단순한 컴포넌트입니다. 하지만 분리하는 이유는 명확합니다:
- `show(message)` / `hide()` 인터페이스로 **어떤 DOM을 조작하는지 숨김**
- 재시도 로직은 콜백으로 **외부에서 주입**

---

## 6. main.ts — 조립만 담당하는 진입점

### Before (1단계: 286줄)

```
main.ts
├── 상수 3개
├── 상태 변수 4개
├── DOM 참조 15개
├── 스켈레톤 함수 3개
├── 렌더링 함수 3개
├── UI 함수 4개
├── 헤더 함수 1개
├── 데이터 로딩 1개
├── 검색 함수 2개
├── 모달 함수 2개
└── 이벤트 리스너 8개
```

### After (3단계: 110줄)

```typescript
// main.ts (3단계) — 역할별로 분리하면 이것만 남음

// 1. import
import { apiClient } from "./api";
import { MovieList } from "./components/MovieList";
import { Modal } from "./components/Modal";
// ...

// 2. 상태 (앱 전체가 공유하는 상태만)
let currentPage = 1;
let totalPages = 1;
let currentQuery = "";
let isLoading = false;

// 3. 컴포넌트 조립
const modal = new Modal($("#modalBackground") as HTMLDivElement);
const header = new Header(/* ... */, (movieId) => openMovieDetail(movieId));
const movieList = new MovieList(/* ... */, (movieId) => openMovieDetail(movieId));
const errorDisplay = new ErrorDisplay(/* ... */, () => loadMovies(currentPage, currentPage > 1));
const search = new Search(/* ... */, (query) => { /* 검색 실행 */ });

// 4. 핵심 비즈니스 로직 (loadMovies, openMovieDetail)
async function loadMovies(page: number, append: boolean = false) { ... }
async function openMovieDetail(movieId: number) { ... }

// 5. 나머지 이벤트 + 초기화
loadMoreButton.addEventListener("click", () => loadMovies(currentPage + 1, true));
loadMovies(1);
```

**main.ts의 역할이 명확해졌습니다:**
1. 컴포넌트를 **생성하고 연결**
2. 컴포넌트 간 **통신을 조율** (검색 → 목록 갱신, 클릭 → 모달 열기)
3. **앱 전체 상태** 관리 (currentPage, currentQuery 등)

---

## 7. 테스트가 리팩토링을 가능하게 하는 이유

### 리팩토링 전후의 차이

```
코드 구조:        1단계 (단일 파일)  →  3단계 (컴포넌트 분리)
코드 동작:        동일함                동일함
외부 인터페이스:   동일함                동일함 (같은 HTML, 같은 API)
```

**테스트가 보장하는 것:**

```bash
# 리팩토링 전에 통과하던 테스트가
$ npx vitest run     # 11 passed ✓
$ npx cypress run    # 16 passed ✓

# 리팩토링 후에도 동일하게 통과
$ npx vitest run     # 11 passed ✓
$ npx cypress run    # 16 passed ✓
```

E2E 테스트는 **내부 구조를 모릅니다**. "검색어를 입력하고 엔터를 누르면 검색 결과가 표시된다"만 확인합니다. 따라서 내부 코드가 한 파일이든 10개 파일이든, 동작이 같으면 테스트는 통과합니다.

이것이 **2단계에서 테스트를 먼저 작성한 이유**입니다:
1. 1단계: 동작하는 코드 작성
2. 2단계: 동작을 검증하는 테스트 작성
3. 3단계: **테스트라는 안전망 위에서** 코드 구조 개선

### 단위 테스트의 변화

API 단위 테스트는 리팩토링에 맞게 **약간 수정**해야 했습니다:

```typescript
// 2단계: 개별 함수를 import
import { fetchPopularMovies } from "../api";
await fetchPopularMovies(1);

// 3단계: 클래스 인스턴스의 메서드를 호출
const { apiClient } = await import("../api");
await apiClient.fetchPopularMovies(1);
```

**테스트가 검증하는 것은 동일합니다**: "인기 영화 API를 호출하면 올바른 URL로 fetch가 호출되고, 결과를 반환한다." 내부가 함수인지 클래스인지는 테스트 관점에서 중요하지 않습니다.

---

## 8. 주요 학습 포인트

### 8-1. 파일을 나누는 기준

**"이 코드를 수정할 이유가 다르면 다른 파일로 분리"**

| 수정 이유 | 해당 파일 |
|----------|----------|
| API URL이 바뀜 | config.ts |
| API 인증 방식이 바뀜 | api.ts |
| 영화 카드 디자인이 바뀜 | components/MovieList.ts |
| 모달 닫기 동작이 바뀜 | components/Modal.ts |
| 검색 UX가 바뀜 | components/Search.ts |
| 에러 메시지가 바뀜 | components/ErrorDisplay.ts |
| 전체 흐름이 바뀜 | main.ts |

### 8-2. class를 쓰는 것이 항상 좋은가?

**아닙니다.** 이 프로젝트에서 class를 사용한 이유는:

- DOM 요소 참조 + 이벤트 리스너 + 상태가 하나의 단위로 묶여야 함
- `constructor`에서 초기 설정을 하고, 메서드로 동작을 정의하는 패턴이 적합
- `private`으로 내부 구현을 숨길 수 있음

**함수가 더 적합한 경우:**
- 상태가 없는 순수 변환 (예: `createMovieItem`은 Movie → HTML 문자열)
- 단순한 유틸리티

현재 코드에서도 `createSkeletonItems`와 `createMovieItem`은 **클래스 밖의 함수**로 남겨두었습니다. 상태가 필요없는 순수 함수이기 때문입니다.

### 8-3. 1단계 → 2단계 → 3단계 마인드셋 변화

```
1단계: "동작하는 코드를 만든다"
       → 기능 구현에 집중, 구조는 신경 쓰지 않음

2단계: "동작한다는 것을 증명한다"
       → 테스트를 작성해 자동 검증 가능하게 만듦

3단계: "안전하게 구조를 개선한다"
       → 테스트라는 안전망 위에서 코드를 역할별로 분리
       → 다음 사람(또는 미래의 나)이 이해하기 쉬운 코드로 변환
```

### 8-4. 리팩토링 체크리스트

리팩토링을 할 때 스스로 물어볼 질문들:

- [ ] **테스트가 있는가?** 없으면 테스트부터 작성 (2단계 먼저!)
- [ ] **한 파일이 너무 많은 일을 하는가?** → 역할별로 분리
- [ ] **같은 상수/로직이 여러 곳에 반복되는가?** → 한 곳으로 모음
- [ ] **코드를 수정할 때 관련 없는 코드까지 읽어야 하는가?** → 분리
- [ ] **리팩토링 후 테스트가 여전히 통과하는가?** → 필수 확인!

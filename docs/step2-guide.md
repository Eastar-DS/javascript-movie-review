# 2단계: 테스트 전략과 구현

> 이 문서는 1단계에서 완성한 영화 리뷰 앱에 **단위 테스트(vitest)**와 **E2E 테스트(cypress)**를 추가하는 과정을 설명합니다.
> 1단계와 비교하여 **무엇이 개선되었는지**, **왜 테스트가 필요한지**를 중심으로 다룹니다.

---

## 목차

1. [1단계 vs 2단계 — 무엇이 달라졌는가?](#1-1단계-vs-2단계--무엇이-달라졌는가)
2. [테스트 전략 세우기](#2-테스트-전략-세우기)
3. [Vitest 단위 테스트](#3-vitest-단위-테스트)
4. [Cypress E2E 테스트](#4-cypress-e2e-테스트)
5. [API 오류 대비](#5-api-오류-대비)
6. [주요 학습 포인트](#6-주요-학습-포인트)

---

## 1. 1단계 vs 2단계 — 무엇이 달라졌는가?

### 1단계의 한계

1단계에서는 **"동작하는 코드"**를 만들었습니다. 하지만 다음과 같은 문제가 있었습니다:

| 문제점 | 구체적 상황 |
|--------|------------|
| **수동 확인에 의존** | 코드를 수정할 때마다 브라우저를 열어 직접 클릭하며 확인해야 했음 |
| **회귀 버그 위험** | 검색 기능을 고치다가 더 보기 버튼이 깨질 수 있지만, 알아차리기 어려움 |
| **오류 대비 부족** | API가 500 에러를 반환하거나 네트워크가 끊어졌을 때 어떻게 되는지 검증하지 않음 |
| **리팩토링 두려움** | 코드를 개선하고 싶어도, 기존 기능이 깨질까봐 건드리기 어려움 |

### 2단계에서 추가된 것

```
1단계                         2단계
─────────                    ─────────
src/api.ts      ────→        src/__tests__/api.test.ts (단위 테스트)
src/main.ts     ────→        cypress/e2e/movie-list.cy.ts (E2E 테스트)
"동작하면 됨"     ────→        "자동으로 검증할 수 있음"
```

**핵심 변화**: 코드를 수정했을 때 **기존 기능이 깨지지 않았다는 것을 자동으로 확인**할 수 있게 되었습니다.

---

## 2. 테스트 전략 세우기

### 테스트 피라미드

```
        ╱╲
       ╱E2E╲         ← 적게, 핵심 사용자 플로우만
      ╱──────╲
     ╱ 통합    ╲      ← 컴포넌트 간 상호작용
    ╱────────────╲
   ╱   단위 테스트  ╲   ← 많이, 개별 함수/모듈 단위
  ╱────────────────╲
```

| 단계 | 도구 | 대상 | 속도 |
|------|------|------|------|
| 단위 테스트 | vitest | API 함수들 (fetch 모킹) | 매우 빠름 (ms) |
| E2E 테스트 | cypress | 실제 브라우저에서 사용자 플로우 | 느림 (초 단위) |

### 이 프로젝트의 테스트 전략

**단위 테스트 대상**: `api.ts`의 각 함수
- 정상 응답 처리
- HTTP 에러 상태 코드 처리 (401, 404, 500)
- 네트워크 에러 처리
- URL 파라미터 정확성

**E2E 테스트 대상**: 사용자 관점의 핵심 플로우
- 영화 목록 조회 (초기 로딩, 더 보기, 스켈레톤 UI)
- 검색 (버튼 클릭, 엔터키, 빈 결과, 로고 클릭으로 복귀)
- 모달 (열기, 닫기 — 버튼/ESC/배경 클릭)
- 오류 처리 (500 에러, 네트워크 에러, 재시도)

---

## 3. Vitest 단위 테스트

### 3-1. 설정 파일 이해하기

#### vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",   // 브라우저 환경을 시뮬레이션
    globals: true,           // describe, it, expect를 import 없이 사용
    setupFiles: ["./src/__tests__/setup.ts"],  // 매 테스트 전에 실행
  },
});
```

**왜 `jsdom`인가?**

`api.ts`는 브라우저의 `fetch` API를 사용합니다. Node.js 환경에서 테스트하려면 브라우저 API를 흉내내야 합니다. `jsdom`은 Node.js 안에서 브라우저의 `document`, `window`, `fetch` 등을 시뮬레이션해줍니다.

#### setup.ts

```typescript
import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();  // 매 테스트 후 모킹을 원래대로 복원
});
```

**왜 `restoreAllMocks`가 필요한가?**

테스트 A에서 `fetch`를 모킹했는데 복원하지 않으면, 테스트 B에서도 모킹된 `fetch`가 사용됩니다. 테스트 간 격리(isolation)를 위해 매번 복원합니다.

### 3-2. fetch 모킹 이해하기

#### 1단계에서는 실제 API를 호출했음

```typescript
// 1단계: 실제 네트워크 요청
const data = await fetchPopularMovies(1);
// → 실제로 TMDB 서버에 HTTP 요청을 보냄
// → 인터넷 연결 필요, 느림, API 키 필요, 결과가 매번 달라질 수 있음
```

#### 2단계에서는 fetch를 가짜로 교체

```typescript
// fetch를 가짜 함수로 교체
vi.spyOn(globalThis, "fetch").mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockData),
} as Response);

// 이제 fetchPopularMovies는 실제 HTTP 요청 대신 위의 가짜 응답을 받음
const data = await fetchPopularMovies(1);
```

**왜 모킹하는가?**

| 실제 API 호출 | fetch 모킹 |
|--------------|-----------|
| 인터넷 연결 필요 | 오프라인에서도 동작 |
| 느림 (수백ms) | 매우 빠름 (1ms 미만) |
| 결과가 변할 수 있음 | 항상 같은 결과 |
| API 키 필요 | 불필요 |
| 서버 에러를 인위적으로 만들 수 없음 | 500 에러, 네트워크 에러 등 자유롭게 시뮬레이션 |

#### 모킹 헬퍼 함수들

테스트 코드에서 반복되는 모킹 패턴을 함수로 추출했습니다:

```typescript
// 성공 응답 모킹
function mockFetchSuccess(data: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

// HTTP 에러 모킹 (401, 404, 500 등)
function mockFetchFailure(status: number, statusText: string) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: false,       // ← ok가 false이면 api.ts의 if (!response.ok) 분기 진입
    status,
    statusText,
  } as Response);
}

// 네트워크 에러 모킹 (서버에 아예 도달하지 못하는 경우)
function mockFetchNetworkError() {
  return vi.spyOn(globalThis, "fetch")
    .mockRejectedValue(new TypeError("Failed to fetch"));
}
```

### 3-3. 테스트 코드 구조

#### describe / it / expect 패턴

```typescript
describe("fetchPopularMovies", () => {        // 테스트 그룹
  it("인기 영화 목록을 정상적으로 가져온다", async () => {  // 하나의 테스트 케이스
    const spy = mockFetchSuccess(mockMovieListResponse);

    const result = await fetchPopularMovies(1);

    expect(result).toEqual(mockMovieListResponse);     // 결과 검증
    expect(spy).toHaveBeenCalledWith(                   // fetch 호출 검증
      expect.stringContaining("/movie/popular"),
      expect.any(Object)
    );
  });
});
```

**이 구조를 분해하면:**

1. **Arrange (준비)**: `mockFetchSuccess()`로 가짜 fetch 설정
2. **Act (실행)**: `fetchPopularMovies(1)` 호출
3. **Assert (검증)**: `expect()`로 결과 확인

이것을 **AAA 패턴**이라고 합니다. 테스트의 기본 구조입니다.

#### 주요 expect 매처들

```typescript
// 값이 같은지 (깊은 비교)
expect(result).toEqual(mockMovieListResponse);

// 특정 문자열을 포함하는지
expect(spy).toHaveBeenCalledWith(
  expect.stringContaining("page=3"),  // URL에 page=3이 포함되어 있는지
  expect.any(Object)
);

// 에러가 던져지는지
await expect(fetchPopularMovies(1)).rejects.toThrow("API 요청 실패: 401");

// 배열 길이
expect(result.results).toHaveLength(0);
```

### 3-4. 테스트 케이스 설계 — 무엇을 테스트해야 하는가?

각 함수별로 **정상 경로**와 **예외 경로**를 모두 테스트합니다:

```
fetchPopularMovies
├── ✅ 정상: 영화 목록을 가져온다
├── ✅ 정상: 페이지 번호가 URL에 포함된다
├── ❌ 예외: API 401 에러 → 에러를 던진다
└── ❌ 예외: 네트워크 에러 → 에러를 던진다

searchMovies
├── ✅ 정상: 검색 결과를 가져온다
├── ✅ 정상: 한글 검색어가 URL 인코딩된다
├── ✅ 엣지: 빈 결과를 정상 처리한다
└── ❌ 예외: 서버 500 에러 → 에러를 던진다
```

**1단계 대비 개선점**: 1단계에서는 "검색어에 한글이 포함되면 URL 인코딩이 잘 되는가?" 같은 것을 브라우저에서 직접 확인해야 했지만, 이제는 테스트가 자동으로 확인합니다.

### 3-5. vi.spyOn과 vi.stubEnv 이해하기

#### vi.spyOn — 기존 함수를 감시하거나 교체

```typescript
const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(/* ... */);

// spy는 두 가지 역할:
// 1. fetch를 가짜 구현으로 교체
// 2. fetch가 어떻게 호출되었는지 기록 (호출 횟수, 인자 등)

expect(spy).toHaveBeenCalledTimes(1);    // 1번 호출되었는지
expect(spy).toHaveBeenCalledWith(url, options);  // 어떤 인자로 호출되었는지
```

#### vi.stubEnv — 환경변수 모킹

```typescript
vi.stubEnv("VITE_TMDB_TOKEN", "test-token");
// 테스트 중에는 import.meta.env.VITE_TMDB_TOKEN이 "test-token"
```

실제 API 토큰 없이도 테스트할 수 있게 해줍니다.

---

## 4. Cypress E2E 테스트

### 4-1. E2E 테스트란?

단위 테스트가 **함수 하나**를 테스트한다면, E2E 테스트는 **사용자의 행동 전체**를 테스트합니다:

```
단위 테스트:  fetchPopularMovies() → 올바른 데이터 반환?
E2E 테스트:   페이지 열기 → 영화 20개 보이는지 → 더보기 클릭 → 40개 되는지
```

**실제 브라우저**에서 실행되므로 DOM 렌더링, CSS 표시, 이벤트 핸들링까지 모두 검증합니다.

### 4-2. Cypress 설정

#### cypress.config.ts

```typescript
import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",   // cy.visit("/")의 기준 URL
    viewportWidth: 1280,                // 브라우저 가로 크기
    viewportHeight: 900,                // 브라우저 세로 크기
  },
});
```

**1단계 대비 변경점:**
- `baseUrl` 추가: 매 테스트에서 `cy.visit("localhost:5173")` 대신 `cy.visit("/")` 사용
- 뷰포트 크기 고정: 화면 크기에 따라 테스트 결과가 달라지는 것을 방지

### 4-3. cy.intercept — API 가로채기

E2E 테스트에서 가장 중요한 개념입니다. **실제 API 요청을 가로채서 가짜 응답**을 돌려줍니다:

```typescript
// 이 코드가 실행된 후, 브라우저에서 movie/popular 요청을 하면
// 실제 TMDB 서버 대신 mockMovies(1) 데이터가 응답됨
cy.intercept("GET", `${API_BASE}/movie/popular*`, {
  statusCode: 200,
  body: mockMovies(1),
}).as("getPopularMovies");

cy.visit("/");
cy.wait("@getPopularMovies");  // 가로채기한 요청이 완료될 때까지 대기
```

#### vitest의 모킹과 cypress의 intercept 비교

| | vitest `vi.spyOn(fetch)` | cypress `cy.intercept` |
|---|---|---|
| **레벨** | JavaScript 함수 레벨 | 네트워크 레벨 (브라우저 → 서버 사이) |
| **범위** | `fetch` 함수만 교체 | 실제 HTTP 요청을 가로챔 |
| **장점** | 빠르고 정밀한 제어 | 실제 브라우저 환경에서 동작 |
| **용도** | 함수의 입출력 검증 | 사용자 시나리오 검증 |

### 4-4. E2E 테스트 구조 분석

#### 핵심 플로우 1: 영화 목록 조회

```typescript
describe("영화 목록 조회", () => {
  beforeEach(() => {
    // 모든 테스트 전에 API를 가로채고 페이지를 방문
    cy.intercept("GET", `${API_BASE}/movie/popular*`, {
      statusCode: 200,
      body: mockMovies(1),
    }).as("getPopularMovies");

    cy.visit("/");
    cy.wait("@getPopularMovies");
  });

  it("페이지 로드 시 인기 영화 20개가 표시된다", () => {
    cy.get("#movieList .item").should("have.length", 20);
    cy.get("#sectionTitle").should("contain", "지금 인기 있는 영화");
  });

  it("더 보기 버튼을 클릭하면 다음 페이지 영화가 추가된다", () => {
    // 2페이지 API도 가로채기
    cy.intercept("GET", `${API_BASE}/movie/popular*page=2*`, {
      statusCode: 200,
      body: mockMovies(2),
    }).as("getPage2");

    cy.get("#loadMoreButton").click();
    cy.wait("@getPage2");

    cy.get("#movieList .item").should("have.length", 40);  // 20 + 20
  });
});
```

**주목할 점:**
- `beforeEach`: 매 테스트 시작 전에 깨끗한 상태에서 시작
- `cy.wait("@getPopularMovies")`: 비동기 API가 완료된 후에 DOM을 검증
- `should("have.length", 40)`: 1단계에서는 직접 세야 했던 것을 자동 검증

#### 핵심 플로우 2: 스켈레톤 UI 검증

```typescript
it("영화 로딩 중 스켈레톤 UI가 표시된다", () => {
  cy.intercept("GET", `${API_BASE}/movie/popular*`, {
    statusCode: 200,
    body: mockMovies(1),
    delay: 500,          // ← 500ms 지연시켜서 로딩 상태를 관찰
  }).as("getMoviesSlow");

  cy.visit("/");
  cy.get(".skeleton-thumbnail").should("exist");   // 로딩 중: 스켈레톤 있음
  cy.wait("@getMoviesSlow");
  cy.get(".skeleton-thumbnail").should("not.exist"); // 로딩 완료: 스켈레톤 없음
});
```

**1단계 대비 개선점**: 스켈레톤 UI는 빠르게 사라져서 눈으로 확인하기 어려웠지만, `delay`를 추가해 **로딩 상태를 인위적으로 유지**하면서 검증할 수 있습니다.

#### 핵심 플로우 3: 오류 처리

```typescript
describe("API 오류 처리", () => {
  it("API 요청 실패 시 에러 메시지가 표시된다", () => {
    cy.intercept("GET", `${API_BASE}/movie/popular*`, {
      statusCode: 500,
    }).as("getMoviesFail");

    cy.visit("/");
    cy.wait("@getMoviesFail");

    cy.get("#errorContainer").should("be.visible");
    cy.get("#errorMessage").should("not.be.empty");
  });

  it("다시 시도 버튼으로 API를 재요청한다", () => {
    // 첫 요청: 실패
    cy.intercept("GET", `${API_BASE}/movie/popular*`, {
      statusCode: 500,
    }).as("getMoviesFail");

    cy.visit("/");
    cy.wait("@getMoviesFail");

    // 재시도 요청: 성공으로 바꿈
    cy.intercept("GET", `${API_BASE}/movie/popular*`, {
      statusCode: 200,
      body: mockMovies(1),
    }).as("getMoviesRetry");

    cy.get("#retryButton").click();
    cy.wait("@getMoviesRetry");

    cy.get("#errorContainer").should("not.be.visible");
    cy.get("#movieList .item").should("have.length", 20);
  });
});
```

**1단계에서는 불가능했던 것**: 서버 에러를 인위적으로 발생시키고, 에러 UI가 제대로 표시되는지 확인하는 것. 실제 TMDB API가 500 에러를 내기를 기다릴 수는 없으니까요.

### 4-5. cy.intercept의 동적 활용

같은 URL에 대해 **첫 번째와 두 번째 요청의 응답을 다르게** 설정할 수 있습니다:

```typescript
// 처음에는 실패
cy.intercept("GET", `${API_BASE}/movie/popular*`, {
  statusCode: 500,
}).as("fail");

cy.visit("/");
cy.wait("@fail");

// 이제 성공으로 변경 (새로운 intercept가 이전 것을 덮어씀)
cy.intercept("GET", `${API_BASE}/movie/popular*`, {
  statusCode: 200,
  body: mockMovies(1),
}).as("success");

cy.get("#retryButton").click();
cy.wait("@success");
```

### 4-6. Cypress 주요 명령어 정리

```typescript
// 페이지 방문
cy.visit("/");

// DOM 요소 선택 (CSS 셀렉터)
cy.get("#movieList .item");

// 사용자 행동
cy.get("#searchInput").type("인셉션");      // 텍스트 입력
cy.get("#searchInput").type("{enter}");      // 엔터키
cy.get("#searchButton").click();             // 클릭
cy.get("body").type("{esc}");               // ESC 키

// 검증 (assertion)
cy.get("#movieList .item").should("have.length", 20);
cy.get("#sectionTitle").should("contain", "검색 결과");
cy.get("#errorContainer").should("be.visible");
cy.get("#errorContainer").should("not.be.visible");
cy.get("#modalBackground").should("have.class", "active");
cy.get("#searchInput").should("have.value", "");

// API 가로채기
cy.intercept("GET", url, { statusCode: 200, body: data }).as("alias");
cy.wait("@alias");  // 해당 요청이 완료될 때까지 대기
```

---

## 5. API 오류 대비

### 1단계의 오류 처리 (이미 구현됨)

`api.ts`에서 `response.ok`를 체크하고 있었습니다:

```typescript
if (!response.ok) {
  throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
}
```

`main.ts`에서 `try/catch`로 에러를 잡고 있었습니다:

```typescript
try {
  const data = await fetchPopularMovies(page);
  // ...
} catch (error) {
  const msg = error instanceof Error
    ? error.message
    : "알 수 없는 오류가 발생했습니다.";
  showError(msg);
}
```

### 2단계에서 추가된 것: 이것이 제대로 동작하는지 **검증**

| 시나리오 | 단위 테스트 | E2E 테스트 |
|----------|-----------|-----------|
| HTTP 401 (인증 실패) | `fetchPopularMovies`가 에러를 throw하는지 | - |
| HTTP 404 (존재하지 않는 리소스) | `fetchMovieDetail(999999)`가 에러를 throw하는지 | - |
| HTTP 500 (서버 에러) | `searchMovies`가 에러를 throw하는지 | 에러 UI가 표시되는지 |
| 네트워크 에러 (오프라인) | TypeError가 전파되는지 | 에러 UI가 표시되는지 |
| 에러 후 재시도 | - | 재시도 버튼이 정상 동작하는지 |

### 비동기 통신에서 일어날 수 있는 다양한 상황

```
사용자 행동              발생할 수 있는 문제           대응 방법
────────────          ──────────────────         ──────────
페이지 로드             서버 다운 (500)              에러 메시지 + 재시도 버튼
검색 요청              네트워크 끊김                  에러 메시지 + 재시도 버튼
더 보기 클릭           토큰 만료 (401)               에러 메시지
영화 상세 보기         해당 영화 삭제됨 (404)          alert으로 알림
빠른 연속 클릭         중복 요청 발생                  isLoading 플래그로 방지
느린 네트워크          사용자가 오래 기다림             스켈레톤 UI로 로딩 표시
```

**`isLoading` 플래그** (main.ts:13)는 1단계에서 이미 구현되어 있었지만, 2단계에서는 이것이 실제로 중복 요청을 막는지 자동으로 검증할 수 있습니다.

---

## 6. 주요 학습 포인트

### 6-1. 테스트의 3가지 원칙

1. **격리(Isolation)**: 각 테스트는 독립적이어야 한다
   - `beforeEach`로 매번 깨끗한 상태 시작
   - `afterEach`로 모킹 복원
   - 테스트 A의 결과가 테스트 B에 영향을 주면 안 됨

2. **결정적(Deterministic)**: 같은 테스트는 항상 같은 결과
   - 실제 API 대신 모킹 사용
   - 랜덤 데이터 사용 금지
   - 시간에 의존하는 테스트 주의

3. **빠름(Fast)**: 자주 실행할 수 있어야 의미가 있다
   - 단위 테스트: ms 단위
   - E2E 테스트: 초 단위 (가능한 한 핵심만)

### 6-2. 무엇을 테스트하고, 무엇을 테스트하지 않는가

**테스트해야 하는 것:**
- 비즈니스 로직 (API 응답 처리, 에러 핸들링)
- 사용자 시나리오 (검색, 더 보기, 모달)
- 엣지 케이스 (빈 결과, 마지막 페이지, 네트워크 에러)

**테스트하지 않아도 되는 것:**
- CSS 스타일이 예쁜지 (시각적 검증은 별도 도구 필요)
- 외부 라이브러리의 내부 동작 (fetch 자체가 동작하는지)
- 구현 세부사항 (내부 변수의 값이 뭔지)

### 6-3. 테스트 실행 방법

```bash
# 단위 테스트 실행
npm run test-unit

# 단위 테스트 (감시 모드 — 파일 수정 시 자동 재실행)
npx vitest

# E2E 테스트 실행 (Cypress GUI)
# 먼저 dev 서버를 실행한 후:
npm run dev
# 새 터미널에서:
npm run test-e2e

# E2E 테스트 (CLI 모드, CI에서 사용)
npx cypress run
```

### 6-4. 1단계 → 2단계 핵심 마인드셋 변화

```
1단계: "내가 만든 코드가 동작한다" (수동 확인)
2단계: "내가 만든 코드가 동작한다는 것을 증명할 수 있다" (자동 검증)
```

이제 3단계에서 코드를 리팩토링할 때, **테스트가 통과하는 한 기존 기능이 깨지지 않았다**는 확신을 가지고 코드를 수정할 수 있습니다. 이것이 테스트의 진짜 가치입니다.

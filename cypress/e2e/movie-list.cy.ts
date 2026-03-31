const API_BASE = "https://api.themoviedb.org/3";

const mockMovies = (page: number, totalPages = 5) => ({
  page,
  results: Array.from({ length: 20 }, (_, i) => ({
    id: (page - 1) * 20 + i + 1,
    title: `영화 ${(page - 1) * 20 + i + 1}`,
    poster_path: "/test.jpg",
    backdrop_path: "/backdrop.jpg",
    vote_average: 7.5 + Math.random(),
    overview: "테스트 줄거리",
    release_date: "2024-01-01",
    genre_ids: [28],
  })),
  total_pages: totalPages,
  total_results: totalPages * 20,
});

const mockEmptyMovies = {
  page: 1,
  results: [],
  total_pages: 0,
  total_results: 0,
};

const mockMovieDetail = {
  id: 1,
  title: "영화 1",
  poster_path: "/test.jpg",
  backdrop_path: "/backdrop.jpg",
  vote_average: 8.5,
  overview: "상세 줄거리입니다.",
  release_date: "2024-01-01",
  genre_ids: [28],
  genres: [{ id: 28, name: "액션" }],
};

describe("영화 목록 조회", () => {
  beforeEach(() => {
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

  it("헤더에 1위 영화 정보가 표시된다", () => {
    cy.get("#topRatedMovie .title").should("contain", "영화 1");
    cy.get("#topRatedMovie .rate-value").should("not.be.empty");
  });

  it("더 보기 버튼을 클릭하면 다음 페이지 영화가 추가된다", () => {
    cy.intercept("GET", `${API_BASE}/movie/popular*page=2*`, {
      statusCode: 200,
      body: mockMovies(2),
    }).as("getPage2");

    cy.get("#loadMoreButton").click();
    cy.wait("@getPage2");

    cy.get("#movieList .item").should("have.length", 40);
  });

  it("마지막 페이지에 도달하면 더 보기 버튼이 사라진다", () => {
    // 1페이지가 마지막인 응답으로 재방문
    cy.intercept("GET", `${API_BASE}/movie/popular*`, {
      statusCode: 200,
      body: mockMovies(1, 1),
    }).as("getLastPage");

    cy.visit("/");
    cy.wait("@getLastPage");

    cy.get("#loadMoreContainer").should("not.be.visible");
  });

  it("영화 로딩 중 스켈레톤 UI가 표시된다", () => {
    cy.intercept("GET", `${API_BASE}/movie/popular*`, {
      statusCode: 200,
      body: mockMovies(1),
      delay: 500,
    }).as("getMoviesSlow");

    cy.visit("/");
    cy.get(".skeleton-thumbnail").should("exist");
    cy.wait("@getMoviesSlow");
    cy.get(".skeleton-thumbnail").should("not.exist");
  });
});

describe("영화 검색", () => {
  beforeEach(() => {
    cy.intercept("GET", `${API_BASE}/movie/popular*`, {
      statusCode: 200,
      body: mockMovies(1),
    }).as("getPopularMovies");

    cy.visit("/");
    cy.wait("@getPopularMovies");
  });

  it("검색어 입력 후 버튼 클릭으로 검색한다", () => {
    cy.intercept("GET", `${API_BASE}/search/movie*`, {
      statusCode: 200,
      body: mockMovies(1, 1),
    }).as("searchMovies");

    cy.get("#searchInput").type("인셉션");
    cy.get("#searchButton").click();
    cy.wait("@searchMovies");

    cy.get("#sectionTitle").should("contain", '"인셉션" 검색 결과');
    cy.get("#movieList .item").should("have.length", 20);
  });

  it("엔터키로 검색한다", () => {
    cy.intercept("GET", `${API_BASE}/search/movie*`, {
      statusCode: 200,
      body: mockMovies(1, 1),
    }).as("searchMovies");

    cy.get("#searchInput").type("인셉션{enter}");
    cy.wait("@searchMovies");

    cy.get("#sectionTitle").should("contain", '"인셉션" 검색 결과');
  });

  it("검색 결과가 없으면 안내 메시지가 표시된다", () => {
    cy.intercept("GET", `${API_BASE}/search/movie*`, {
      statusCode: 200,
      body: mockEmptyMovies,
    }).as("searchEmpty");

    cy.get("#searchInput").type("aslkdjflaskdjf{enter}");
    cy.wait("@searchEmpty");

    cy.get("#noResult").should("be.visible");
  });

  it("빈 검색어로는 검색이 되지 않는다", () => {
    cy.get("#searchButton").click();
    cy.get("#sectionTitle").should("contain", "지금 인기 있는 영화");
  });

  it("로고 클릭 시 인기 영화 목록으로 돌아간다", () => {
    cy.intercept("GET", `${API_BASE}/search/movie*`, {
      statusCode: 200,
      body: mockMovies(1, 1),
    }).as("searchMovies");

    cy.get("#searchInput").type("인셉션{enter}");
    cy.wait("@searchMovies");
    cy.get("#sectionTitle").should("contain", "검색 결과");

    cy.intercept("GET", `${API_BASE}/movie/popular*`, {
      statusCode: 200,
      body: mockMovies(1),
    }).as("getPopularAgain");

    cy.get(".logo").click();
    cy.wait("@getPopularAgain");

    cy.get("#sectionTitle").should("contain", "지금 인기 있는 영화");
    cy.get("#searchInput").should("have.value", "");
  });
});

describe("영화 상세 모달", () => {
  beforeEach(() => {
    cy.intercept("GET", `${API_BASE}/movie/popular*`, {
      statusCode: 200,
      body: mockMovies(1),
    }).as("getPopularMovies");

    cy.visit("/");
    cy.wait("@getPopularMovies");
  });

  it("영화 카드 클릭 시 상세 모달이 열린다", () => {
    cy.intercept("GET", `${API_BASE}/movie/1*`, {
      statusCode: 200,
      body: mockMovieDetail,
    }).as("getMovieDetail");

    cy.get("#movieList .item").first().click();
    cy.wait("@getMovieDetail");

    cy.get("#modalBackground").should("have.class", "active");
    cy.get("#modalTitle").should("contain", "영화 1");
    cy.get("#modalRate").should("contain", "8.5");
    cy.get("#modalDetail").should("contain", "상세 줄거리입니다.");
  });

  it("닫기 버튼으로 모달을 닫는다", () => {
    cy.intercept("GET", `${API_BASE}/movie/1*`, {
      statusCode: 200,
      body: mockMovieDetail,
    }).as("getMovieDetail");

    cy.get("#movieList .item").first().click();
    cy.wait("@getMovieDetail");

    cy.get("#closeModal").click();
    cy.get("#modalBackground").should("not.have.class", "active");
  });

  it("ESC 키로 모달을 닫는다", () => {
    cy.intercept("GET", `${API_BASE}/movie/1*`, {
      statusCode: 200,
      body: mockMovieDetail,
    }).as("getMovieDetail");

    cy.get("#movieList .item").first().click();
    cy.wait("@getMovieDetail");

    cy.get("body").type("{esc}");
    cy.get("#modalBackground").should("not.have.class", "active");
  });

  it("모달 배경 클릭으로 모달을 닫는다", () => {
    cy.intercept("GET", `${API_BASE}/movie/1*`, {
      statusCode: 200,
      body: mockMovieDetail,
    }).as("getMovieDetail");

    cy.get("#movieList .item").first().click();
    cy.wait("@getMovieDetail");

    cy.get("#modalBackground").click("topLeft");
    cy.get("#modalBackground").should("not.have.class", "active");
  });

  it("헤더의 자세히 보기 버튼으로 모달이 열린다", () => {
    cy.intercept("GET", `${API_BASE}/movie/1*`, {
      statusCode: 200,
      body: mockMovieDetail,
    }).as("getMovieDetail");

    cy.get("#topRatedDetailBtn").click();
    cy.wait("@getMovieDetail");

    cy.get("#modalBackground").should("have.class", "active");
  });
});

describe("API 오류 처리", () => {
  it("API 요청 실패 시 에러 메시지가 표시된다", () => {
    cy.intercept("GET", `${API_BASE}/movie/popular*`, {
      statusCode: 500,
      body: { status_message: "Internal Server Error" },
    }).as("getMoviesFail");

    cy.visit("/");
    cy.wait("@getMoviesFail");

    cy.get("#errorContainer").should("be.visible");
    cy.get("#errorMessage").should("not.be.empty");
  });

  it("다시 시도 버튼으로 API를 재요청한다", () => {
    cy.intercept("GET", `${API_BASE}/movie/popular*`, {
      statusCode: 500,
      body: { status_message: "Internal Server Error" },
    }).as("getMoviesFail");

    cy.visit("/");
    cy.wait("@getMoviesFail");

    cy.intercept("GET", `${API_BASE}/movie/popular*`, {
      statusCode: 200,
      body: mockMovies(1),
    }).as("getMoviesRetry");

    cy.get("#retryButton").click();
    cy.wait("@getMoviesRetry");

    cy.get("#errorContainer").should("not.be.visible");
    cy.get("#movieList .item").should("have.length", 20);
  });

  it("네트워크 에러 시 에러 메시지가 표시된다", () => {
    cy.intercept("GET", `${API_BASE}/movie/popular*`, {
      forceNetworkError: true,
    }).as("networkError");

    cy.visit("/");
    cy.wait("@networkError");

    cy.get("#errorContainer").should("be.visible");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MovieListResponse, MovieDetail, GenreListResponse } from "../types";

// ApiClient를 직접 import하지 않고, 클래스를 동적으로 생성하기 위해
// api.ts의 내부 구현을 테스트합니다.
// apiClient 싱글턴은 import.meta.env에 의존하므로, 테스트에서는 클래스를 직접 사용합니다.

const mockMovieListResponse: MovieListResponse = {
  page: 1,
  results: [
    {
      id: 1,
      title: "테스트 영화",
      poster_path: "/test.jpg",
      backdrop_path: "/backdrop.jpg",
      vote_average: 8.5,
      overview: "테스트 줄거리",
      release_date: "2024-01-01",
      genre_ids: [28, 12],
    },
  ],
  total_pages: 5,
  total_results: 100,
};

const mockMovieDetail: MovieDetail = {
  id: 1,
  title: "테스트 영화",
  poster_path: "/test.jpg",
  backdrop_path: "/backdrop.jpg",
  vote_average: 8.5,
  overview: "테스트 줄거리",
  release_date: "2024-01-01",
  genre_ids: [28],
  genres: [{ id: 28, name: "액션" }],
};

const mockGenreListResponse: GenreListResponse = {
  genres: [
    { id: 28, name: "액션" },
    { id: 12, name: "모험" },
  ],
};

function mockFetchSuccess(data: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

function mockFetchFailure(status: number, statusText: string) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: false,
    status,
    statusText,
  } as Response);
}

function mockFetchNetworkError() {
  return vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new TypeError("Failed to fetch"));
}

// ApiClient 클래스를 동적으로 가져오기 위한 헬퍼
async function createTestClient() {
  // import.meta.env 모킹을 위해 vi.stubEnv 사용
  vi.stubEnv("VITE_TMDB_TOKEN", "test-token");
  const { apiClient } = await import("../api");
  return apiClient;
}

describe("ApiClient", () => {
  let client: Awaited<ReturnType<typeof createTestClient>>;

  beforeEach(async () => {
    vi.resetModules();
    client = await createTestClient();
  });

  describe("fetchPopularMovies", () => {
    it("인기 영화 목록을 정상적으로 가져온다", async () => {
      const spy = mockFetchSuccess(mockMovieListResponse);

      const result = await client.fetchPopularMovies(1);

      expect(result).toEqual(mockMovieListResponse);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("/movie/popular"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Bearer"),
          }),
        })
      );
    });

    it("페이지 번호가 URL에 포함된다", async () => {
      const spy = mockFetchSuccess(mockMovieListResponse);

      await client.fetchPopularMovies(3);

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("page=3"),
        expect.any(Object)
      );
    });

    it("API 응답이 실패하면 에러를 던진다", async () => {
      mockFetchFailure(401, "Unauthorized");

      await expect(client.fetchPopularMovies(1)).rejects.toThrow(
        "API 요청 실패: 401"
      );
    });

    it("네트워크 에러가 발생하면 에러를 던진다", async () => {
      mockFetchNetworkError();

      await expect(client.fetchPopularMovies(1)).rejects.toThrow(
        "Failed to fetch"
      );
    });
  });

  describe("searchMovies", () => {
    it("검색 결과를 정상적으로 가져온다", async () => {
      const spy = mockFetchSuccess(mockMovieListResponse);

      const result = await client.searchMovies("인셉션", 1);

      expect(result).toEqual(mockMovieListResponse);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("/search/movie"),
        expect.any(Object)
      );
    });

    it("검색어가 URL 인코딩된다", async () => {
      const spy = mockFetchSuccess(mockMovieListResponse);

      await client.searchMovies("한글 검색", 1);

      const calledUrl = spy.mock.calls[0][0] as string;
      expect(calledUrl).toContain(encodeURIComponent("한글 검색"));
    });

    it("빈 결과를 정상적으로 처리한다", async () => {
      const emptyResponse: MovieListResponse = {
        page: 1,
        results: [],
        total_pages: 0,
        total_results: 0,
      };
      mockFetchSuccess(emptyResponse);

      const result = await client.searchMovies("존재하지않는영화", 1);

      expect(result.results).toHaveLength(0);
    });

    it("서버 에러(500)에 대해 에러를 던진다", async () => {
      mockFetchFailure(500, "Internal Server Error");

      await expect(client.searchMovies("테스트", 1)).rejects.toThrow(
        "API 요청 실패: 500"
      );
    });
  });

  describe("fetchMovieDetail", () => {
    it("영화 상세 정보를 정상적으로 가져온다", async () => {
      mockFetchSuccess(mockMovieDetail);

      const result = await client.fetchMovieDetail(1);

      expect(result).toEqual(mockMovieDetail);
      expect(result.genres).toHaveLength(1);
      expect(result.genres[0].name).toBe("액션");
    });

    it("존재하지 않는 영화 ID로 요청하면 에러를 던진다", async () => {
      mockFetchFailure(404, "Not Found");

      await expect(client.fetchMovieDetail(999999)).rejects.toThrow(
        "API 요청 실패: 404"
      );
    });
  });

  describe("fetchGenres", () => {
    it("장르 목록을 정상적으로 가져온다", async () => {
      mockFetchSuccess(mockGenreListResponse);

      const result = await client.fetchGenres();

      expect(result.genres).toHaveLength(2);
      expect(result.genres[0]).toEqual({ id: 28, name: "액션" });
    });
  });
});

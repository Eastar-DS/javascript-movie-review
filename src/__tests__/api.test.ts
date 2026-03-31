import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchPopularMovies,
  searchMovies,
  fetchMovieDetail,
  fetchGenres,
} from "../api";
import type { MovieListResponse, MovieDetail, GenreListResponse } from "../types";

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

describe("API 함수", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_TMDB_TOKEN", "test-token");
  });

  describe("fetchPopularMovies", () => {
    it("인기 영화 목록을 정상적으로 가져온다", async () => {
      const spy = mockFetchSuccess(mockMovieListResponse);

      const result = await fetchPopularMovies(1);

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

      await fetchPopularMovies(3);

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("page=3"),
        expect.any(Object)
      );
    });

    it("API 응답이 실패하면 에러를 던진다", async () => {
      mockFetchFailure(401, "Unauthorized");

      await expect(fetchPopularMovies(1)).rejects.toThrow("API 요청 실패: 401");
    });

    it("네트워크 에러가 발생하면 에러를 던진다", async () => {
      mockFetchNetworkError();

      await expect(fetchPopularMovies(1)).rejects.toThrow("Failed to fetch");
    });
  });

  describe("searchMovies", () => {
    it("검색 결과를 정상적으로 가져온다", async () => {
      const spy = mockFetchSuccess(mockMovieListResponse);

      const result = await searchMovies("인셉션", 1);

      expect(result).toEqual(mockMovieListResponse);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("/search/movie"),
        expect.any(Object)
      );
    });

    it("검색어가 URL 인코딩된다", async () => {
      const spy = mockFetchSuccess(mockMovieListResponse);

      await searchMovies("한글 검색", 1);

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

      const result = await searchMovies("존재하지않는영화", 1);

      expect(result.results).toHaveLength(0);
    });

    it("서버 에러(500)에 대해 에러를 던진다", async () => {
      mockFetchFailure(500, "Internal Server Error");

      await expect(searchMovies("테스트", 1)).rejects.toThrow(
        "API 요청 실패: 500"
      );
    });
  });

  describe("fetchMovieDetail", () => {
    it("영화 상세 정보를 정상적으로 가져온다", async () => {
      mockFetchSuccess(mockMovieDetail);

      const result = await fetchMovieDetail(1);

      expect(result).toEqual(mockMovieDetail);
      expect(result.genres).toHaveLength(1);
      expect(result.genres[0].name).toBe("액션");
    });

    it("존재하지 않는 영화 ID로 요청하면 에러를 던진다", async () => {
      mockFetchFailure(404, "Not Found");

      await expect(fetchMovieDetail(999999)).rejects.toThrow(
        "API 요청 실패: 404"
      );
    });
  });

  describe("fetchGenres", () => {
    it("장르 목록을 정상적으로 가져온다", async () => {
      mockFetchSuccess(mockGenreListResponse);

      const result = await fetchGenres();

      expect(result.genres).toHaveLength(2);
      expect(result.genres[0]).toEqual({ id: 28, name: "액션" });
    });
  });
});

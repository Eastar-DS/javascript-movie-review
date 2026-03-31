import { API_BASE_URL } from "./config";
import type { MovieListResponse, MovieDetail, GenreListResponse } from "./types";

class ApiClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async fetch<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json;charset=utf-8",
      },
    });

    if (!response.ok) {
      throw new Error(
        `API 요청 실패: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  fetchPopularMovies(page: number): Promise<MovieListResponse> {
    return this.fetch<MovieListResponse>(
      `/movie/popular?language=ko-KR&page=${page}`
    );
  }

  searchMovies(query: string, page: number): Promise<MovieListResponse> {
    return this.fetch<MovieListResponse>(
      `/search/movie?language=ko-KR&query=${encodeURIComponent(query)}&page=${page}`
    );
  }

  fetchMovieDetail(movieId: number): Promise<MovieDetail> {
    return this.fetch<MovieDetail>(`/movie/${movieId}?language=ko-KR`);
  }

  fetchGenres(): Promise<GenreListResponse> {
    return this.fetch<GenreListResponse>(`/genre/movie/list?language=ko-KR`);
  }
}

export const apiClient = new ApiClient(
  API_BASE_URL,
  import.meta.env.VITE_TMDB_TOKEN
);

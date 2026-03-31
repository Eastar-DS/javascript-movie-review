import { MovieListResponse, MovieDetail, GenreListResponse } from "./types";

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
  return fetchTMDB<MovieListResponse>(
    `/movie/popular?language=ko-KR&page=${page}`
  );
}

export function searchMovies(
  query: string,
  page: number
): Promise<MovieListResponse> {
  return fetchTMDB<MovieListResponse>(
    `/search/movie?language=ko-KR&query=${encodeURIComponent(query)}&page=${page}`
  );
}

export function fetchMovieDetail(movieId: number): Promise<MovieDetail> {
  return fetchTMDB<MovieDetail>(
    `/movie/${movieId}?language=ko-KR`
  );
}

export function fetchGenres(): Promise<GenreListResponse> {
  return fetchTMDB<GenreListResponse>(`/genre/movie/list?language=ko-KR`);
}

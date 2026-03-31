export interface Movie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  overview: string;
  release_date: string;
  genre_ids: number[];
}

export interface MovieDetail extends Movie {
  genres: Genre[];
}

export interface Genre {
  id: number;
  name: string;
}

export interface MovieListResponse {
  page: number;
  results: Movie[];
  total_pages: number;
  total_results: number;
}

export interface GenreListResponse {
  genres: Genre[];
}

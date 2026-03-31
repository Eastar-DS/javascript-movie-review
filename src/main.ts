import "./styles/index.css";
import { apiClient } from "./api";
import { MovieList } from "./components/MovieList";
import { Modal } from "./components/Modal";
import { Header } from "./components/Header";
import { Search } from "./components/Search";
import { ErrorDisplay } from "./components/ErrorDisplay";

// --- State ---
let currentPage = 1;
let totalPages = 1;
let currentQuery = "";
let isLoading = false;

// --- DOM Elements ---
const $ = (selector: string) => document.querySelector(selector);

const sectionTitle = $("#sectionTitle") as HTMLHeadingElement;
const loadMoreButton = $("#loadMoreButton") as HTMLButtonElement;
const loadMoreContainer = $("#loadMoreContainer") as HTMLDivElement;

// --- Components ---
const modal = new Modal($("#modalBackground") as HTMLDivElement);

const header = new Header(
  $("#headerBackground") as HTMLDivElement,
  $("#topRatedMovie") as HTMLDivElement,
  $("#topRatedDetailBtn") as HTMLButtonElement,
  (movieId) => openMovieDetail(movieId)
);

const movieList = new MovieList(
  $("#movieList") as HTMLUListElement,
  loadMoreContainer,
  $("#noResult") as HTMLParagraphElement,
  (movieId) => openMovieDetail(movieId)
);

const errorDisplay = new ErrorDisplay(
  $("#errorContainer") as HTMLDivElement,
  $("#errorMessage") as HTMLParagraphElement,
  $("#retryButton") as HTMLButtonElement,
  () => loadMovies(currentPage, currentPage > 1)
);

const search = new Search(
  $("#searchInput") as HTMLInputElement,
  $("#searchButton") as HTMLButtonElement,
  (query) => {
    currentQuery = query;
    currentPage = 1;
    sectionTitle.textContent = `"${query}" 검색 결과`;
    loadMovies(1);
  }
);

// --- Core Logic ---
async function openMovieDetail(movieId: number) {
  try {
    const movie = await apiClient.fetchMovieDetail(movieId);
    modal.open(movie);
  } catch {
    alert("영화 정보를 불러오는데 실패했습니다.");
  }
}

async function loadMovies(page: number, append: boolean = false) {
  if (isLoading) return;
  isLoading = true;

  errorDisplay.hide();
  movieList.hideNoResult();

  if (!append) {
    movieList.clear();
  }

  movieList.showSkeleton();

  try {
    const data = currentQuery
      ? await apiClient.searchMovies(currentQuery, page)
      : await apiClient.fetchPopularMovies(page);

    movieList.removeSkeleton();

    totalPages = data.total_pages;
    currentPage = data.page;

    if (data.results.length === 0 && !append) {
      movieList.showNoResult();
      return;
    }

    movieList.renderMovies(data.results);

    if (!append && !currentQuery && data.results.length > 0) {
      header.update(data.results[0]);
    }

    movieList.updateLoadMoreButton(currentPage, totalPages);
  } catch (error) {
    movieList.removeSkeleton();
    const msg =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    errorDisplay.show(msg);
  } finally {
    isLoading = false;
  }
}

// --- Event Listeners ---
loadMoreButton.addEventListener("click", () => {
  loadMovies(currentPage + 1, true);
});

const logo = $(".logo") as HTMLElement;
logo.style.cursor = "pointer";
logo.addEventListener("click", () => {
  search.clear();
  currentQuery = "";
  currentPage = 1;
  sectionTitle.textContent = "지금 인기 있는 영화";
  loadMovies(1);
});

// --- Init ---
loadMovies(1);

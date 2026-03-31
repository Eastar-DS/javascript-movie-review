import "./styles/index.css";
import { fetchPopularMovies, searchMovies, fetchMovieDetail } from "./api";
import type { Movie } from "./types";

const IMAGE_BASE_URL = "https://media.themoviedb.org/t/p/w440_and_h660_face";
const BANNER_BASE_URL =
  "https://image.tmdb.org/t/p/w1920_and_h800_multi_faces";
const POSTER_ORIGINAL_URL = "https://image.tmdb.org/t/p/original";

let currentPage = 1;
let totalPages = 1;
let currentQuery = "";
let isLoading = false;

// DOM Elements
const $ = (selector: string) => document.querySelector(selector);

const movieList = $("#movieList") as HTMLUListElement;
const loadMoreButton = $("#loadMoreButton") as HTMLButtonElement;
const loadMoreContainer = $("#loadMoreContainer") as HTMLDivElement;
const searchInput = $("#searchInput") as HTMLInputElement;
const searchButton = $("#searchButton") as HTMLButtonElement;
const sectionTitle = $("#sectionTitle") as HTMLHeadingElement;
const errorContainer = $("#errorContainer") as HTMLDivElement;
const errorMessage = $("#errorMessage") as HTMLParagraphElement;
const retryButton = $("#retryButton") as HTMLButtonElement;
const noResult = $("#noResult") as HTMLParagraphElement;
const modalBackground = $("#modalBackground") as HTMLDivElement;
const closeModal = $("#closeModal") as HTMLButtonElement;
const topRatedDetailBtn = $("#topRatedDetailBtn") as HTMLButtonElement;
const headerBackground = $("#headerBackground") as HTMLDivElement;
const topRatedMovie = $("#topRatedMovie") as HTMLDivElement;

let topRatedMovieId: number | null = null;

// --- Skeleton UI ---
function createSkeletonItems(count: number): string {
  return Array.from(
    { length: count },
    () => `
    <li>
      <div class="item">
        <div class="skeleton skeleton-thumbnail"></div>
        <div class="item-desc">
          <div class="skeleton skeleton-text-short"></div>
          <div class="skeleton skeleton-text"></div>
        </div>
      </div>
    </li>
  `
  ).join("");
}

function showSkeleton() {
  movieList.insertAdjacentHTML("beforeend", createSkeletonItems(20));
}

function removeSkeleton() {
  movieList
    .querySelectorAll(".skeleton-thumbnail")
    .forEach((el) => el.closest("li")?.remove());
}

// --- Movie Rendering ---
function createMovieItem(movie: Movie): string {
  const posterSrc = movie.poster_path
    ? `${IMAGE_BASE_URL}${movie.poster_path}`
    : "/templates/images/star_empty.png";

  return `
    <li>
      <div class="item" data-movie-id="${movie.id}">
        <img
          class="thumbnail"
          src="${posterSrc}"
          alt="${movie.title}"
        />
        <div class="item-desc">
          <p class="rate">
            <img src="/templates/images/star_empty.png" class="star" />
            <span>${movie.vote_average.toFixed(1)}</span>
          </p>
          <strong>${movie.title}</strong>
        </div>
      </div>
    </li>
  `;
}

function renderMovies(movies: Movie[]) {
  movieList.insertAdjacentHTML(
    "beforeend",
    movies.map(createMovieItem).join("")
  );
}

function updateLoadMoreButton() {
  if (currentPage >= totalPages) {
    loadMoreContainer.style.display = "none";
  } else {
    loadMoreContainer.style.display = "block";
  }
}

function showError(message: string) {
  errorContainer.style.display = "block";
  errorMessage.textContent = message;
  loadMoreContainer.style.display = "none";
}

function hideError() {
  errorContainer.style.display = "none";
}

function showNoResult() {
  noResult.style.display = "block";
  loadMoreContainer.style.display = "none";
}

function hideNoResult() {
  noResult.style.display = "none";
}

// --- Header ---
function updateHeader(movie: Movie) {
  topRatedMovieId = movie.id;

  const bannerPath = movie.backdrop_path ?? movie.poster_path;
  if (bannerPath) {
    headerBackground.style.backgroundImage = `url(${BANNER_BASE_URL}${bannerPath})`;
  }

  const rateValue = topRatedMovie.querySelector(".rate-value");
  const titleEl = topRatedMovie.querySelector(".title");

  if (rateValue) rateValue.textContent = movie.vote_average.toFixed(1);
  if (titleEl) titleEl.textContent = movie.title;
}

// --- Data Loading ---
async function loadMovies(page: number, append: boolean = false) {
  if (isLoading) return;
  isLoading = true;

  hideError();
  hideNoResult();

  if (!append) {
    movieList.innerHTML = "";
  }

  showSkeleton();

  try {
    const data = currentQuery
      ? await searchMovies(currentQuery, page)
      : await fetchPopularMovies(page);

    removeSkeleton();

    totalPages = data.total_pages;
    currentPage = data.page;

    if (data.results.length === 0 && !append) {
      showNoResult();
      return;
    }

    renderMovies(data.results);

    if (!append && !currentQuery && data.results.length > 0) {
      updateHeader(data.results[0]);
    }

    updateLoadMoreButton();
  } catch (error) {
    removeSkeleton();
    const msg =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    showError(msg);
  } finally {
    isLoading = false;
  }
}

// --- Search ---
function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  currentQuery = query;
  currentPage = 1;
  sectionTitle.textContent = `"${query}" 검색 결과`;
  loadMovies(1);
}

function resetToPopular() {
  currentQuery = "";
  currentPage = 1;
  sectionTitle.textContent = "지금 인기 있는 영화";
  loadMovies(1);
}

// --- Modal ---
async function openModal(movieId: number) {
  try {
    const movie = await fetchMovieDetail(movieId);

    const posterSrc = movie.poster_path
      ? `${POSTER_ORIGINAL_URL}${movie.poster_path}`
      : "";

    ($("#modalPoster") as HTMLImageElement).src = posterSrc;
    ($("#modalPoster") as HTMLImageElement).alt = movie.title;
    ($("#modalTitle") as HTMLHeadingElement).textContent = movie.title;

    const year = movie.release_date?.slice(0, 4) ?? "";
    const genres = movie.genres?.map((g) => g.name).join(", ") ?? "";
    ($("#modalCategory") as HTMLParagraphElement).textContent =
      `${year} · ${genres}`;

    ($("#modalRate") as HTMLSpanElement).textContent =
      movie.vote_average.toFixed(1);
    ($("#modalDetail") as HTMLParagraphElement).textContent =
      movie.overview || "줄거리 정보가 없습니다.";

    modalBackground.classList.add("active");
    document.body.classList.add("modal-open");
  } catch {
    alert("영화 정보를 불러오는데 실패했습니다.");
  }
}

function closeModalHandler() {
  modalBackground.classList.remove("active");
  document.body.classList.remove("modal-open");
}

// --- Event Listeners ---
searchButton.addEventListener("click", handleSearch);

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSearch();
});

loadMoreButton.addEventListener("click", () => {
  loadMovies(currentPage + 1, true);
});

retryButton.addEventListener("click", () => {
  loadMovies(currentPage, currentPage > 1);
});

movieList.addEventListener("click", (e) => {
  const item = (e.target as HTMLElement).closest<HTMLElement>("[data-movie-id]");
  if (item) {
    const movieId = Number(item.dataset.movieId);
    openModal(movieId);
  }
});

topRatedDetailBtn.addEventListener("click", () => {
  if (topRatedMovieId) openModal(topRatedMovieId);
});

closeModal.addEventListener("click", closeModalHandler);

modalBackground.addEventListener("click", (e) => {
  if (e.target === modalBackground) closeModalHandler();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModalHandler();
});

// Logo click resets to popular
const logo = $(".logo") as HTMLElement;
logo.style.cursor = "pointer";
logo.addEventListener("click", () => {
  searchInput.value = "";
  resetToPopular();
});

// --- Init ---
loadMovies(1);

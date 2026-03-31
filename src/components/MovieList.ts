import { IMAGE_URL, FALLBACK_IMAGE, MOVIES_PER_PAGE } from "../config";
import type { Movie } from "../types";

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

function createMovieItem(movie: Movie): string {
  const posterSrc = movie.poster_path
    ? `${IMAGE_URL.THUMBNAIL}${movie.poster_path}`
    : FALLBACK_IMAGE;

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

export class MovieList {
  private listEl: HTMLUListElement;
  private loadMoreContainer: HTMLDivElement;
  private noResultEl: HTMLParagraphElement;
  private onMovieClick: (movieId: number) => void;

  constructor(
    listEl: HTMLUListElement,
    loadMoreContainer: HTMLDivElement,
    noResultEl: HTMLParagraphElement,
    onMovieClick: (movieId: number) => void
  ) {
    this.listEl = listEl;
    this.loadMoreContainer = loadMoreContainer;
    this.noResultEl = noResultEl;
    this.onMovieClick = onMovieClick;

    this.listEl.addEventListener("click", (e) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-movie-id]"
      );
      if (item) {
        this.onMovieClick(Number(item.dataset.movieId));
      }
    });
  }

  clear() {
    this.listEl.innerHTML = "";
  }

  showSkeleton() {
    this.listEl.insertAdjacentHTML(
      "beforeend",
      createSkeletonItems(MOVIES_PER_PAGE)
    );
  }

  removeSkeleton() {
    this.listEl
      .querySelectorAll(".skeleton-thumbnail")
      .forEach((el) => el.closest("li")?.remove());
  }

  renderMovies(movies: Movie[]) {
    this.listEl.insertAdjacentHTML(
      "beforeend",
      movies.map(createMovieItem).join("")
    );
  }

  updateLoadMoreButton(currentPage: number, totalPages: number) {
    this.loadMoreContainer.style.display =
      currentPage >= totalPages ? "none" : "block";
  }

  showNoResult() {
    this.noResultEl.style.display = "block";
    this.loadMoreContainer.style.display = "none";
  }

  hideNoResult() {
    this.noResultEl.style.display = "none";
  }
}

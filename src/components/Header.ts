import { IMAGE_URL } from "../config";
import type { Movie } from "../types";

export class Header {
  private backgroundEl: HTMLDivElement;
  private rateValueEl: Element | null;
  private titleEl: Element | null;
  private detailBtn: HTMLButtonElement;
  private topRatedMovieId: number | null = null;

  constructor(
    backgroundEl: HTMLDivElement,
    topRatedMovieEl: HTMLDivElement,
    detailBtn: HTMLButtonElement,
    onDetailClick: (movieId: number) => void
  ) {
    this.backgroundEl = backgroundEl;
    this.rateValueEl = topRatedMovieEl.querySelector(".rate-value");
    this.titleEl = topRatedMovieEl.querySelector(".title");
    this.detailBtn = detailBtn;

    this.detailBtn.addEventListener("click", () => {
      if (this.topRatedMovieId) onDetailClick(this.topRatedMovieId);
    });
  }

  update(movie: Movie) {
    this.topRatedMovieId = movie.id;

    const bannerPath = movie.backdrop_path ?? movie.poster_path;
    if (bannerPath) {
      this.backgroundEl.style.backgroundImage = `url(${IMAGE_URL.BANNER}${bannerPath})`;
    }

    if (this.rateValueEl) {
      this.rateValueEl.textContent = movie.vote_average.toFixed(1);
    }
    if (this.titleEl) {
      this.titleEl.textContent = movie.title;
    }
  }
}

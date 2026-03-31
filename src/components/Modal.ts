import { IMAGE_URL } from "../config";
import type { MovieDetail } from "../types";

export class Modal {
  private backgroundEl: HTMLDivElement;
  private posterEl: HTMLImageElement;
  private titleEl: HTMLHeadingElement;
  private categoryEl: HTMLParagraphElement;
  private rateEl: HTMLSpanElement;
  private detailEl: HTMLParagraphElement;

  constructor(backgroundEl: HTMLDivElement) {
    this.backgroundEl = backgroundEl;
    this.posterEl = backgroundEl.querySelector("#modalPoster") as HTMLImageElement;
    this.titleEl = backgroundEl.querySelector("#modalTitle") as HTMLHeadingElement;
    this.categoryEl = backgroundEl.querySelector("#modalCategory") as HTMLParagraphElement;
    this.rateEl = backgroundEl.querySelector("#modalRate") as HTMLSpanElement;
    this.detailEl = backgroundEl.querySelector("#modalDetail") as HTMLParagraphElement;

    const closeBtn = backgroundEl.querySelector("#closeModal") as HTMLButtonElement;
    closeBtn.addEventListener("click", () => this.close());

    backgroundEl.addEventListener("click", (e) => {
      if (e.target === backgroundEl) this.close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.close();
    });
  }

  open(movie: MovieDetail) {
    this.posterEl.src = movie.poster_path
      ? `${IMAGE_URL.ORIGINAL}${movie.poster_path}`
      : "";
    this.posterEl.alt = movie.title;
    this.titleEl.textContent = movie.title;

    const year = movie.release_date?.slice(0, 4) ?? "";
    const genres = movie.genres?.map((g) => g.name).join(", ") ?? "";
    this.categoryEl.textContent = `${year} · ${genres}`;

    this.rateEl.textContent = movie.vote_average.toFixed(1);
    this.detailEl.textContent = movie.overview || "줄거리 정보가 없습니다.";

    this.backgroundEl.classList.add("active");
    document.body.classList.add("modal-open");
  }

  close() {
    this.backgroundEl.classList.remove("active");
    document.body.classList.remove("modal-open");
  }
}

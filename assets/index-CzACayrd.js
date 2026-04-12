(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) return;
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) processPreload(link);
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") continue;
      for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
    }
  }).observe(document, {
    childList: true,
    subtree: true
  });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep) return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
class SearchForm {
  constructor(formElement, inputElement, onSubmit, onEmptyQuery) {
    this.formElement = formElement;
    this.inputElement = inputElement;
    this.onSubmit = onSubmit;
    this.onEmptyQuery = onEmptyQuery;
    this.formElement.addEventListener("submit", this.handleSubmit);
  }
  handleSubmit = async (event) => {
    event.preventDefault();
    const query = this.inputElement.value.trim();
    if (!query) {
      this.onEmptyQuery();
      this.inputElement.focus();
      return;
    }
    await this.onSubmit(query);
  };
  reset() {
    this.inputElement.value = "";
  }
}
const PUBLIC_IMAGE_BASE_URL = "./images/";
const BASE_URL = {
  TMDB_BASE_URL: "https://api.themoviedb.org/3",
  POSTER_BASE_URL: "https://image.tmdb.org/t/p/w200",
  HERO_BASE_URL: "https://image.tmdb.org/t/p/w1920_and_h800_multi_faces",
  MODAL_POSTER_BASE_URL: "https://image.tmdb.org/t/p/w500"
};
const DEFAULT_LANGUAGE = "ko-KR";
const SKELETON_MOVIE_COUNT = 20;
const IMAGE_URL = {
  STAR_IMAGE_URL: `${PUBLIC_IMAGE_BASE_URL}star_empty.png`,
  DEFAULT_THUMBNAIL_IMAGE_URL: `${PUBLIC_IMAGE_BASE_URL}default-thumbnail.jpeg`
};
const API_PATH = {
  POPULAR_MOVIE: `/movie/popular`,
  SEARCH_MOVIE: `/search/movie`,
  MOVIE_DETAIL: (movieId) => `/movie/${movieId}`
};
const PAGE_TITLE = {
  POPULAR: "지금 인기 있는 영화",
  SEARCH: (query) => `"${query}" 검색 결과`
};
class DomainError extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = this.constructor.name;
  }
}
class NetworkError extends DomainError {
}
class ApiError extends DomainError {
  constructor(status, message, cause) {
    super(message, cause);
    this.status = status;
  }
}
class ApiParseError extends DomainError {
}
class EmptyQueryError extends DomainError {
  constructor() {
    super("검색어를 입력해주세요.");
  }
}
class ConfigError extends DomainError {
}
const mapMovieListResponse = (data) => {
  const movies = data.results.map((movie) => {
    return {
      id: movie.id,
      title: movie.title,
      rate: movie.vote_average,
      thumbnail_path: movie.poster_path,
      hero_path: movie.backdrop_path
    };
  });
  return {
    currentPage: data.page ?? 0,
    totalPages: data.total_pages ?? 0,
    results: movies
  };
};
const mapMovieDetailResponse = (data) => {
  return {
    id: data.id,
    title: data.title,
    rate: data.vote_average,
    thumbnail_path: data.poster_path,
    hero_path: data.backdrop_path,
    genres: (data.genres ?? []).map((g) => g.name),
    releaseYear: (data.release_date ?? "").slice(0, 4),
    overview: data.overview ?? ""
  };
};
class TmdbClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    if (!apiKey) {
      throw new ConfigError("VITE_TMDB_API_KEY 환경변수가 설정되지 않았습니다.");
    }
  }
  fetchPopular(page) {
    return this.requestJson(API_PATH.POPULAR_MOVIE, { page }).then(mapMovieListResponse);
  }
  searchMovies(query, page) {
    return this.requestJson(API_PATH.SEARCH_MOVIE, { query, page }).then(mapMovieListResponse);
  }
  fetchMovieDetail(movieId) {
    return this.requestJson(API_PATH.MOVIE_DETAIL(movieId), {}).then(mapMovieDetailResponse);
  }
  async requestJson(path, params) {
    const url = this.buildUrl(path, params);
    let response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${this.apiKey}`
        }
      });
    } catch (cause) {
      throw new NetworkError("네트워크 요청 실패", cause);
    }
    if (!response.ok) {
      throw new ApiError(response.status, `TMDB API ${response.status}`);
    }
    try {
      return await response.json();
    } catch (cause) {
      throw new ApiParseError("응답 JSON 파싱 실패", cause);
    }
  }
  buildUrl(path, params) {
    const url = new URL(`${BASE_URL.TMDB_BASE_URL}${path}`);
    url.searchParams.set("language", DEFAULT_LANGUAGE);
    for (const [key, value] of Object.entries(params)) {
      if (value === void 0 || value === "") {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
    return url;
  }
}
class MovieListStore {
  constructor(client) {
    this.client = client;
  }
  _movies = [];
  _currentPage = 0;
  _totalPages = 0;
  _query = "";
  _isLoading = false;
  _requestToken = 0;
  get movies() {
    return this._movies;
  }
  get currentPage() {
    return this._currentPage;
  }
  get totalPages() {
    return this._totalPages;
  }
  get query() {
    return this._query;
  }
  get isLoading() {
    return this._isLoading;
  }
  get hasMore() {
    return this._currentPage < this._totalPages;
  }
  async loadPopular() {
    this.resetState();
    this._query = "";
    await this.loadNextPage();
  }
  /** 검색 (첫 페이지부터). */
  async search(query) {
    this.resetState();
    this._query = query;
    await this.loadNextPage();
  }
  /** 더보기 / 무한스크롤 공통 다음 페이지 로더. */
  async loadNextPage() {
    if (this._isLoading) return;
    if (this._currentPage >= this._totalPages && this._currentPage !== 0) return;
    const myToken = ++this._requestToken;
    this._isLoading = true;
    try {
      const nextPage = this._currentPage + 1;
      const result = this._query ? await this.client.searchMovies(this._query, nextPage) : await this.client.fetchPopular(nextPage);
      if (myToken !== this._requestToken) return;
      this._movies = [...this._movies, ...result.results];
      this._currentPage = result.currentPage;
      this._totalPages = result.totalPages;
    } finally {
      if (myToken === this._requestToken) {
        this._isLoading = false;
      }
    }
  }
  resetState() {
    this._movies = [];
    this._currentPage = 0;
    this._totalPages = 0;
    this._isLoading = false;
  }
}
const createImageUrl = (baseUrl, imageUrlPath) => {
  return imageUrlPath.length > 0 ? `${baseUrl}${imageUrlPath}` : IMAGE_URL.DEFAULT_THUMBNAIL_IMAGE_URL;
};
const createMovieListItemMarkup = (movie) => {
  const posterImageUrl = createImageUrl(
    BASE_URL.POSTER_BASE_URL,
    movie.thumbnail_path ?? ""
  );
  return (
    /* html */
    `<li>
    <div class="item" data-movie-id="${movie.id}">
      <img class="thumbnail" src="${posterImageUrl}" alt="${movie.title}" />
      <div class="item-desc">
        <p class="rate">
          <img src="${IMAGE_URL.STAR_IMAGE_URL}" class="star" alt="" aria-hidden="true" />
          <span>${movie.rate}</span>
        </p>
        <strong>${movie.title}</strong>
      </div>
    </div>
  </li>`
  );
};
class MovieListView {
  constructor(el, onMovieClick) {
    this.el = el;
    this.onMovieClick = onMovieClick;
    if (this.onMovieClick) {
      this.el.listElement.addEventListener("click", this.handleClick);
    }
  }
  renderMovies(movies) {
    this.el.listElement.innerHTML = movies.map(createMovieListItemMarkup).join("");
  }
  renderSectionTitle(text) {
    this.el.sectionTitle.textContent = text;
  }
  showSkeleton() {
    const skeletonItemMarkup = (
      /* html */
      `<li>
    <div class="item" aria-hidden="true">
      <div class="thumbnail thumbnail-skeleton skeleton"></div>
      <div class="item-desc">
        <p class="rate rate-skeleton">
          <span class="rate-icon-skeleton skeleton"></span>
          <span class="rate-value-skeleton skeleton"></span>
        </p>
        <div class="title-skeleton skeleton"></div>
      </div>
    </div>
  </li>`
    );
    this.el.skeletonElement.innerHTML = Array.from({ length: SKELETON_MOVIE_COUNT }, () => skeletonItemMarkup).join("");
  }
  hideSkeleton() {
    this.el.skeletonElement.innerHTML = "";
  }
  toggleSeeMore(visible) {
    this.el.seeMoreButton.hidden = !visible;
  }
  toggleNoResult(visible) {
    this.el.noResult.hidden = !visible;
  }
  handleClick = (event) => {
    const target = event.target;
    const card = target.closest("[data-movie-id]");
    if (!card) return;
    const id = Number(card.dataset.movieId);
    if (Number.isFinite(id)) this.onMovieClick?.(id);
  };
}
class MovieListController {
  constructor(store, view, hero, notifier, tmdb, modal, ratingRepo) {
    this.store = store;
    this.view = view;
    this.hero = hero;
    this.notifier = notifier;
    this.tmdb = tmdb;
    this.modal = modal;
    this.ratingRepo = ratingRepo;
  }
  async showPopular() {
    this.view.renderSectionTitle(PAGE_TITLE.POPULAR);
    await this.runWithUi(() => this.store.loadPopular());
    if (this.store.movies[0]) {
      this.hero.update(this.store.movies[0]);
      this.hero.show();
    }
  }
  async search(query) {
    this.hero.hide();
    this.view.renderSectionTitle(PAGE_TITLE.SEARCH(query));
    await this.runWithUi(() => this.store.search(query));
  }
  // 더보기 버튼이건 무한스크롤 방식이건 대응 가능
  async loadMore() {
    await this.runWithUi(() => this.store.loadNextPage());
  }
  async openDetail(movieId) {
    try {
      const detail = await this.tmdb.fetchMovieDetail(movieId);
      const currentRating = this.ratingRepo.getRating(movieId);
      this.modal.open(detail, currentRating);
    } catch (error) {
      this.notifier.error(error);
    }
  }
  async runWithUi(action) {
    this.view.showSkeleton();
    try {
      await action();
      this.view.renderMovies(this.store.movies);
      this.view.toggleSeeMore(this.store.hasMore);
      this.view.toggleNoResult(
        this.store.query !== "" && this.store.movies.length === 0
      );
    } catch (error) {
      this.notifier.error(error);
    } finally {
      this.view.hideSkeleton();
    }
  }
}
class HeroSection {
  constructor(el) {
    this.el = el;
  }
  update(movie) {
    const posterImageUrl = createImageUrl(BASE_URL.HERO_BASE_URL, movie.hero_path ?? "");
    this.el.backdrop.style.backgroundImage = posterImageUrl ? `url("${posterImageUrl}")` : "";
    this.el.rate.hidden = false;
    this.el.rateValue.textContent = String(movie.rate);
    this.el.title.textContent = movie.title;
  }
  show() {
    this.el.section.hidden = false;
    this.el.siteHeader.classList.add("site-header--overlay");
  }
  hide() {
    this.el.section.hidden = true;
    this.el.siteHeader.classList.remove("site-header--overlay");
  }
}
const $ = (selector) => {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`${selector} 요소를 찾을 수 없습니다`);
  }
  return element;
};
const queryAppShell = () => ({
  movieList: $(".thumbnail-list"),
  siteHeader: $(".site-header"),
  searchForm: $("#search-form"),
  searchInput: $("#search-input"),
  noResult: $(".no-result"),
  movieSectionTitle: $(".movie-section-title"),
  heroSection: $("#hero-section"),
  heroBackdrop: $("#hero-backdrop"),
  heroRate: $("#hero-rate"),
  heroRateValue: $("#hero-rate-value"),
  heroTitle: $("#hero-title"),
  skeletonCard: $(".skeleton-card"),
  seeMoreBtn: $("#see-more-btn"),
  // 모달
  modalBackground: $("#modalBackground"),
  closeModal: $("#closeModal"),
  modalPoster: $("#modal-poster"),
  modalTitle: $("#modal-title"),
  modalCategory: $("#modal-category"),
  modalRateValue: $("#modal-rate-value"),
  modalDetail: $("#modal-detail"),
  myRatingStars: $("#my-rating-stars"),
  myRatingLabel: $("#my-rating-label")
});
function t(t2, e2) {
  if (!(t2 instanceof e2)) {
    throw new TypeError("Cannot call a class as a function");
  }
}
function e(t2, e2) {
  for (var s2 = 0; s2 < e2.length; s2++) {
    var i2 = e2[s2];
    i2.enumerable = i2.enumerable || false;
    i2.configurable = true;
    if ("value" in i2) i2.writable = true;
    Object.defineProperty(t2, i2.key, i2);
  }
}
function s(t2, s2, i2) {
  if (s2) e(t2.prototype, s2);
  return t2;
}
var i = Object.defineProperty;
var n = function(t2, e2) {
  return i(t2, "name", { value: e2, configurable: true });
};
var o = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">\r\n  <path d="m8.94 8 4.2-4.193a.67.67 0 0 0-.947-.947L8 7.06l-4.193-4.2a.67.67 0 1 0-.947.947L7.06 8l-4.2 4.193a.667.667 0 0 0 .217 1.093.666.666 0 0 0 .73-.146L8 8.94l4.193 4.2a.666.666 0 0 0 1.094-.217.665.665 0 0 0-.147-.73L8.94 8Z" fill="currentColor"/>\r\n</svg>\r\n';
var a = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">\r\n  <path d="M16 2.667a13.333 13.333 0 1 0 0 26.666 13.333 13.333 0 0 0 0-26.666Zm0 24A10.667 10.667 0 0 1 5.333 16a10.56 10.56 0 0 1 2.254-6.533l14.946 14.946A10.56 10.56 0 0 1 16 26.667Zm8.413-4.134L9.467 7.587A10.56 10.56 0 0 1 16 5.333 10.667 10.667 0 0 1 26.667 16a10.56 10.56 0 0 1-2.254 6.533Z" fill="currentColor"/>\r\n</svg>\r\n';
var r = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">\r\n  <path d="M16 14.667A1.333 1.333 0 0 0 14.667 16v5.333a1.333 1.333 0 0 0 2.666 0V16A1.333 1.333 0 0 0 16 14.667Zm.507-5.227a1.333 1.333 0 0 0-1.014 0 1.334 1.334 0 0 0-.44.28 1.56 1.56 0 0 0-.28.44c-.075.158-.11.332-.106.507a1.332 1.332 0 0 0 .386.946c.13.118.279.213.44.28a1.334 1.334 0 0 0 1.84-1.226 1.4 1.4 0 0 0-.386-.947 1.334 1.334 0 0 0-.44-.28ZM16 2.667a13.333 13.333 0 1 0 0 26.666 13.333 13.333 0 0 0 0-26.666Zm0 24a10.666 10.666 0 1 1 0-21.333 10.666 10.666 0 0 1 0 21.333Z" fill="currentColor"/>\r\n</svg>\r\n';
var c = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">\r\n  <path d="m19.627 11.72-5.72 5.733-2.2-2.2a1.334 1.334 0 1 0-1.88 1.881l3.133 3.146a1.333 1.333 0 0 0 1.88 0l6.667-6.667a1.333 1.333 0 1 0-1.88-1.893ZM16 2.667a13.333 13.333 0 1 0 0 26.666 13.333 13.333 0 0 0 0-26.666Zm0 24a10.666 10.666 0 1 1 0-21.333 10.666 10.666 0 0 1 0 21.333Z" fill="currentColor"/>\r\n</svg>\r\n';
var l = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">\r\n  <path d="M16.334 17.667a1.334 1.334 0 0 0 1.334-1.333v-5.333a1.333 1.333 0 0 0-2.665 0v5.333a1.333 1.333 0 0 0 1.33 1.333Zm-.508 5.227c.325.134.69.134 1.014 0 .165-.064.314-.159.44-.28a1.56 1.56 0 0 0 .28-.44c.076-.158.112-.332.107-.507a1.332 1.332 0 0 0-.387-.946 1.532 1.532 0 0 0-.44-.28 1.334 1.334 0 0 0-1.838 1.226 1.4 1.4 0 0 0 .385.947c.127.121.277.216.44.28Zm.508 6.773a13.333 13.333 0 1 0 0-26.667 13.333 13.333 0 0 0 0 26.667Zm0-24A10.667 10.667 0 1 1 16.54 27a10.667 10.667 0 0 1-.206-21.333Z" fill="currentColor"/>\r\n</svg>\r\n';
var h = n(function(t2) {
  return new DOMParser().parseFromString(t2, "text/html").body.childNodes[0];
}, "stringToHTML"), d = n(function(t2) {
  var e2 = new DOMParser().parseFromString(t2, "application/xml");
  return document.importNode(e2.documentElement, true).outerHTML;
}, "getSvgNode");
var u = { CONTAINER: "sn-notifications-container", NOTIFY: "sn-notify", NOTIFY_CONTENT: "sn-notify-content", NOTIFY_ICON: "sn-notify-icon", NOTIFY_CLOSE: "sn-notify-close", NOTIFY_TITLE: "sn-notify-title", NOTIFY_TEXT: "sn-notify-text", IS_X_CENTER: "sn-is-x-center", IS_Y_CENTER: "sn-is-y-center", IS_CENTER: "sn-is-center", IS_LEFT: "sn-is-left", IS_RIGHT: "sn-is-right", IS_TOP: "sn-is-top", IS_BOTTOM: "sn-is-bottom", NOTIFY_OUTLINE: "sn-notify-outline", NOTIFY_FILLED: "sn-notify-filled", NOTIFY_ERROR: "sn-notify-error", NOTIFY_WARNING: "sn-notify-warning", NOTIFY_SUCCESS: "sn-notify-success", NOTIFY_INFO: "sn-notify-info", NOTIFY_FADE: "sn-notify-fade", NOTIFY_FADE_IN: "sn-notify-fade-in", NOTIFY_SLIDE: "sn-notify-slide", NOTIFY_SLIDE_IN: "sn-notify-slide-in", NOTIFY_AUTOCLOSE: "sn-notify-autoclose" }, f = { ERROR: "error", WARNING: "warning", SUCCESS: "success", INFO: "info" }, p = { OUTLINE: "outline", FILLED: "filled" }, I = { FADE: "fade", SLIDE: "slide" }, v = { CLOSE: d(o), SUCCESS: d(c), ERROR: d(a), WARNING: d(l), INFO: d(r) };
var N = n(function(t2) {
  t2.wrapper.classList.add(u.NOTIFY_FADE), setTimeout(function() {
    t2.wrapper.classList.add(u.NOTIFY_FADE_IN);
  }, 100);
}, "fadeIn"), O = n(function(t2) {
  t2.wrapper.classList.remove(u.NOTIFY_FADE_IN), setTimeout(function() {
    t2.wrapper.remove();
  }, t2.speed);
}, "fadeOut"), T = n(function(t2) {
  t2.wrapper.classList.add(u.NOTIFY_SLIDE), setTimeout(function() {
    t2.wrapper.classList.add(u.NOTIFY_SLIDE_IN);
  }, 100);
}, "slideIn"), E = n(function(t2) {
  t2.wrapper.classList.remove(u.NOTIFY_SLIDE_IN), setTimeout(function() {
    t2.wrapper.remove();
  }, t2.speed);
}, "slideOut");
var m = (function() {
  function e2(s2) {
    var i2 = this;
    t(this, e2);
    this.notifyOut = n(function(t2) {
      t2(i2);
    }, "notifyOut");
    var o2 = s2.notificationsGap, a2 = o2 === void 0 ? 20 : o2, r2 = s2.notificationsPadding, c2 = r2 === void 0 ? 20 : r2, l2 = s2.status, h2 = l2 === void 0 ? "success" : l2, d2 = s2.effect, u2 = d2 === void 0 ? I.FADE : d2, f2 = s2.type, p2 = f2 === void 0 ? "outline" : f2, v2 = s2.title, N2 = s2.text, O2 = s2.showIcon, T2 = O2 === void 0 ? true : O2, E2 = s2.customIcon, m2 = E2 === void 0 ? "" : E2, w2 = s2.customClass, y = w2 === void 0 ? "" : w2, L = s2.speed, C = L === void 0 ? 500 : L, F = s2.showCloseButton, _ = F === void 0 ? true : F, S = s2.autoclose, g = S === void 0 ? true : S, R = s2.autotimeout, Y = R === void 0 ? 3e3 : R, x = s2.position, A = x === void 0 ? "right top" : x, b = s2.customWrapper, k = b === void 0 ? "" : b;
    if (this.customWrapper = k, this.status = h2, this.title = v2, this.text = N2, this.showIcon = T2, this.customIcon = m2, this.customClass = y, this.speed = C, this.effect = u2, this.showCloseButton = _, this.autoclose = g, this.autotimeout = Y, this.notificationsGap = a2, this.notificationsPadding = c2, this.type = p2, this.position = A, !this.checkRequirements()) {
      console.error("You must specify 'title' or 'text' at least.");
      return;
    }
    this.setContainer(), this.setWrapper(), this.setPosition(), this.showIcon && this.setIcon(), this.showCloseButton && this.setCloseButton(), this.setContent(), this.container.prepend(this.wrapper), this.setEffect(), this.notifyIn(this.selectedNotifyInEffect), this.autoclose && this.autoClose(), this.setObserver();
  }
  s(e2, [{ key: "checkRequirements", value: function t2() {
    return !!(this.title || this.text);
  } }, { key: "setContainer", value: function t2() {
    var t3 = document.querySelector(".".concat(u.CONTAINER));
    t3 ? this.container = t3 : (this.container = document.createElement("div"), this.container.classList.add(u.CONTAINER), document.body.appendChild(this.container)), this.notificationsPadding && this.container.style.setProperty("--sn-notifications-padding", "".concat(this.notificationsPadding, "px")), this.notificationsGap && this.container.style.setProperty("--sn-notifications-gap", "".concat(this.notificationsGap, "px"));
  } }, { key: "setPosition", value: function t2() {
    this.container.classList[this.position === "center" ? "add" : "remove"](u.IS_CENTER), this.container.classList[this.position.includes("left") ? "add" : "remove"](u.IS_LEFT), this.container.classList[this.position.includes("right") ? "add" : "remove"](u.IS_RIGHT), this.container.classList[this.position.includes("top") ? "add" : "remove"](u.IS_TOP), this.container.classList[this.position.includes("bottom") ? "add" : "remove"](u.IS_BOTTOM), this.container.classList[this.position.includes("x-center") ? "add" : "remove"](u.IS_X_CENTER), this.container.classList[this.position.includes("y-center") ? "add" : "remove"](u.IS_Y_CENTER);
  } }, { key: "setCloseButton", value: function t2() {
    var t3 = this;
    var e3 = document.createElement("div");
    e3.classList.add(u.NOTIFY_CLOSE), e3.innerHTML = v.CLOSE, this.wrapper.appendChild(e3), e3.addEventListener("click", function() {
      t3.close();
    });
  } }, { key: "setWrapper", value: function t2() {
    var t3 = this;
    switch (this.customWrapper ? this.wrapper = h(this.customWrapper) : this.wrapper = document.createElement("div"), this.wrapper.style.setProperty("--sn-notify-transition-duration", "".concat(this.speed, "ms")), this.wrapper.classList.add(u.NOTIFY), this.type) {
      case p.OUTLINE:
        this.wrapper.classList.add(u.NOTIFY_OUTLINE);
        break;
      case p.FILLED:
        this.wrapper.classList.add(u.NOTIFY_FILLED);
        break;
      default:
        this.wrapper.classList.add(u.NOTIFY_OUTLINE);
    }
    switch (this.status) {
      case f.SUCCESS:
        this.wrapper.classList.add(u.NOTIFY_SUCCESS);
        break;
      case f.ERROR:
        this.wrapper.classList.add(u.NOTIFY_ERROR);
        break;
      case f.WARNING:
        this.wrapper.classList.add(u.NOTIFY_WARNING);
        break;
      case f.INFO:
        this.wrapper.classList.add(u.NOTIFY_INFO);
        break;
    }
    this.autoclose && (this.wrapper.classList.add(u.NOTIFY_AUTOCLOSE), this.wrapper.style.setProperty("--sn-notify-autoclose-timeout", "".concat(this.autotimeout + this.speed, "ms"))), this.customClass && this.customClass.split(" ").forEach(function(e3) {
      t3.wrapper.classList.add(e3);
    });
  } }, { key: "setContent", value: function t2() {
    var t3 = document.createElement("div");
    t3.classList.add(u.NOTIFY_CONTENT);
    var e3, s2;
    this.title && (e3 = document.createElement("div"), e3.classList.add(u.NOTIFY_TITLE), e3.textContent = this.title.trim(), this.showCloseButton || (e3.style.paddingRight = "0")), this.text && (s2 = document.createElement("div"), s2.classList.add(u.NOTIFY_TEXT), s2.innerHTML = this.text.trim(), this.title || (s2.style.marginTop = "0")), this.wrapper.appendChild(t3), this.title && t3.appendChild(e3), this.text && t3.appendChild(s2);
  } }, { key: "setIcon", value: function t2() {
    var t3 = n(function(t4) {
      switch (t4) {
        case f.SUCCESS:
          return v.SUCCESS;
        case f.ERROR:
          return v.ERROR;
        case f.WARNING:
          return v.WARNING;
        case f.INFO:
          return v.INFO;
      }
    }, "computedIcon"), e3 = document.createElement("div");
    e3.classList.add(u.NOTIFY_ICON), e3.innerHTML = this.customIcon || t3(this.status), (this.status || this.customIcon) && this.wrapper.appendChild(e3);
  } }, { key: "setObserver", value: function t2() {
    var t3 = this;
    var e3 = new IntersectionObserver(function(e4) {
      if (e4[0].intersectionRatio <= 0) t3.close();
      else return;
    }, { threshold: 0 });
    setTimeout(function() {
      e3.observe(t3.wrapper);
    }, this.speed);
  } }, { key: "notifyIn", value: function t2(t2) {
    t2(this);
  } }, { key: "autoClose", value: function t2() {
    var t3 = this;
    setTimeout(function() {
      t3.close();
    }, this.autotimeout + this.speed);
  } }, { key: "close", value: function t2() {
    this.notifyOut(this.selectedNotifyOutEffect);
  } }, { key: "setEffect", value: function t2() {
    switch (this.effect) {
      case I.FADE:
        this.selectedNotifyInEffect = N, this.selectedNotifyOutEffect = O;
        break;
      case I.SLIDE:
        this.selectedNotifyInEffect = T, this.selectedNotifyOutEffect = E;
        break;
      default:
        this.selectedNotifyInEffect = N, this.selectedNotifyOutEffect = O;
    }
  } }]);
  return e2;
})();
n(m, "Notify");
var w = m;
globalThis.Notify = w;
const errorToUserMessage = (error) => {
  if (error instanceof EmptyQueryError) return error.message;
  if (error instanceof NetworkError) {
    return "네트워크 연결을 확인해주세요.";
  }
  if (error instanceof ApiError) {
    if (error.status === 401) return "API 인증에 실패했습니다. 관리자에게 문의해주세요.";
    if (error.status === 404) return "요청한 정보를 찾을 수 없습니다.";
    if (error.status >= 500) return "서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
    return "영화 정보를 불러오지 못했습니다.";
  }
  if (error instanceof ApiParseError) {
    return "응답을 해석하지 못했습니다. 잠시 후 다시 시도해주세요.";
  }
  if (error instanceof ConfigError) {
    return "앱 설정에 문제가 있습니다. 관리자에게 문의해주세요.";
  }
  if (error instanceof DomainError) return error.message;
  console.error("[unhandled]", error);
  return "알 수 없는 오류가 발생했습니다.";
};
class Notifier {
  /** unknown error 를 받아 사용자 메시지로 변환 후 에러 토스트. */
  error(error) {
    this.show("error", "오류가 발생했습니다", errorToUserMessage(error));
  }
  /** 빈 검색어 등 경고성 알림. */
  warn(title, text) {
    this.show("warning", title, text);
  }
  show(status, title, text) {
    new w({
      status,
      title,
      text,
      effect: "fade",
      speed: 300,
      showCloseButton: true,
      autoclose: true,
      autotimeout: 3e3,
      type: "outline",
      position: "right top"
    });
  }
}
const STORAGE_KEY = "movie-ratings";
class LocalStorageRatingRepo {
  getRating(movieId) {
    const ratings = this.loadAll();
    return ratings[movieId] ?? null;
  }
  saveRating(movieId, score) {
    const ratings = this.loadAll();
    ratings[movieId] = score;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
  }
  loadAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    } catch {
      return {};
    }
  }
}
const RATING_LABELS = {
  2: "최악이예요",
  4: "별로예요",
  6: "보통이에요",
  8: "재미있어요",
  10: "명작이에요"
};
class StarRating {
  constructor(container, label, onRate) {
    this.container = container;
    this.label = label;
    this.onRate = onRate;
    this.render();
    this.container.addEventListener("click", this.handleClick);
  }
  score = 0;
  setScore(score) {
    this.score = score;
    this.render();
  }
  render() {
    const stars = Array.from({ length: 5 }, (_, i2) => {
      const starScore = (i2 + 1) * 2;
      const filled = starScore <= this.score;
      const src = filled ? "./images/star_filled.png" : "./images/star_empty.png";
      return `<img src="${src}" class="star-rating-star" data-score="${starScore}" alt="${i2 + 1}점" />`;
    }).join("");
    this.container.innerHTML = stars;
    if (this.score > 0) {
      this.label.textContent = `${RATING_LABELS[this.score]} (${this.score}/10)`;
    } else {
      this.label.textContent = "";
    }
  }
  handleClick = (event) => {
    const target = event.target;
    if (!target.matches(".star-rating-star")) return;
    const score = Number(target.dataset.score);
    if (!score) return;
    this.score = score;
    this.render();
    this.onRate(score);
  };
}
class MovieDetailModal {
  constructor(el, onRate) {
    this.el = el;
    this.onRate = onRate;
    this.starRating = new StarRating(
      el.myRatingStars,
      el.myRatingLabel,
      (score) => this.onRate(this.currentMovieId, score)
    );
    el.closeButton.addEventListener("click", () => this.close());
    el.background.addEventListener("click", (e2) => {
      if (e2.target === el.background) this.close();
    });
    document.addEventListener("keydown", (e2) => {
      if (e2.key === "Escape" && this.isOpen()) this.close();
    });
  }
  currentMovieId = 0;
  starRating;
  open(detail, currentRating) {
    this.currentMovieId = detail.id;
    this.el.poster.src = detail.thumbnail_path ? `${BASE_URL.MODAL_POSTER_BASE_URL}${detail.thumbnail_path}` : IMAGE_URL.DEFAULT_THUMBNAIL_IMAGE_URL;
    this.el.poster.alt = detail.title;
    this.el.title.textContent = detail.title;
    this.el.category.textContent = `${detail.releaseYear} · ${detail.genres.join(", ")}`;
    this.el.rateValue.textContent = `${detail.rate}`;
    this.el.detail.textContent = detail.overview;
    this.starRating.setScore(currentRating ?? 0);
    this.el.background.classList.add("active");
    document.body.classList.add("modal-open");
  }
  close() {
    this.el.background.classList.remove("active");
    document.body.classList.remove("modal-open");
  }
  isOpen() {
    return this.el.background.classList.contains("active");
  }
}
const main = async () => {
  const elements = queryAppShell();
  const notifier = new Notifier();
  const tmdb = new TmdbClient("eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJhZDFmZTJkZjEwZDNhMTIxNmY5YzhjYzA5MDdlYzc3NyIsIm5iZiI6MTc3NDg1MDk4MS4zNTMsInN1YiI6IjY5Y2ExM2E1YjQwNDUwOTdmZjczMmNjZSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.pMlpwW3109kLfNMg6nIZBC8HdNQ26wK4qQNKO_dV0Dk");
  const movieListStore = new MovieListStore(tmdb);
  const ratingRepo = new LocalStorageRatingRepo();
  const modal = new MovieDetailModal(
    {
      background: elements.modalBackground,
      closeButton: elements.closeModal,
      poster: elements.modalPoster,
      title: elements.modalTitle,
      category: elements.modalCategory,
      rateValue: elements.modalRateValue,
      detail: elements.modalDetail,
      myRatingStars: elements.myRatingStars,
      myRatingLabel: elements.myRatingLabel
    },
    (movieId, score) => ratingRepo.saveRating(movieId, score)
  );
  let controller;
  const movieListView = new MovieListView(
    {
      listElement: elements.movieList,
      skeletonElement: elements.skeletonCard,
      seeMoreButton: elements.seeMoreBtn,
      sectionTitle: elements.movieSectionTitle,
      noResult: elements.noResult
    },
    (movieId) => controller.openDetail(movieId)
  );
  const heroSection = new HeroSection({
    section: elements.heroSection,
    siteHeader: elements.siteHeader,
    backdrop: elements.heroBackdrop,
    title: elements.heroTitle,
    rate: elements.heroRate,
    rateValue: elements.heroRateValue
  });
  controller = new MovieListController(
    movieListStore,
    movieListView,
    heroSection,
    notifier,
    tmdb,
    modal,
    ratingRepo
  );
  new SearchForm(
    elements.searchForm,
    elements.searchInput,
    async (query) => {
      await controller.search(query);
    },
    () => {
      notifier.warn(
        "검색어를 입력해주세요",
        "영화 제목을 입력한 뒤 다시 시도해주세요."
      );
    }
  );
  elements.seeMoreBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    await controller.loadMore();
  });
  await controller.showPopular();
};
window.addEventListener("load", () => {
  void main().catch((error) => console.error("[bootstrap failed]", error));
});

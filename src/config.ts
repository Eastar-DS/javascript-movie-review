export const API_BASE_URL = "https://api.themoviedb.org/3";

export const IMAGE_URL = {
  THUMBNAIL: "https://media.themoviedb.org/t/p/w440_and_h660_face",
  BANNER: "https://image.tmdb.org/t/p/w1920_and_h800_multi_faces",
  ORIGINAL: "https://image.tmdb.org/t/p/original",
} as const;

export const FALLBACK_IMAGE = "/templates/images/star_empty.png";

export const MOVIES_PER_PAGE = 20;

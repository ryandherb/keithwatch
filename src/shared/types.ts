/**
 * Types shared by the client and the server (API request/response shapes).
 */

/**
 * One row of an ani-cli search. ani-cli identifies results by their 1-based
 * position for a given query, so `index` + the original query is how you refer
 * to this anime in later requests (episodes, links).
 */
export interface SearchResult {
  index: number;
  title: string;
  image?: string; 
}

export type TranslationMode = "sub" | "dub";

export interface StreamLinks {
  /** Every quality ani-cli found, best first. `quality` is the height, e.g. "1080". */
  links: { quality: string; url: string }[];
  /** The link matching the requested quality. */
  selected: string;
  /** English subtitle track (.vtt), if any. */
  subtitles: string | null;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

export interface EpisodesResponse {
  episodes: string[];
}

export type LinksResponse = StreamLinks;

export interface ApiError {
  error: string;
}

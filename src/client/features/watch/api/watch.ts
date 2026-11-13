/**
 * Client-side wrappers for GET /api/episodes and GET /api/links.
 * An anime is referred to by the search query + its result index.
 */
import type { EpisodesResponse, LinksResponse, TranslationMode } from "@shared/types";
import { getJson } from "@/lib/api";

export async function getEpisodes(
  query: string,
  index: number,
  mode: TranslationMode = "sub",
  signal?: AbortSignal,
): Promise<string[]> {
  const data = await getJson<EpisodesResponse>("/api/episodes", { q: query, index, mode }, signal);
  return data.episodes;
}

export async function getStreamLinks(
  query: string,
  index: number,
  episode: string,
  options: { mode?: TranslationMode; quality?: string; signal?: AbortSignal } = {},
): Promise<LinksResponse> {
  const { mode = "sub", quality, signal } = options;
  return getJson<LinksResponse>("/api/links", { q: query, index, episode, mode, quality }, signal);
}

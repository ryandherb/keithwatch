/**
 * Client-side wrapper for GET /api/search.
 */
import type { SearchResponse, SearchResult } from "@shared/types";
import { getJson } from "@/lib/api";

export async function searchAnime(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const data = await getJson<SearchResponse>("/api/search", { q: query }, signal);
  return data.results;
}

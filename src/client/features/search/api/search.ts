/**
 * Client-side wrapper for GET /api/search, plus cover art from AniList.
 */
import type { SearchResponse, SearchResult } from "@shared/types";
import { getJson } from "@/lib/api";

export async function searchAnime(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const data = await getJson<SearchResponse>("/api/search", { q: query }, signal);
  const covers = await fetchCoverImages(
    data.results.map((r) => r.title),
    signal,
  ).catch((err) => {
    if (signal?.aborted) throw err;
    // Covers are cosmetic: show the results without them rather than failing.
    console.warn("Couldn't load cover images:", err);
    return new Map<string, string>();
  });
  return data.results.map((r) => ({ ...r, image: covers.get(r.title) ?? r.image }));
}

// ---------------------------------------------------------------------------
// AniList cover images
//
// AniList's GraphQL API is free and needs no key, but it's rate limited
// (currently 30 requests/minute). Instead of one request per title, we put many
// title searches into a single query using GraphQL aliases:
//
//   query($s0: String, $s1: String) {
//     a0: Page(perPage: 1) { media(search: $s0, type: ANIME) { ... } }
//     a1: Page(perPage: 1) { media(search: $s1, type: ANIME) { ... } }
//   }
//
// `Page { media }` is used instead of `Media(search:)` because a single
// `Media` miss makes AniList 404 the whole query, while `Page` just returns an
// empty list for that alias.
// ---------------------------------------------------------------------------

const ANILIST_URL = "https://graphql.anilist.co";
/** Titles per request. AniList accepts at least 100; 50 keeps queries modest. */
const BATCH_SIZE = 50;

/** Session cache, keyed by cleaned title. `null` = AniList has no match. */
const coverCache = new Map<string, string | null>();

/** Returns a map of original title -> cover image URL (titles without a match are omitted). */
export async function fetchCoverImages(
  titles: string[],
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const cleaned = new Map(titles.map((t) => [t, cleanTitle(t)]));
  const missing = [...new Set(cleaned.values())].filter((t) => t && !coverCache.has(t));

  const batches: string[][] = [];
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    batches.push(missing.slice(i, i + BATCH_SIZE));
  }
  await Promise.all(batches.map((batch) => fetchBatch(batch, signal)));

  const result = new Map<string, string>();
  for (const [original, clean] of cleaned) {
    const url = coverCache.get(clean);
    if (url) result.set(original, url);
  }
  return result;
}

interface AniListResponse {
  data?: Record<string, { media: { coverImage: { large: string | null } }[] } | null>;
  errors?: { message: string }[];
}

async function fetchBatch(titles: string[], signal?: AbortSignal): Promise<void> {
  const vars = titles.map((_, i) => `$s${i}: String`).join(", ");
  const fields = titles
    .map(
      (_, i) =>
        `a${i}: Page(perPage: 1) { media(search: $s${i}, type: ANIME, sort: SEARCH_MATCH) { coverImage { large } } }`,
    )
    .join("\n");
  const variables = Object.fromEntries(titles.map((t, i) => [`s${i}`, t]));

  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: `query(${vars}) {\n${fields}\n}`, variables }),
    signal,
  });
  if (!res.ok) throw new Error(`AniList request failed (HTTP ${res.status})`);

  const body = (await res.json()) as AniListResponse;
  if (!body.data) throw new Error(body.errors?.[0]?.message ?? "AniList returned no data");

  titles.forEach((title, i) => {
    coverCache.set(title, body.data![`a${i}`]?.media[0]?.coverImage.large ?? null);
  });
}

/** Drops ani-cli's "(12 episodes)" suffix so the title matches AniList's search. */
function cleanTitle(title: string): string {
  return title.replace(/\s*\(\d+\s+episodes?\)\s*$/i, "").trim();
}

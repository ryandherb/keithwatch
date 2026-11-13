/**
 * HTTP handlers for the anime endpoints. These only translate between HTTP and
 * the functions in ../ani-cli.ts; they never run commands themselves.
 *
 *   GET /api/search?q=<query>
 *   GET /api/episodes?q=<query>&index=<n>[&mode=dub]
 *   GET /api/links?q=<query>&index=<n>&episode=<ep>[&mode=dub][&quality=720]
 */
import type {
  ApiError,
  EpisodesResponse,
  LinksResponse,
  SearchResponse,
  TranslationMode,
} from "@shared/types";
import * as aniCli from "../ani-cli";

export const handleSearch = handler(async (params, signal) => {
  const query = params.get("q") ?? "";
  const results = await aniCli.search(query, signal);
  return { query, results } satisfies SearchResponse;
});

export const handleEpisodes = handler(async (params, signal) => {
  const episodes = await aniCli.episodes(params.get("q") ?? "", Number(params.get("index")), {
    mode: modeParam(params),
    signal,
  });
  return { episodes } satisfies EpisodesResponse;
});

export const handleLinks = handler(async (params, signal) => {
  return (await aniCli.streamLinks(
    params.get("q") ?? "",
    Number(params.get("index")),
    params.get("episode") ?? "",
    { mode: modeParam(params), quality: params.get("quality") ?? undefined, signal },
  )) satisfies LinksResponse;
});

function modeParam(params: URLSearchParams): TranslationMode {
  return params.get("mode") === "dub" ? "dub" : "sub";
}

/** Wraps a handler: passes query params + abort signal, turns errors into JSON. */
function handler(fn: (params: URLSearchParams, signal: AbortSignal) => Promise<unknown>) {
  return async (req: Request): Promise<Response> => {
    try {
      return Response.json(await fn(new URL(req.url).searchParams, req.signal));
    } catch (err) {
      const status = err instanceof aniCli.AniCliError ? err.status : 500;
      if (status >= 500) console.error(`${req.method} ${req.url} failed:`, err);
      const message = err instanceof Error ? err.message : String(err);
      return Response.json({ error: message } satisfies ApiError, { status });
    }
  };
}

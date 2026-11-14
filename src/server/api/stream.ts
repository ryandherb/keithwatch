/**
 * Stream proxy:
 *
 *   GET /api/stream?url=<encoded upstream URL>
 *
 * The stream host answers 403 unless requests carry the Referer ani-cli
 * found, and browsers can't set Referer. So the player loads everything
 * (playlists, segments, subtitles) through here and we add the header.
 *
 * HLS playlists list further URLs (variants, segments, keys); those get
 * rewritten to point back through this proxy too.
 *
 * To keep this from being an open proxy, only hosts we've been told about are
 * allowed: hosts from ani-cli's stream links (via `proxyUrl`) and hosts
 * listed inside playlists we've already proxied. Each allowed host remembers
 * the Referer to send.
 */

/** How long a host stays allowed after we last saw it in links or a playlist. */
const HOST_TTL_MS = 6 * 60 * 60 * 1000;

const allowedHosts = new Map<string, { referer: string | null; expires: number }>();

function allowHost(url: URL, referer: string | null) {
  allowedHosts.set(url.host, { referer, expires: Date.now() + HOST_TTL_MS });
}

function lookupHost(url: URL) {
  const entry = allowedHosts.get(url.host);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    allowedHosts.delete(url.host);
    return null;
  }
  return entry;
}

/**
 * Allows `url`'s host and returns the proxied path to hand to the browser.
 * Call this for every URL from ani-cli that the player will load.
 */
export function proxyUrl(url: string, referer: string | null): string {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Refusing to proxy ${parsed.protocol} URL`);
  }
  allowHost(parsed, referer);
  return toProxyPath(parsed);
}

function toProxyPath(url: URL): string {
  return `/api/stream?url=${encodeURIComponent(url.href)}`;
}

/** Response headers worth passing on. Length/encoding are left to Bun, since fetch decompresses. */
const FORWARD_HEADERS = ["content-type", "content-range", "accept-ranges", "cache-control", "last-modified"];

export async function handleStream(req: Request): Promise<Response> {
  let upstream: URL;
  try {
    upstream = new URL(new URL(req.url).searchParams.get("url") ?? "");
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  const entry = (upstream.protocol === "https:" || upstream.protocol === "http:") && lookupHost(upstream);
  if (!entry) return new Response("Host not allowed", { status: 403 });

  const headers: Record<string, string> = {};
  if (entry.referer) headers.Referer = entry.referer;
  // Forward Range so seeking in non-HLS (mp4) streams works.
  const range = req.headers.get("range");
  if (range) headers.Range = range;

  let res: Response;
  try {
    res = await fetch(upstream, { headers, signal: req.signal });
  } catch (err) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    console.error(`stream proxy: fetching ${upstream.host} failed:`, err);
    return new Response("Upstream fetch failed", { status: 502 });
  }

  const contentType = res.headers.get("content-type") ?? "";
  const isPlaylist = /mpegurl/i.test(contentType) || upstream.pathname.endsWith(".m3u8");

  if (!isPlaylist || !res.ok) {
    const out = new Headers();
    for (const name of FORWARD_HEADERS) {
      const value = res.headers.get(name);
      if (value) out.set(name, value);
    }
    return new Response(res.body, { status: res.status, headers: out });
  }

  // Resolve relative URIs against the final URL, in case of redirects.
  const base = new URL(res.url || upstream.href);
  const rewrite = (uri: string) => {
    const target = new URL(uri, base);
    allowHost(target, entry.referer);
    return toProxyPath(target);
  };

  const body = (await res.text())
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      // Plain lines are variant playlists or segments.
      if (!trimmed.startsWith("#")) return rewrite(trimmed);
      // Tags like #EXT-X-KEY / #EXT-X-MEDIA carry URLs in URI="...".
      return line.replace(/URI="([^"]+)"/g, (_, uri: string) => `URI="${rewrite(uri)}"`);
    })
    .join("\n");

  return new Response(body, {
    status: res.status,
    headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" },
  });
}

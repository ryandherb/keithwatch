import { getEpisodes, getStreamLinks } from "@/features/watch/api/watch";
import type { LinksResponse, TranslationMode } from "@shared/types";
import Hls from "hls.js";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";

/**
 * Plays one episode. Everything needed to find it lives in the URL so a
 * refresh or shared link reopens the same episode:
 *
 *   /player?q=<search query>&i=<result index>&t=<title>&mode=sub|dub&ep=<episode>
 *
 * `q` + `i` identify the show for ani-cli; `t` is only for display.
 */
export default function PlayerPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    const query = searchParams.get("q");
    const index = Number(searchParams.get("i"));
    const title = searchParams.get("t") ?? query;
    const mode: TranslationMode = searchParams.get("mode") === "dub" ? "dub" : "sub";
    const epParam = searchParams.get("ep");

    const [episodes, setEpisodes] = useState<string[]>([]);
    const [episodesLoading, setEpisodesLoading] = useState(false);
    const [links, setLinks] = useState<LinksResponse | null>(null);
    const [linksLoading, setLinksLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);

    const validParams = query != null && Number.isInteger(index) && index >= 1;
    // Fall back to the first episode until the user picks one.
    const currentEp = epParam ?? episodes[0] ?? null;

    /** Updates URL params without adding a history entry per click. */
    const updateParams = (changes: Record<string, string | null>) => {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                for (const [key, value] of Object.entries(changes)) {
                    if (value === null) next.delete(key);
                    else next.set(key, value);
                }
                return next;
            },
            { replace: true },
        );
    };

    // Load the episode list whenever the show or sub/dub changes.
    useEffect(() => {
        if (!validParams) return;
        const controller = new AbortController();

        setEpisodes([]);
        setError(null);
        setEpisodesLoading(true);

        getEpisodes(query, index, mode, controller.signal)
            .then(setEpisodes)
            .catch((err) => {
                if (!controller.signal.aborted) setError(err.message);
            })
            .finally(() => {
                if (!controller.signal.aborted) setEpisodesLoading(false);
            });

        return () => controller.abort();
    }, [validParams, query, index, mode]);

    // Fetch stream links for the current episode.
    useEffect(() => {
        if (!validParams || currentEp == null) return;
        const controller = new AbortController();

        setLinks(null);
        setError(null);
        setLinksLoading(true);

        getStreamLinks(query, index, currentEp, { mode, signal: controller.signal })
            .then(setLinks)
            .catch((err) => {
                if (!controller.signal.aborted) setError(err.message);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLinksLoading(false);
            });

        return () => controller.abort();
    }, [validParams, query, index, currentEp, mode]);

    // Attach the stream to the <video>. Safari plays HLS natively; other
    // browsers need hls.js. Non-HLS links (e.g. .mp4) are set directly.
    useEffect(() => {
        const video = videoRef.current;
        const src = links?.selected;
        if (!video || !src) return;

        // Links are /api/stream?url=<encoded upstream>, so check the upstream URL.
        const upstream = new URL(src, location.href).searchParams.get("url") ?? src;
        const isHls = /\.m3u8(\?|$)/i.test(upstream);
        if (isHls && Hls.isSupported()) {
            // These streams are H.264 + AAC. hls.js converts them to fragmented
            // MP4 for the browser, which fails if the browser has no H.264 decoder
            // (e.g. Firefox without system FFmpeg, or Chromium builds without
            // proprietary codecs). Say so instead of sitting on a paused video.
            const missingCodecs = !MediaSource.isTypeSupported('video/mp4; codecs="avc1.640028,mp4a.40.2"');
            if (missingCodecs) {
                setError(
                    "This browser can't decode H.264/AAC, which these streams use. " +
                        "Try another browser, or install FFmpeg if you're on Firefox/Linux.",
                );
            }

            const hls = new Hls();
            hls.on(Hls.Events.ERROR, (_event, data) => {
                // Logged to the console (and echoed to the dev server terminal).
                console.error("hls.js error:", data.type, data.details, data.fatal ? "(fatal)" : "", data.error?.message ?? "");
                // Keep the clearer codec message if that's the cause.
                if (data.fatal && !missingCodecs) setError(`Playback failed: ${data.details}`);
            });
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                // Autoplay can be blocked; the user can still press play.
                video.play().catch((err) => console.warn("Autoplay blocked:", err.message));
            });
            hls.loadSource(src);
            hls.attachMedia(video);
            return () => hls.destroy();
        }

        video.src = src;
        return () => {
            video.removeAttribute("src");
            video.load();
        };
    }, [links]);

    if (!validParams) {
        return (
            <section className="empty-state">
                <p>Missing or invalid show. Go back and pick a search result.</p>
            </section>
        );
    }

    return (
        <section>
            <header className="page-header">
                <h1>
                    {title}
                    {currentEp != null && ` — Episode ${currentEp}`}
                </h1>
            </header>

            {error && <p role="alert">{error}</p>}

            <video ref={videoRef} controls autoPlay style={{ width: "100%" }}>
                {links?.subtitles && (
                    <track kind="subtitles" src={links.subtitles} srcLang="en" label="English" default />
                )}
            </video>
            {linksLoading && <p>Loading stream…</p>}

            <div>
                <button
                    className="button"
                    onClick={() => updateParams({ mode: mode === "sub" ? "dub" : "sub", ep: null })}
                >
                    Switch to {mode === "sub" ? "dub" : "sub"}
                </button>
            </div>

            <h2 className="section__title">Episodes</h2>
            {episodesLoading && <p>Loading episodes…</p>}
            <ul className="episode-list">
                {episodes.map((ep) => (
                    <li key={ep}>
                        <button
                            className="button"
                            aria-current={ep === currentEp}
                            disabled={ep === currentEp}
                            onClick={() => updateParams({ ep })}
                        >
                            {ep}
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}

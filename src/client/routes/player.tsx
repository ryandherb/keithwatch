import { getEpisodes, getStreamLinks } from "@/features/watch/api/watch";
import { db, toggleFavorite, toggleWatchList, updateWatchHistory, useWatchHistory } from "@/lib/db";
import type { LinksResponse, TranslationMode } from "@shared/types";
import Hls from "hls.js";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Eye, LoaderCircle, Star } from "lucide-react";
import { Link, useSearchParams } from "react-router";

/** How often to save playback progress while the video is playing. */
const SAVE_INTERVAL_MS = 5000;

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
    /** Saved playtime to seek to once the restored episode's stream loads. */
    const pendingSeekRef = useRef<number | null>(null);
    /** Episode the currently attached stream belongs to; null while switching. */
    const streamEpRef = useRef<string | null>(null);
    /** Title whose watch history has been checked; streams wait for this. */
    const [historyTitle, setHistoryTitle] = useState<string | null>(null);

    // Live, so the buttons stay in sync with toggles made elsewhere (e.g. a card).
    const entry = useWatchHistory(title ?? "");
    const isFavorite = entry?.isFavorite ?? false;
    const onWatchList = entry?.onWatchList ?? false;

    const validParams = query != null && Number.isInteger(index) && index >= 1;
    const historyReady = title != null && historyTitle === title;
    // Fall back to the first episode until the user picks one.
    const currentEp = epParam ?? episodes[0] ?? null;
    const currentIndex = currentEp == null ? -1 : episodes.indexOf(currentEp);
    const prevEp = currentIndex > 0 ? episodes[currentIndex - 1] : null;
    const nextEp = currentIndex >= 0 && currentIndex < episodes.length - 1 ? episodes[currentIndex + 1] : null;

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

    // Restore the saved episode and position once per show. An `ep` already in
    // the URL (refresh, shared link) wins; the saved position is only used if
    // it belongs to the episode being opened.
    useEffect(() => {
        if (!validParams || title == null) return;
        let cancelled = false;

        db.watchHistory
            .get(title)
            .then((entry) => {
                if (cancelled || !entry) return;
                if (epParam == null || epParam === entry.ep) {
                    if (epParam == null) updateParams({ ep: entry.ep });
                    pendingSeekRef.current = entry.playtime;
                }
            })
            .catch((err) => console.warn("Couldn't read watch history:", err))
            .finally(() => {
                if (!cancelled) setHistoryTitle(title);
            });

        return () => {
            cancelled = true;
        };
        // Only re-run for a different show; epParam is read once on purpose.
    }, [validParams, title]);

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

    // Fetch stream links for the current episode (after history is restored,
    // so we don't start loading episode 1 and then jump to the saved one).
    useEffect(() => {
        if (!validParams || !historyReady || currentEp == null) return;
        const controller = new AbortController();

        streamEpRef.current = null;
        setLinks(null);
        setError(null);
        setLinksLoading(true);

        getStreamLinks(query, index, currentEp, { mode, signal: controller.signal })
            .then((result) => {
                streamEpRef.current = currentEp;
                setLinks(result);
            })
            .catch((err) => {
                if (!controller.signal.aborted) setError(err.message);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLinksLoading(false);
            });

        return () => controller.abort();
    }, [validParams, historyReady, query, index, currentEp, mode]);

    // Attach the stream to the <video>. Safari plays HLS natively; other
    // browsers need hls.js. Non-HLS links (e.g. .mp4) are set directly.
    useEffect(() => {
        const video = videoRef.current;
        const src = links?.selected;
        if (!video || !src) return;

        // Jump to the restored position once the video knows its duration;
        // setting currentTime before then gets reset when the source attaches.
        const applySavedTime = () => {
            if (pendingSeekRef.current == null) return;
            video.currentTime = pendingSeekRef.current;
            pendingSeekRef.current = null;
        };
        video.addEventListener("loadedmetadata", applySavedTime, { once: true });
        const removeSeekListener = () => video.removeEventListener("loadedmetadata", applySavedTime);

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
            return () => {
                removeSeekListener();
                hls.destroy();
            };
        }

        video.src = src;
        return () => {
            removeSeekListener();
            video.removeAttribute("src");
            video.load();
        };
    }, [links]);

    // Save progress every few seconds while playing, and whenever the user
    // pauses. The episode comes from streamEpRef, not currentEp, so a pause
    // fired while switching episodes can't save the old position under the
    // new episode.
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !historyReady || title == null || query == null) return;

        let lastSaved = 0;
        const save = () => {
            const ep = streamEpRef.current;
            // Don't overwrite the saved position before we've seeked to it.
            if (ep == null || pendingSeekRef.current != null || video.readyState === 0) return;
            lastSaved = Date.now();
            updateWatchHistory(title, { ep, playtime: video.currentTime, query, index }).catch((err) =>
                console.warn("Couldn't save watch history:", err),
            );
        };
        const onTimeUpdate = () => {
            if (Date.now() - lastSaved >= SAVE_INTERVAL_MS) save();
        };

        video.addEventListener("timeupdate", onTimeUpdate);
        video.addEventListener("pause", save);
        return () => {
            video.removeEventListener("timeupdate", onTimeUpdate);
            video.removeEventListener("pause", save);
        };
    }, [historyReady, title, query, index]);

    /** Switches episode and records it as the show's current episode. */
    const selectEpisode = (ep: string) => {
        if (ep === currentEp) return;
        pendingSeekRef.current = null;
        updateParams({ ep });
        if (title != null && query != null) {
            updateWatchHistory(title, { ep, playtime: 0, query, index }).catch((err) =>
                console.warn("Couldn't save watch history:", err),
            );
        }
    };

    /** Switches sub/dub. Episode lists differ between them, so start over. */
    const selectMode = (next: TranslationMode) => {
        if (next === mode) return;
        pendingSeekRef.current = null;
        updateParams({ mode: next, ep: null });
    };

    const handleFavorite = () => {
        if (title == null) return;
        toggleFavorite(title).catch((err) => console.warn("Couldn't update favorite:", err));
    };

    const handleWatchList = () => {
        if (title == null) return;
        toggleWatchList(title).catch((err) => console.warn("Couldn't update watchlist:", err));
    };

    if (!validParams) {
        return (
            <div className="empty-state">
                <AlertCircle size={28} aria-hidden="true" />
                <p className="empty-state__title">Missing or invalid show</p>
                <p className="empty-state__hint">Go back and pick a search result.</p>
                <Link className="button" to="/">Back to search</Link>
            </div>
        );
    }

    return (
        <>
            <header className="page-header player__header">
                <div>
                    <h1>{title}</h1>
                    <p className="player__subtitle">
                        {currentEp == null
                            ? "Loading…"
                            : episodes.length > 0
                              ? `Episode ${currentEp} of ${episodes.length}`
                              : `Episode ${currentEp}`}
                    </p>
                </div>
                <div className="player__actions">
                    <button
                        className="button button--favorite"
                        aria-pressed={isFavorite}
                        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                        onClick={handleFavorite}
                    >
                        <Star size={16} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" />
                        Favorite
                    </button>
                    <button
                        className="button button--watchlist"
                        aria-pressed={onWatchList}
                        title={onWatchList ? "Remove from watchlist" : "Add to watchlist"}
                        onClick={handleWatchList}
                    >
                        <Eye size={16} aria-hidden="true" />
                        Watchlist
                    </button>
                    <div className="segmented" role="group" aria-label="Audio">
                        {(["sub", "dub"] as const).map((m) => (
                            <button
                                key={m}
                                className="segmented__option"
                                aria-pressed={mode === m}
                                onClick={() => selectMode(m)}
                            >
                                {m === "sub" ? "Sub" : "Dub"}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {error && (
                <div className="alert" role="alert">
                    <AlertCircle size={18} aria-hidden="true" />
                    <span>{error}</span>
                </div>
            )}

            <div className="player">
                <video ref={videoRef} className="player__video" controls autoPlay>
                    {links?.subtitles && (
                        <track kind="subtitles" src={links.subtitles} srcLang="en" label="English" default />
                    )}
                </video>
                {linksLoading && (
                    <div className="player__overlay">
                        <LoaderCircle className="spinner" size={28} aria-hidden="true" />
                        <span>Loading stream…</span>
                    </div>
                )}
            </div>

            <div className="player__controls">
                <button className="button" disabled={prevEp == null} onClick={() => prevEp && selectEpisode(prevEp)}>
                    <ChevronLeft size={16} aria-hidden="true" />
                    Previous
                </button>
                <button className="button" disabled={nextEp == null} onClick={() => nextEp && selectEpisode(nextEp)}>
                    Next
                    <ChevronRight size={16} aria-hidden="true" />
                </button>
            </div>

            <section className="section">
                <h2 className="section__title section__title--row">
                    Episodes
                    {episodes.length > 0 && <span className="count-badge">{episodes.length}</span>}
                </h2>
                {episodesLoading ? (
                    <p className="status-text">
                        <LoaderCircle className="spinner" size={16} aria-hidden="true" />
                        Loading episodes…
                    </p>
                ) : (
                    <ul className="episode-grid">
                        {episodes.map((ep) => (
                            <li key={ep}>
                                <button
                                    className="episode"
                                    aria-current={ep === currentEp ? "true" : undefined}
                                    aria-label={`Episode ${ep}`}
                                    onClick={() => selectEpisode(ep)}
                                >
                                    {ep}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}

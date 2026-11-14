import Dexie, { type EntityTable } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";

interface WatchHistory {
    title: string;
    ep: string;
    playtime: number;
    isFavorite?: boolean;
    onWatchList?: boolean;
    /** Set once the show has been played (or an episode picked) in the player. */
    hasWatched?: boolean;
    /** When the show was last played, in ms since epoch. Orders "Continue Watching". */
    lastWatched?: number;
    /** ani-cli identifies a show by (query, index); saved so the library can reopen the player. */
    query?: string;
    index?: number;
}

const db = new Dexie("watchDataDB") as Dexie & {
    watchHistory: EntityTable<WatchHistory, "title">;
};

db.version(1).stores({
    watchHistory: "title",
});

// v2: backfill hasWatched for entries saved before the flag existed. Toggling
// favorite/watchlist creates entries at ep 1, 0:00, so only count real progress.
db.version(2)
    .stores({ watchHistory: "title" })
    .upgrade((tx) =>
        tx
            .table<WatchHistory, string>("watchHistory")
            .toCollection()
            .modify((entry) => {
                if (entry.playtime > 0 || entry.ep !== "1") entry.hasWatched = true;
            }),
    );

const addWatchHistory = (title: string) =>
    db.watchHistory.put({ title, ep: "1", playtime: 0 });

const useWatchHistory = (title: string) =>
    useLiveQuery(() => db.watchHistory.get(title), [title]);

/** Live list of favorited shows; re-renders when favorites change. */
const useFavorites = () =>
    useLiveQuery(() => db.watchHistory.filter((entry) => entry.isFavorite === true).toArray(), []);

/** Live list of shows on the watchlist; re-renders when the watchlist changes. */
const useWatchList = () =>
    useLiveQuery(() => db.watchHistory.filter((entry) => entry.onWatchList === true).toArray(), []);

/** Live list of shows the user has started, most recently watched first. */
const useInProgress = () =>
    useLiveQuery(async () => {
        const entries = await db.watchHistory.filter((entry) => entry.hasWatched === true).toArray();
        return entries.sort((a, b) => (b.lastWatched ?? 0) - (a.lastWatched ?? 0));
    }, []);

/**
 * Updates the saved episode and/or playtime for a show, creating the entry
 * (starting at episode 1, 0:00) if the show hasn't been watched before.
 * Also marks it as watched and bumps lastWatched.
 */
const updateWatchHistory = (title: string, changes: Partial<Omit<WatchHistory, "title">>) =>
    db.transaction("rw", db.watchHistory, async () => {
        const existing = await db.watchHistory.get(title);
        await db.watchHistory.put({
            ep: "1",
            playtime: 0,
            ...existing,
            ...changes,
            title,
            hasWatched: true,
            lastWatched: Date.now(),
        });
    });

type ToggleField = "isFavorite" | "onWatchList";

/**
 * Flips a boolean flag on a show, creating its entry (episode 1, 0:00) if it
 * hasn't been watched yet. Resolves to the new value.
 */
const toggleField = (title: string, field: ToggleField) =>
    db.transaction("rw", db.watchHistory, async () => {
        const existing = await db.watchHistory.get(title);
        const next = !existing?.[field];
        await db.watchHistory.put({ ep: "1", playtime: 0, ...existing, [field]: next, title });
        return next;
    });

const toggleFavorite = (title: string) => toggleField(title, "isFavorite");
const toggleWatchList = (title: string) => toggleField(title, "onWatchList");

export type { WatchHistory };
export {
    db,
    addWatchHistory,
    useWatchHistory,
    updateWatchHistory,
    toggleFavorite,
    toggleWatchList,
    useFavorites,
    useWatchList,
    useInProgress,
};

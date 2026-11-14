import Dexie, { type EntityTable } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";

interface WatchHistory {
    title: string;
    ep: string;
    playtime: number;
    isFavorite?: boolean;
    onWatchList?: boolean;
}

const db = new Dexie("watchDataDB") as Dexie & {
    watchHistory: EntityTable<WatchHistory, "title">;
};

db.version(1).stores({
    watchHistory: "title",
});

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

/**
 * Updates the saved episode and/or playtime for a show, creating the entry
 * (starting at episode 1, 0:00) if the show hasn't been watched before.
 */
const updateWatchHistory = (title: string, changes: Partial<Omit<WatchHistory, "title">>) =>
    db.transaction("rw", db.watchHistory, async () => {
        const existing = await db.watchHistory.get(title);
        await db.watchHistory.put({ ep: "1", playtime: 0, ...existing, ...changes, title });
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
};

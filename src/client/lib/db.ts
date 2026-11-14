import Dexie, { type EntityTable } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";

interface WatchHistory {
    title: string;
    ep: string;
    playtime: number;
    isFavorite?: boolean;
    onWatchList?: boolean;

    hasWatched?: boolean;
    lastWatched?: number;

    query?: string;
    index?: number;

    image?: Blob;
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

/** Downloads an image as a Blob. Returns undefined on failure: a missing cover shouldn't block saving. */
const fetchImage = async (imageUrl: string) => {
    try {
        const response = await fetch(imageUrl);
        return response.ok ? await response.blob() : undefined;
    } catch (err) {
        console.warn("Couldn't save cover image:", err);
        return undefined;
    }
};

/**
 * Cover image for a show that has no entry yet. Shows that already have an
 * entry get undefined, so the image is only ever saved when the entry is created.
 * Must run outside a Dexie transaction: awaiting fetch() inside one commits it early.
 */
const imageForNewEntry = async (title: string, imageUrl?: string) => {
    if (!imageUrl || (await db.watchHistory.get(title))) return undefined;
    return fetchImage(imageUrl);
};

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
 * Also marks it as watched and bumps lastWatched. `imageUrl` is saved as the
 * cover only when this call creates the entry.
 */
const updateWatchHistory = async (
    title: string,
    changes: Partial<Omit<WatchHistory, "title">>,
    imageUrl?: string,
) => {
    const image = await imageForNewEntry(title, imageUrl);
    return db.transaction("rw", db.watchHistory, async () => {
        const existing = await db.watchHistory.get(title);
        await db.watchHistory.put({
            ep: "1",
            playtime: 0,
            ...(existing ?? { image }),
            ...changes,
            title,
            hasWatched: true,
            lastWatched: Date.now(),
        });
    });
};

type ToggleField = "isFavorite" | "onWatchList";

/**
 * Flips a boolean flag on a show, creating its entry (episode 1, 0:00) if it
 * hasn't been watched yet. `imageUrl` is saved as the cover only when this call
 * creates the entry. Resolves to the new value.
 */
const toggleField = async (title: string, field: ToggleField, imageUrl?: string) => {
    const image = await imageForNewEntry(title, imageUrl);
    return db.transaction("rw", db.watchHistory, async () => {
        const existing = await db.watchHistory.get(title);
        const next = !existing?.[field];
        await db.watchHistory.put({ ep: "1", playtime: 0, ...(existing ?? { image }), [field]: next, title });
        return next;
    });
};

const toggleFavorite = (title: string, imageUrl?: string) => toggleField(title, "isFavorite", imageUrl);
const toggleWatchList = (title: string, imageUrl?: string) => toggleField(title, "onWatchList", imageUrl);

export type { WatchHistory };
export {
    db,
    useWatchHistory,
    updateWatchHistory,
    toggleFavorite,
    toggleWatchList,
    useFavorites,
    useWatchList,
    useInProgress,
};

import Dexie, { type EntityTable } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";

interface WatchHistory {
    title: string;
    ep: string;
    playtime: number;
}

const db = new Dexie("watchDataDB") as Dexie & {
    watchHistory: EntityTable<WatchHistory, "title">;
};

db.version(1).stores({
    watchHistory: "title", // title is the primary key
});

const addWatchHistory = (title: string) =>
    db.watchHistory.put({ title, ep: "1", playtime: 0 });

const useWatchHistory = (title: string) =>
    useLiveQuery(() => db.watchHistory.get(title), [title]);

/**
 * Updates the saved episode and/or playtime for a show, creating the entry
 * (starting at episode 1, 0:00) if the show hasn't been watched before.
 */
const updateWatchHistory = (title: string, changes: Partial<Omit<WatchHistory, "title">>) =>
    db.transaction("rw", db.watchHistory, async () => {
        const existing = await db.watchHistory.get(title);
        await db.watchHistory.put({ ep: "1", playtime: 0, ...existing, ...changes, title });
    });

export type { WatchHistory };
export { db, addWatchHistory, useWatchHistory, updateWatchHistory };

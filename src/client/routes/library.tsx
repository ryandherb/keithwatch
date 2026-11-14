import AnimeCard from "@/features/search/components/AnimeCard";
import { useFavorites, useInProgress, useWatchList, type WatchHistory } from "@/lib/db";
import { Eye, Play, Star, type LucideIcon } from "lucide-react";
import { playerUrl, searchUrl } from "@/features/watch/urls";
import { Link } from "react-router";

// Shows played since query/index started being saved reopen the player, which
// resumes the saved episode. Older entries (or ones only favorited from a
// search) fall back to searching the title.
const entryUrl = (entry: WatchHistory) =>
    entry.query != null && entry.index != null
        ? playerUrl(entry.query, entry.index, entry.title)
        : searchUrl(entry.title);

interface LibrarySectionProps {
    heading: string;
    icon: LucideIcon;
    /** undefined while the first query loads. */
    entries?: WatchHistory[];
    emptyHint: string;
}

function LibrarySection({ heading, icon: Icon, entries, emptyHint }: LibrarySectionProps) {
    return (
        <section className="section">
            <h2 className="section__title section__title--row">
                <Icon size={18} aria-hidden="true" />
                {heading}
                {entries && <span className="count-badge">{entries.length}</span>}
            </h2>
            {entries === undefined ? null : entries.length === 0 ? (
                <div className="empty-state">
                    <Icon size={28} aria-hidden="true" />
                    <p className="empty-state__title">Nothing here yet</p>
                    <p className="empty-state__hint">{emptyHint}</p>
                    <Link className="button" to="/">Find something to watch</Link>
                </div>
            ) : (
                <ul className="card-grid">
                    {entries.map((entry) => (
                        <AnimeCard key={entry.title} title={entry.title} to={entryUrl(entry)} />
                    ))}
                </ul>
            )}
        </section>
    );
}

export default function Library() {
    const favorites = useFavorites();
    const watchList = useWatchList();
    const inProgress = useInProgress();

    return (
        <>
            <header className="page-header">
                <h1>My Library</h1>
            </header>
            <LibrarySection
                heading="Continue Watching"
                icon={Play}
                entries={inProgress}
                emptyHint="Anime you've watched will appear here."
            />
            <LibrarySection
                heading="Favorites"
                icon={Star}
                entries={favorites}
                emptyHint="Click the star on any show to save it here."
            />
            <LibrarySection
                heading="Watch List"
                icon={Eye}
                entries={watchList}
                emptyHint="Click the eye on any show to queue it up for later."
            />
        </>
    );
}

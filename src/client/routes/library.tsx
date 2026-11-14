import AnimeCard from "@/features/search/components/AnimeCard";
import { useFavorites, useWatchList, type WatchHistory } from "@/lib/db";
import { Eye, Star, type LucideIcon } from "lucide-react";
import { Link } from "react-router";

// Saved entries only store the title, not the (query, index) pair the player
// needs, so a library card re-runs the search for that title.
const searchUrl = (title: string) => `/search?${new URLSearchParams({ q: title })}`;

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
                        <AnimeCard key={entry.title} title={entry.title} to={searchUrl(entry.title)} />
                    ))}
                </ul>
            )}
        </section>
    );
}

export default function Library() {
    const favorites = useFavorites();
    const watchList = useWatchList();

    return (
        <>
            <header className="page-header">
                <h1>My Library</h1>
            </header>
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

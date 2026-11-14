import { toggleFavorite, toggleWatchList, useWatchHistory } from "@/lib/db";
import { Eye, Star } from "lucide-react";
import { Link } from "react-router";

/** Formats seconds as m:ss, or h:mm:ss past an hour. */
const formatTime = (seconds: number) => {
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};

interface AnimeCardProps {
    title: string;
    image?: string;
    /** Where clicking the card goes. The page decides, since it depends on context. */
    to: string;
}

export default function AnimeCard({ title, image, to }: AnimeCardProps) {
    const entry = useWatchHistory(title);
    const isFavorite = entry?.isFavorite ?? false;
    const onWatchList = entry?.onWatchList ?? false;
    // e.g. "Ep 3 · 12:34", or just "Ep 3" if the episode was picked but not played.
    const progress = entry?.hasWatched
        ? entry.playtime >= 1
            ? `Ep ${entry.ep} · ${formatTime(entry.playtime)}`
            : `Ep ${entry.ep}`
        : null;

    const handleFavorite = () => {
        toggleFavorite(title, image).catch((err) => console.warn("Couldn't update favorite:", err));
    };

    const handleWatchList = () => {
        toggleWatchList(title, image).catch((err) => console.warn("Couldn't update watchlist:", err));
    };

    return (
        <li className="card">
            <Link className="card__link" to={to}>
                <div className="card__poster" aria-hidden="true">
                    {image ? (
                        <img src={image} alt="" loading="lazy" />
                    ) : (
                        <span className="card__initial">{title.charAt(0)}</span>
                    )}
                </div>
                <span className="card__title">{title}</span>
                {progress && <span className="card__meta">{progress}</span>}
            </Link>
            {/* Siblings of the card link, not children: buttons can't sit inside links.
                Positioned over the poster's corner with CSS. */}
            <div className="card__actions">
                <button
                    className="card__action card__action--favorite"
                    onClick={handleFavorite}
                    aria-pressed={isFavorite}
                    aria-label="Favorite"
                    title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                    <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
                </button>
                <button
                    className="card__action card__action--watchlist"
                    onClick={handleWatchList}
                    aria-pressed={onWatchList}
                    aria-label="Watchlist"
                    title={onWatchList ? "Remove from watchlist" : "Add to watchlist"}
                >
                    <Eye size={16} />
                </button>
            </div>
        </li>
    );
}

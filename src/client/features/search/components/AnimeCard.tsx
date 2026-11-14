import { toggleFavorite, toggleWatchList, useWatchHistory } from "@/lib/db";
import type { SearchResult } from "@shared/types";
import { Eye, Star } from "lucide-react";

interface AnimeCardProps {
    onSelect: (result: SearchResult) => void;
    result: SearchResult;
}

export default function AnimeCard({ onSelect, result }: AnimeCardProps) {
    const entry = useWatchHistory(result.title);
    const isFavorite = entry?.isFavorite ?? false;
    const onWatchList = entry?.onWatchList ?? false;

    const handleFavorite = () => {
        toggleFavorite(result.title).catch((err) => console.warn("Couldn't update favorite:", err));
    };

    const handleWatchList = () => {
        toggleWatchList(result.title).catch((err) => console.warn("Couldn't update watchlist:", err));
    };

    return (
        <li className="card">
            <button className="card__button" onClick={() => onSelect(result)}>
                <div className="card__poster" aria-hidden="true">
                    {result.image ? (
                        <img src={result.image} alt="" loading="lazy" />
                    ) : (
                        result.title.charAt(0)
                    )}
                </div>
                <span className="card__title">{result.title}</span>
            </button>
            {/* Siblings of the card button, not children: buttons can't nest. */}
            <div className="card__actions">
                <button
                    className="card__action"
                    onClick={handleFavorite}
                    aria-pressed={isFavorite}
                    aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                    title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                    <Star size={18} fill={isFavorite ? "currentColor" : "none"} />
                </button>
                <button
                    className="card__action"
                    onClick={handleWatchList}
                    aria-pressed={onWatchList}
                    aria-label={onWatchList ? "Remove from watchlist" : "Add to watchlist"}
                    title={onWatchList ? "Remove from watchlist" : "Add to watchlist"}
                >
                    <Eye size={18} />
                </button>
            </div>
        </li>
    );
}

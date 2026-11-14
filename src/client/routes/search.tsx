import { searchAnime } from "@/features/search/api/search";
import AnimeCard from "@/features/search/components/AnimeCard";
import { playerUrl } from "@/features/watch/urls";
import type { SearchResult } from "@shared/types";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router"

export default function SearchPage() {
    const [searchParams] = useSearchParams();
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

    const query = searchParams.get("q")

    useEffect(() => {
        if (query == null) {
            alert("Query is invalid. Please try again.");
            return;
        }

        const controller = new AbortController();
        searchAnime(query, controller.signal)
            .then(setSearchResults)
            .catch((err) => {
                if (!controller.signal.aborted) console.error(err);
            });

        // Cancel the in-flight search if the query changes or the page unmounts.
        return () => controller.abort();
    }, [query])

    return (
        <section>
            <header className="page-header">
                <h1>Search results for "{query}"</h1>
            </header>
            <ul className="card-grid">
                {query != null && searchResults.map((result) => (
                    <AnimeCard
                        key={result.index}
                        title={result.title}
                        image={result.image}
                        to={playerUrl(query, result.index, result.title)}
                    />
                ))}
            </ul>
        </section>
    )
}
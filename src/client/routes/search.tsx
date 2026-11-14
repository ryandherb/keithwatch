import { searchAnime } from "@/features/search/api/search";
import AnimeCard from "@/features/search/components/AnimeCard";
import type { SearchResult } from "@shared/types";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router"

export default function SearchPage() {
    const [searchParams] = useSearchParams();
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const navigate = useNavigate(); 

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

    const handleSelect = (result: SearchResult) => {
        if (query == null) return;
        // ani-cli identifies a show by (query, index), so the player needs the
        // original query, not the title. The title is only for display.
        const params = new URLSearchParams({
            q: query,
            i: String(result.index),
            t: result.title,
        });
        navigate(`/player?${params}`);
    }

    return (
        <section>
            <header className="page-header">
                <h1>Search results for "{query}"</h1>
            </header>
            <ul className="card-grid">
                {searchResults.map((result) => (
                    <AnimeCard key={result.index} result={result} onSelect={handleSelect} />
                ))}
            </ul>
        </section>
    )
}
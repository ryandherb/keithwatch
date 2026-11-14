import { searchAnime } from "@/features/search/api/search";
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

    const handleSelect = (title: string) => {
        
    }

    return (
        <section>
            <header className="page-header">
                <h1>Search results for "{query}"</h1>
            </header>
            <ul className="card-grid">
                {searchResults.map((result, index) => (
                    <li key={index} className="card">
                        <button className="card_button" onClick={() => handleSelect(result.title)}>
                            <div className="card__poster" aria-hidden="true">
                                {result.image ? (
                                    <img src={result.image} alt="" loading="lazy" />
                                ) : (
                                    result.title.charAt(0)
                                )}
                            </div>
                            <span className="card__title">{result.title}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    )
}
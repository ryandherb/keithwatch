import { searchAnime } from "@/features/search/api/search";
import type { SearchResult } from "@shared/types";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router"

export default function SearchPage() {
    const [searchParams] = useSearchParams();
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

    const query = searchParams.get("q")

    useEffect(() => {
        const fetchAnime = async () => {
            if (query == null) {
                alert("Query is invalid. Please try again.");
                return;
            }

            const data = await searchAnime(query); 

            setSearchResults(data);
        }

        fetchAnime(); 
    })

    return (
        <section>
            <header className="page-header">
                <h1>Search results for "{query}"</h1>
            </header>
            <ul className="card-grid">
                {searchResults.map((result, index) => (
                    <li key={index} className="card">
                        <div className="card__poster" aria-hidden="true">
                            {result.title.charAt(0)}
                        </div>
                        <span className="card__title">{result.title}</span>
                    </li>
                ))}
            </ul>
        </section>
    )
}
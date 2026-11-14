import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router";

export default function SearchBar() {
    const [query, setQuery] = useState("");
    const navigate = useNavigate();

    const handleQueryChange = (e: ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
    };

    const handleSearch = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const trimmed = query.trim();

        if (!trimmed) {
            return;
        }

        navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    };

    return (
        <form className="search-form" onSubmit={handleSearch}>
            <input
                className="input"
                placeholder="Search anime..."
                aria-label="Search anime"
                value={query}
                onChange={handleQueryChange}
            />
        </form>
    );
}
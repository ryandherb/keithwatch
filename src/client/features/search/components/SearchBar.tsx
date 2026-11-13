import { useState } from "react";
import { searchAnime } from "../api/search";

export default function SearchBar() {
    const [query, setQuery] = useState("");

    const handleQueryChange = (e: any) => {
        setQuery(e.target.value);
    }

    const handleSearch = () => {
        searchAnime(query); 
    }
}
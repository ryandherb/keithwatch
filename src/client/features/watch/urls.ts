/**
 * Player URL for a show. ani-cli identifies a show by (query, index), so the
 * player needs the original search query, not the title; the title is only
 * for display. With no `ep`, the player resumes from watch history.
 */
export const playerUrl = (query: string, index: number, title: string) =>
    `/player?${new URLSearchParams({ q: query, i: String(index), t: title })}`;

/** Search results page for a query. */
export const searchUrl = (query: string) => `/search?${new URLSearchParams({ q: query })}`;

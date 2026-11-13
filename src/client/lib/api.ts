/**
 * Small fetch helper for calling the keithwatch server's JSON API.
 */
import type { ApiError } from "@shared/types";

export async function getJson<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const res = await fetch(`${path}?${search}`, { signal });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new Error(body?.error ?? `Request failed (HTTP ${res.status})`);
  }
  return (await res.json()) as T;
}

import type { SpotifyClient } from "./client";

export interface Artist {
  id: string;
  name: string;
  genres: string[];
}
export interface Track {
  id: string;
  name: string;
  artist: string;
}
export type TimeRange = "short_term" | "medium_term" | "long_term";

export async function getTopArtists(
  c: SpotifyClient,
  range: TimeRange,
  limit = 50,
): Promise<Artist[]> {
  const data = await c.get<{
    items: { id: string; name: string; genres?: string[] }[];
  }>(`/me/top/artists?time_range=${range}&limit=${limit}`);
  return data.items.map((a) => ({
    id: a.id,
    name: a.name,
    genres: a.genres ?? [],
  }));
}

export async function getTopTracks(
  c: SpotifyClient,
  range: TimeRange,
  limit = 50,
): Promise<Track[]> {
  const data = await c.get<{
    items: { id: string; name: string; artists: { name: string }[] }[];
  }>(`/me/top/tracks?time_range=${range}&limit=${limit}`);
  return data.items.map((t) => ({
    id: t.id,
    name: t.name,
    artist: t.artists[0]?.name ?? "",
  }));
}

export async function getRecentlyPlayed(
  c: SpotifyClient,
  limit = 50,
): Promise<Track[]> {
  const data = await c.get<{
    items: {
      track: { id: string; name: string; artists: { name: string }[] };
    }[];
  }>(`/me/player/recently-played?limit=${limit}`);
  return data.items.map((i) => ({
    id: i.track.id,
    name: i.track.name,
    artist: i.track.artists[0]?.name ?? "",
  }));
}

export async function getSavedTracks(
  c: SpotifyClient,
  limit = 50,
): Promise<Track[]> {
  const data = await c.get<{
    items: {
      track: { id: string; name: string; artists: { name: string }[] };
    }[];
  }>(`/me/tracks?limit=${limit}`);
  return data.items.map((i) => ({
    id: i.track.id,
    name: i.track.name,
    artist: i.track.artists[0]?.name ?? "",
  }));
}

export function deriveTopGenres(artists: Artist[], limit = 10): string[] {
  const counts = new Map<string, number>();
  for (const a of artists)
    for (const g of a.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...counts.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, limit)
    .map(([g]) => g);
}

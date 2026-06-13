import type { SpotifyClient } from "./client";

export interface Artist {
  id: string;
  name: string;
  genres: string[];
  image: string | null;
}
export interface Track {
  id: string;
  name: string;
  artist: string;
  image: string | null;
}
export type TimeRange = "short_term" | "medium_term" | "long_term";

interface SpotifyImage {
  url: string;
}
interface RawArtist {
  id: string;
  name: string;
  genres?: string[];
  images?: SpotifyImage[];
}
interface RawTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album?: { images?: SpotifyImage[] };
}

const firstImage = (images?: SpotifyImage[]): string | null =>
  images && images.length ? images[0].url : null;

function mapArtist(a: RawArtist): Artist {
  return {
    id: a.id,
    name: a.name,
    genres: a.genres ?? [],
    image: firstImage(a.images),
  };
}

function mapTrack(t: RawTrack): Track {
  return {
    id: t.id,
    name: t.name,
    artist: t.artists[0]?.name ?? "",
    image: firstImage(t.album?.images),
  };
}

export async function getTopArtists(
  c: SpotifyClient,
  range: TimeRange,
  limit = 50,
): Promise<Artist[]> {
  const data = await c.get<{ items: RawArtist[] }>(
    `/me/top/artists?time_range=${range}&limit=${limit}`,
  );
  return data.items.map(mapArtist);
}

export async function getTopTracks(
  c: SpotifyClient,
  range: TimeRange,
  limit = 50,
): Promise<Track[]> {
  const data = await c.get<{ items: RawTrack[] }>(
    `/me/top/tracks?time_range=${range}&limit=${limit}`,
  );
  return data.items.map(mapTrack);
}

export async function getRecentlyPlayed(
  c: SpotifyClient,
  limit = 50,
): Promise<Track[]> {
  const data = await c.get<{ items: { track: RawTrack }[] }>(
    `/me/player/recently-played?limit=${limit}`,
  );
  return data.items.map((i) => mapTrack(i.track));
}

export async function getSavedTracks(
  c: SpotifyClient,
  limit = 50,
): Promise<Track[]> {
  const data = await c.get<{ items: { track: RawTrack }[] }>(
    `/me/tracks?limit=${limit}`,
  );
  return data.items.map((i) => mapTrack(i.track));
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

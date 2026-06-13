import type { SpotifyClient } from "./client";

export interface Artist {
  id: string;
  name: string;
  genres: string[];
  image: string | null;
  popularity?: number; // 0–100, Spotify's own metric
  followers?: number;
}
export interface Track {
  id: string;
  name: string;
  artist: string;
  image: string | null;
  durationMs?: number;
  popularity?: number; // 0–100
  explicit?: boolean;
  releaseYear?: number | null;
  album?: string;
  uri?: string;
}
export interface Profile {
  id: string;
  displayName: string;
  image: string | null;
  followers: number;
  product: string | null; // "premium" | "free" | ...
  country: string | null;
}
/** One real listen, with the timestamp Spotify reports for it. */
export interface PlayEvent {
  playedAt: string; // ISO string
  id: string;
  name: string;
  artist: string;
  durationMs: number;
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
  popularity?: number;
  followers?: { total?: number };
}
interface RawTrack {
  id: string;
  name: string;
  uri?: string;
  duration_ms?: number;
  popularity?: number;
  explicit?: boolean;
  artists: { name: string }[];
  album?: { name?: string; images?: SpotifyImage[]; release_date?: string };
}

const firstImage = (images?: SpotifyImage[]): string | null =>
  images && images.length ? images[0].url : null;

function yearFrom(releaseDate?: string): number | null {
  if (!releaseDate) return null;
  const y = Number(releaseDate.slice(0, 4));
  return Number.isFinite(y) && y > 1900 ? y : null;
}

function mapArtist(a: RawArtist): Artist {
  return {
    id: a.id,
    name: a.name,
    genres: a.genres ?? [],
    image: firstImage(a.images),
    popularity: a.popularity,
    followers: a.followers?.total,
  };
}

function mapTrack(t: RawTrack): Track {
  return {
    id: t.id,
    name: t.name,
    artist: t.artists[0]?.name ?? "",
    image: firstImage(t.album?.images),
    durationMs: t.duration_ms,
    popularity: t.popularity,
    explicit: t.explicit,
    releaseYear: yearFrom(t.album?.release_date),
    album: t.album?.name,
    uri: t.uri,
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

/** Recently-played with timestamps — the raw material for the history logger. */
export async function getRecentPlays(
  c: SpotifyClient,
  limit = 50,
): Promise<PlayEvent[]> {
  const data = await c.get<{
    items: { played_at: string; track: RawTrack }[];
  }>(`/me/player/recently-played?limit=${limit}`);
  return data.items.map((i) => ({
    playedAt: i.played_at,
    id: i.track.id,
    name: i.track.name,
    artist: i.track.artists[0]?.name ?? "",
    durationMs: i.track.duration_ms ?? 0,
  }));
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

/**
 * Page through the user's saved library. `cap` bounds the number of API calls
 * (50 tracks each) so a huge library can't stall a request — the caller also
 * gets the true `total` so it can label numbers as exact or estimated.
 */
export async function getAllSavedTracks(
  c: SpotifyClient,
  cap = 10000,
): Promise<{ tracks: Track[]; total: number }> {
  const tracks: Track[] = [];
  let total = 0;
  for (let offset = 0; offset < cap; offset += 50) {
    const data = await c.get<{
      items: { track: RawTrack | null }[];
      total: number;
      next: string | null;
    }>(`/me/tracks?limit=50&offset=${offset}`);
    total = data.total;
    for (const i of data.items) if (i.track) tracks.push(mapTrack(i.track));
    if (!data.next || data.items.length === 0) break;
  }
  return { tracks, total };
}

export async function getProfile(c: SpotifyClient): Promise<Profile> {
  const p = await c.get<{
    id: string;
    display_name?: string;
    images?: SpotifyImage[];
    followers?: { total?: number };
    product?: string;
    country?: string;
  }>("/me");
  return {
    id: p.id,
    displayName: p.display_name || "You",
    image: firstImage(p.images),
    followers: p.followers?.total ?? 0,
    product: p.product ?? null,
    country: p.country ?? null,
  };
}

export async function getFollowedArtistsCount(
  c: SpotifyClient,
): Promise<number> {
  const data = await c.get<{ artists: { total: number } }>(
    "/me/following?type=artist&limit=1",
  );
  return data.artists?.total ?? 0;
}

export async function getPlaylistCount(c: SpotifyClient): Promise<number> {
  const data = await c.get<{ total: number }>("/me/playlists?limit=1");
  return data.total ?? 0;
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

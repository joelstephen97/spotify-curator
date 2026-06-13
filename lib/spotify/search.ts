import type { SpotifyClient } from "./client";

export interface Suggestion {
  artist: string;
  title: string;
}

export interface ResolvedTrack {
  uri: string;
  image: string | null;
  previewUrl: string | null;
}

interface SearchItem {
  uri: string;
  popularity: number;
  preview_url?: string | null;
  album?: { images?: { url: string }[] };
}

export async function resolveTrack(
  c: SpotifyClient,
  s: Suggestion,
): Promise<ResolvedTrack | null> {
  const q = encodeURIComponent(`track:${s.title} artist:${s.artist}`);
  const data = await c.get<{ tracks: { items: SearchItem[] } }>(
    `/search?type=track&limit=5&q=${q}`,
  );
  const items = data.tracks.items;
  if (!items.length) return null;
  const best = items.reduce((b, t) => (t.popularity > b.popularity ? t : b));
  return {
    uri: best.uri,
    image: best.album?.images?.[0]?.url ?? null,
    // preview_url is null for many tracks since Spotify's 2024 deprecation.
    previewUrl: best.preview_url ?? null,
  };
}

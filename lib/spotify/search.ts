import type { SpotifyClient } from "./client";

export interface Suggestion {
  artist: string;
  title: string;
}

export async function resolveTrack(
  c: SpotifyClient,
  s: Suggestion,
): Promise<string | null> {
  const q = encodeURIComponent(`track:${s.title} artist:${s.artist}`);
  const data = await c.get<{
    tracks: { items: { uri: string; popularity: number }[] };
  }>(`/search?type=track&limit=5&q=${q}`);
  const items = data.tracks.items;
  if (!items.length) return null;
  return items.reduce((best, t) => (t.popularity > best.popularity ? t : best))
    .uri;
}

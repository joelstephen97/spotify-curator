import { deriveTopGenres, type Artist, type Track } from "@/lib/spotify/data";

export interface Signals {
  topArtists: Artist[];
  topTracks: Track[];
  recent: Track[];
  saved?: Track[]; // liked songs — a strong, explicit taste signal
}
export interface Profile {
  topGenres: string[];
  artists: string[];
  lovedTracks: string[];
}

/** Artist names ordered by how often they appear in a track list. */
function artistsByFrequency(tracks: Track[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const t of tracks) {
    if (!t.artist) continue;
    counts.set(t.artist, (counts.get(t.artist) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

export function buildProfile(s: Signals): Profile {
  const saved = s.saved ?? [];
  // Merge top artists with the artists the user has liked most — both are
  // "already loved", so Claude should steer toward NEW artists near them.
  const artists = [
    ...new Set([
      ...s.topArtists.map((a) => a.name),
      ...artistsByFrequency(saved, 15),
    ]),
  ].slice(0, 30);

  return {
    topGenres: deriveTopGenres(s.topArtists, 12),
    artists,
    // Liked songs are the core taste signal. We deliberately do NOT use recent
    // plays here — recently played ≠ liked (could be background/skips/others).
    lovedTracks: saved.slice(0, 30).map((t) => `${t.name} — ${t.artist}`),
  };
}

export function seenKeys(s: Signals): string[] {
  const keys = new Set<string>();
  for (const a of s.topArtists) keys.add(`artist:${a.name.toLowerCase()}`);
  for (const t of [...s.topTracks, ...s.recent]) {
    keys.add(`artist:${t.artist.toLowerCase()}`);
    keys.add(`track:${t.artist.toLowerCase()} - ${t.name.toLowerCase()}`);
  }
  // Liked songs: dedup the exact tracks (so we never re-suggest a song they
  // already saved) without blanket-blocking every artist they've ever liked.
  for (const t of s.saved ?? []) {
    keys.add(`track:${t.artist.toLowerCase()} - ${t.name.toLowerCase()}`);
  }
  return [...keys];
}

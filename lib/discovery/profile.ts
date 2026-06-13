import { deriveTopGenres, type Artist, type Track } from "@/lib/spotify/data";

export interface Signals {
  topArtists: Artist[];
  topTracks: Track[];
  recent: Track[];
}
export interface Profile {
  topGenres: string[];
  artists: string[];
  recentTracks: string[];
}

export function buildProfile(s: Signals): Profile {
  return {
    topGenres: deriveTopGenres(s.topArtists, 12),
    artists: [...new Set(s.topArtists.map((a) => a.name))].slice(0, 25),
    recentTracks: s.recent.slice(0, 25).map((t) => `${t.name} — ${t.artist}`),
  };
}

export function seenKeys(s: Signals): string[] {
  const keys = new Set<string>();
  for (const a of s.topArtists) keys.add(`artist:${a.name.toLowerCase()}`);
  for (const t of [...s.topTracks, ...s.recent]) {
    keys.add(`artist:${t.artist.toLowerCase()}`);
    keys.add(`track:${t.artist.toLowerCase()} - ${t.name.toLowerCase()}`);
  }
  return [...keys];
}

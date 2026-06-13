import type { Artist, Track } from "@/lib/spotify/data";

/** Total minutes of music in a track list (sum of durations). Real, not a guess. */
export function totalMinutes(tracks: Track[]): number {
  const ms = tracks.reduce((s, t) => s + (t.durationMs ?? 0), 0);
  return Math.round(ms / 60000);
}

export function averageTrackLengthMs(tracks: Track[]): number {
  const withDur = tracks.filter((t) => t.durationMs);
  if (!withDur.length) return 0;
  return Math.round(
    withDur.reduce((s, t) => s + (t.durationMs ?? 0), 0) / withDur.length,
  );
}

export interface ArtistMinutes {
  artist: string;
  minutes: number;
  tracks: number;
}

/** Minutes grouped by artist across a track list, biggest first. */
export function perArtistMinutes(tracks: Track[], limit = 10): ArtistMinutes[] {
  const map = new Map<string, { ms: number; tracks: number }>();
  for (const t of tracks) {
    if (!t.artist) continue;
    const e = map.get(t.artist) ?? { ms: 0, tracks: 0 };
    e.ms += t.durationMs ?? 0;
    e.tracks += 1;
    map.set(t.artist, e);
  }
  return [...map.entries()]
    .map(([artist, e]) => ({
      artist,
      minutes: Math.round(e.ms / 60000),
      tracks: e.tracks,
    }))
    .sort((a, b) => b.minutes - a.minutes || b.tracks - a.tracks)
    .slice(0, limit);
}

export interface DecadeBucket {
  decade: string; // e.g. "1990s"
  count: number;
}

export function decadeDistribution(tracks: Track[]): DecadeBucket[] {
  const map = new Map<number, number>();
  for (const t of tracks) {
    if (!t.releaseYear) continue;
    const d = Math.floor(t.releaseYear / 10) * 10;
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([d, count]) => ({ decade: `${d}s`, count }));
}

/**
 * Average Spotify popularity (0–100) of a set — a proxy for "how mainstream".
 * Returns null when no item carries popularity (Spotify omits it for some
 * accounts), so callers can hide the stat rather than show a misleading 0.
 */
export function mainstreamScore(
  items: { popularity?: number }[],
): number | null {
  const withPop = items.filter((i) => typeof i.popularity === "number");
  if (!withPop.length) return null;
  return Math.round(
    withPop.reduce((s, i) => s + (i.popularity ?? 0), 0) / withPop.length,
  );
}

/** Percentage of explicit tracks (0–100). */
export function explicitShare(tracks: Track[]): number {
  const known = tracks.filter((t) => typeof t.explicit === "boolean");
  if (!known.length) return 0;
  return Math.round(
    (known.filter((t) => t.explicit).length / known.length) * 100,
  );
}

export function averageReleaseYear(tracks: Track[]): number | null {
  const years = tracks
    .map((t) => t.releaseYear)
    .filter((y): y is number => typeof y === "number");
  if (!years.length) return null;
  return Math.round(years.reduce((s, y) => s + y, 0) / years.length);
}

export interface Personality {
  title: string;
  tagline: string;
  traits: string[];
}

/**
 * A deterministic "listening personality" derived from real signals: how
 * mainstream the taste is (avg popularity), how wide (distinct genres), and
 * which era it leans on (avg release year). No randomness — same input, same
 * archetype — so it's reproducible on a shareable card.
 */
export function listeningPersonality(input: {
  artists: Artist[];
  tracks: Track[];
  genreCount: number;
}): Personality {
  const { artists, tracks, genreCount } = input;
  const mainstream = mainstreamScore([...artists, ...tracks]); // number | null
  const known = mainstream !== null;
  const high = known && mainstream >= 60;
  const avgYear = averageReleaseYear(tracks);
  const diverse = genreCount >= 10;

  // 2×2 of mainstream × diversity sets the core archetype. When popularity is
  // unavailable we fall back to diversity alone.
  let title: string;
  if (high && diverse) title = "The Tastemaker";
  else if (high) title = "The Hitmaker";
  else if (!diverse) title = "The Specialist";
  else title = "The Explorer";

  const traits: string[] = [];
  if (known)
    traits.push(
      high ? `${mainstream}/100 mainstream` : `${100 - mainstream}/100 underground`,
    );
  if (genreCount > 0)
    traits.push(diverse ? `${genreCount} genres deep` : "Focused taste");

  let eraNote = "genre-first";
  if (avgYear !== null) {
    const decade = `${Math.floor(avgYear / 10) * 10}s`;
    traits.push(`${decade} core`);
    if (avgYear < 2005) {
      title = `Vintage ${title.replace("The ", "")}`;
      eraNote = `living in the ${decade}`;
    } else if (avgYear >= 2018) {
      eraNote = "chasing the new";
    } else {
      eraNote = `anchored in the ${decade}`;
    }
  }

  const tagline = !known
    ? `Your taste leans ${eraNote}.`
    : high
      ? `You ride the zeitgeist — ${eraNote}.`
      : `You dig past the charts — ${eraNote}.`;

  return { title, tagline, traits };
}

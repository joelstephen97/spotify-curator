import type { PlayEvent } from "@/lib/spotify/data";
import type { Store } from "@/lib/store/redis";

export const HISTORY_CAP = 5000;

/**
 * Merge freshly-fetched plays into the stored log. Spotify gives each listen a
 * unique `playedAt`, so we dedup on that, keep newest-first, and cap the log so
 * it can't grow without bound.
 */
export function mergePlays(
  existing: PlayEvent[],
  incoming: PlayEvent[],
  cap = HISTORY_CAP,
): PlayEvent[] {
  const byTime = new Map<string, PlayEvent>();
  for (const e of existing) byTime.set(e.playedAt, e);
  for (const e of incoming) byTime.set(e.playedAt, e);
  return [...byTime.values()]
    .sort((a, b) => (a.playedAt < b.playedAt ? 1 : -1))
    .slice(0, cap);
}

/** Read the log, fold in new plays, write it back. Best-effort by design. */
export async function recordRecentPlays(
  store: Store,
  incoming: PlayEvent[],
): Promise<number> {
  const existing = await store.getPlayHistory();
  const merged = mergePlays(existing, incoming);
  const added = merged.length - existing.length;
  if (added > 0) await store.setPlayHistory(merged);
  return Math.max(0, added);
}

export interface PlayTally {
  key: string;
  name: string;
  artist: string;
  plays: number;
  minutes: number;
}
export interface HistoryAggregate {
  totalPlays: number;
  totalMinutes: number;
  since: string | null;
  until: string | null;
  topTracks: PlayTally[];
  topArtists: { artist: string; plays: number; minutes: number }[];
}

/** Aggregate the real, logged listening into counts and minutes. */
export function aggregatePlays(records: PlayEvent[]): HistoryAggregate {
  if (!records.length)
    return {
      totalPlays: 0,
      totalMinutes: 0,
      since: null,
      until: null,
      topTracks: [],
      topArtists: [],
    };

  const tracks = new Map<string, PlayTally>();
  const artists = new Map<string, { plays: number; ms: number }>();
  let totalMs = 0;
  let since = records[0].playedAt;
  let until = records[0].playedAt;

  for (const r of records) {
    totalMs += r.durationMs;
    if (r.playedAt < since) since = r.playedAt;
    if (r.playedAt > until) until = r.playedAt;

    const tk = r.id || `${r.artist}::${r.name}`;
    const t = tracks.get(tk) ?? {
      key: tk,
      name: r.name,
      artist: r.artist,
      plays: 0,
      minutes: 0,
    };
    t.plays += 1;
    t.minutes += r.durationMs / 60000;
    tracks.set(tk, t);

    const a = artists.get(r.artist) ?? { plays: 0, ms: 0 };
    a.plays += 1;
    a.ms += r.durationMs;
    artists.set(r.artist, a);
  }

  return {
    totalPlays: records.length,
    totalMinutes: Math.round(totalMs / 60000),
    since,
    until,
    topTracks: [...tracks.values()]
      .map((t) => ({ ...t, minutes: Math.round(t.minutes) }))
      .sort((a, b) => b.plays - a.plays || b.minutes - a.minutes)
      .slice(0, 20),
    topArtists: [...artists.entries()]
      .map(([artist, a]) => ({
        artist,
        plays: a.plays,
        minutes: Math.round(a.ms / 60000),
      }))
      .sort((a, b) => b.minutes - a.minutes || b.plays - a.plays)
      .slice(0, 20),
  };
}

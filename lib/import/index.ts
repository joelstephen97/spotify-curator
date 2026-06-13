/**
 * Parse + aggregate a Spotify privacy data export ("your data") into real
 * lifetime listening stats. Handles both shapes Spotify ships:
 *   - Extended streaming history: Streaming_History_Audio_*.json
 *       { ts, ms_played, master_metadata_track_name, master_metadata_album_artist_name }
 *   - Account-data history: StreamingHistory*.json
 *       { endTime, msPlayed, trackName, artistName }
 * Podcast/empty rows (no track name) are dropped so the numbers are music-only.
 */

export interface NormalizedPlay {
  ts: string;
  msPlayed: number;
  track: string;
  artist: string;
}

interface ExtendedRow {
  ts?: string;
  ms_played?: number;
  master_metadata_track_name?: string | null;
  master_metadata_album_artist_name?: string | null;
}
interface LegacyRow {
  endTime?: string;
  msPlayed?: number;
  trackName?: string | null;
  artistName?: string | null;
}

export function parseStreamingHistory(items: unknown[]): NormalizedPlay[] {
  const out: NormalizedPlay[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as ExtendedRow & LegacyRow;

    const track = r.master_metadata_track_name ?? r.trackName ?? null;
    const artist = r.master_metadata_album_artist_name ?? r.artistName ?? null;
    const ts = r.ts ?? r.endTime ?? null;
    const msPlayed = r.ms_played ?? r.msPlayed ?? 0;

    if (!track || !artist || !ts) continue; // skip podcasts / malformed rows
    out.push({ ts, msPlayed, track, artist });
  }
  return out;
}

/** Hour-of-day (0–23) read straight off the timestamp string, no TZ math. */
function hourOf(ts: string): number | null {
  const m = ts.match(/[T ](\d{2}):/);
  if (!m) return null;
  const h = Number(m[1]);
  return h >= 0 && h <= 23 ? h : null;
}
function yearOf(ts: string): number | null {
  const m = ts.match(/^(\d{4})/);
  if (!m) return null;
  return Number(m[1]);
}

const PLAY_THRESHOLD_MS = 30_000; // Spotify counts a "stream" at ~30s

export interface ImportAggregate {
  totalStreams: number;
  totalPlays: number; // streams over 30s
  totalMinutes: number;
  totalHours: number;
  skipRate: number; // % of streams under 30s
  since: string | null;
  until: string | null;
  topArtists: { artist: string; minutes: number; plays: number }[];
  topTracks: { name: string; artist: string; minutes: number; plays: number }[];
  byYear: { year: number; minutes: number }[];
  byHour: number[]; // length 24, minutes per hour
  generatedFromRows: number;
}

export function aggregateImport(plays: NormalizedPlay[]): ImportAggregate {
  const artists = new Map<string, { ms: number; plays: number }>();
  const tracks = new Map<string, { name: string; artist: string; ms: number; plays: number }>();
  const years = new Map<number, number>(); // year -> ms
  const byHourMs = new Array(24).fill(0);

  let totalMs = 0;
  let totalPlays = 0;
  let skips = 0;
  let since: string | null = null;
  let until: string | null = null;

  for (const p of plays) {
    totalMs += p.msPlayed;
    const isPlay = p.msPlayed >= PLAY_THRESHOLD_MS;
    if (isPlay) totalPlays += 1;
    else skips += 1;

    if (since === null || p.ts < since) since = p.ts;
    if (until === null || p.ts > until) until = p.ts;

    const a = artists.get(p.artist) ?? { ms: 0, plays: 0 };
    a.ms += p.msPlayed;
    if (isPlay) a.plays += 1;
    artists.set(p.artist, a);

    const tk = `${p.artist}::${p.track}`;
    const t = tracks.get(tk) ?? {
      name: p.track,
      artist: p.artist,
      ms: 0,
      plays: 0,
    };
    t.ms += p.msPlayed;
    if (isPlay) t.plays += 1;
    tracks.set(tk, t);

    const y = yearOf(p.ts);
    if (y) years.set(y, (years.get(y) ?? 0) + p.msPlayed);
    const h = hourOf(p.ts);
    if (h !== null) byHourMs[h] += p.msPlayed;
  }

  const totalMinutes = Math.round(totalMs / 60000);
  return {
    totalStreams: plays.length,
    totalPlays,
    totalMinutes,
    totalHours: Math.round(totalMs / 3_600_000),
    skipRate: plays.length ? Math.round((skips / plays.length) * 100) : 0,
    since,
    until,
    topArtists: [...artists.entries()]
      .map(([artist, a]) => ({
        artist,
        minutes: Math.round(a.ms / 60000),
        plays: a.plays,
      }))
      .sort((x, y) => y.minutes - x.minutes)
      .slice(0, 50),
    topTracks: [...tracks.values()]
      .map((t) => ({
        name: t.name,
        artist: t.artist,
        minutes: Math.round(t.ms / 60000),
        plays: t.plays,
      }))
      .sort((x, y) => y.plays - x.plays || y.minutes - x.minutes)
      .slice(0, 50),
    byYear: [...years.entries()]
      .map(([year, ms]) => ({ year, minutes: Math.round(ms / 60000) }))
      .sort((a, b) => a.year - b.year),
    byHour: byHourMs.map((ms) => Math.round(ms / 60000)),
    generatedFromRows: plays.length,
  };
}

/**
 * Accept the raw uploaded JSON (already parsed). It may be a single file's
 * array, or an object/array of files — we flatten any arrays of records found.
 */
export function collectRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    // Either an array of rows, or an array of file-arrays.
    if (payload.length && Array.isArray(payload[0]))
      return (payload as unknown[][]).flat();
    return payload;
  }
  if (payload && typeof payload === "object") {
    return Object.values(payload as Record<string, unknown>)
      .filter(Array.isArray)
      .flat();
  }
  return [];
}

import type { SpotifyClient } from "@/lib/spotify/client";
import type { Store } from "@/lib/store/redis";
import {
  getProfile,
  getTopArtists,
  getTopTracks,
  deriveTopGenres,
} from "@/lib/spotify/data";
import {
  listeningPersonality,
  mainstreamScore,
  averageReleaseYear,
  totalMinutes,
  type Personality,
} from "@/lib/insights";
import { aggregatePlays } from "@/lib/history";
import type { ImportAggregate } from "@/lib/import";
import { commas } from "@/lib/format";

export interface WrappedCard {
  source: "import" | "history" | "live";
  displayName: string;
  minutes: { value: number; estimated: boolean; label: string };
  topArtist: { name: string; image: string | null; detail: string };
  topTrack: { name: string; artist: string; image: string | null };
  topGenre: string | null;
  personality: Personality;
  stats: { label: string; value: string }[];
}

async function readImport(store: Store): Promise<ImportAggregate | null> {
  try {
    const raw = await store.getImportAggregate();
    return raw ? (JSON.parse(raw) as ImportAggregate) : null;
  } catch {
    return null;
  }
}

/**
 * Build the headline "year-in-review" card from the best available source:
 * imported lifetime data > logged real plays > live API estimate. Live data
 * always loads so the card never comes back empty.
 */
export async function buildWrapped(
  client: SpotifyClient,
  store: Store,
): Promise<WrappedCard> {
  const [profile, topArtists, topTracks] = await Promise.all([
    getProfile(client).catch(() => null),
    getTopArtists(client, "long_term").catch(() => []),
    getTopTracks(client, "long_term").catch(() => []),
  ]);
  const genres = deriveTopGenres(topArtists, 30);
  const personality = listeningPersonality({
    artists: topArtists,
    tracks: topTracks,
    genreCount: genres.length,
  });

  const imported = await readImport(store);
  const history = await store
    .getPlayHistory()
    .then(aggregatePlays)
    .catch(() => null);

  const artistImage = (name: string) =>
    topArtists.find((a) => a.name === name)?.image ?? null;
  const trackImage = (name: string, artist: string) =>
    topTracks.find((t) => t.name === name && t.artist === artist)?.image ?? null;

  const displayName = profile?.displayName ?? "You";
  const mainstream = mainstreamScore([...topArtists, ...topTracks]);
  const avgYear = averageReleaseYear(topTracks);
  const baseStats: { label: string; value: string }[] = [];
  if (mainstream !== null)
    baseStats.push({ label: "Mainstream", value: `${mainstream}/100` });
  if (genres.length) baseStats.push({ label: "Genres", value: commas(genres.length) });
  if (avgYear) baseStats.push({ label: "Era", value: `${avgYear}` });

  // --- Imported lifetime data wins ---
  if (imported && imported.totalMinutes > 0) {
    const a = imported.topArtists[0];
    const t = imported.topTracks[0];
    return {
      source: "import",
      displayName,
      minutes: {
        value: imported.totalMinutes,
        estimated: false,
        label: "minutes all-time",
      },
      topArtist: a
        ? { name: a.artist, image: artistImage(a.artist), detail: `${commas(a.plays)} plays` }
        : { name: "—", image: null, detail: "" },
      topTrack: t
        ? { name: t.name, artist: t.artist, image: trackImage(t.name, t.artist) }
        : { name: "—", artist: "", image: null },
      topGenre: genres[0] ?? null,
      personality,
      stats: [
        { label: "Plays", value: commas(imported.totalPlays) },
        { label: "Skip rate", value: `${imported.skipRate}%` },
        ...baseStats,
      ],
    };
  }

  // --- Logged real plays next ---
  if (history && history.totalPlays > 0) {
    const a = history.topArtists[0];
    const t = history.topTracks[0];
    return {
      source: "history",
      displayName,
      minutes: {
        value: history.totalMinutes,
        estimated: false,
        label: "minutes logged",
      },
      topArtist: a
        ? { name: a.artist, image: artistImage(a.artist), detail: `${commas(a.plays)} plays` }
        : { name: "—", image: null, detail: "" },
      topTrack: t
        ? { name: t.name, artist: t.artist, image: trackImage(t.name, t.artist) }
        : { name: "—", artist: "", image: null },
      topGenre: genres[0] ?? null,
      personality,
      stats: [
        { label: "Plays", value: commas(history.totalPlays) },
        ...baseStats,
      ],
    };
  }

  // --- Live API estimate (always available) ---
  const a = topArtists[0];
  const t = topTracks[0];
  return {
    source: "live",
    displayName,
    minutes: {
      value: totalMinutes(topTracks),
      estimated: true,
      label: "min in your top 50",
    },
    topArtist: a
      ? { name: a.name, image: a.image, detail: "#1 all-time" }
      : { name: "—", image: null, detail: "" },
    topTrack: t
      ? { name: t.name, artist: t.artist, image: t.image }
      : { name: "—", artist: "", image: null },
    topGenre: genres[0] ?? null,
    personality,
    stats: baseStats,
  };
}

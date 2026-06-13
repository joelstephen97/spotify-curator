import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import {
  getTopArtists,
  getTopTracks,
  getRecentlyPlayed,
  getRecentPlays,
  getProfile,
  getFollowedArtistsCount,
  getPlaylistCount,
  deriveTopGenres,
  type TimeRange,
} from "@/lib/spotify/data";
import {
  mainstreamScore,
  explicitShare,
  averageTrackLengthMs,
  decadeDistribution,
  perArtistMinutes,
  totalMinutes,
  listeningPersonality,
} from "@/lib/insights";
import { aggregatePlays, recordRecentPlays } from "@/lib/history";
import { userStore } from "@/lib/store/redis";

export const dynamic = "force-dynamic";

const RANGES: TimeRange[] = ["short_term", "medium_term", "long_term"];

export async function GET(req: NextRequest) {
  const param = new URL(req.url).searchParams.get("range");
  const range: TimeRange = RANGES.includes(param as TimeRange)
    ? (param as TimeRange)
    : "medium_term";

  let client, userId;
  try {
    const auth = await authedUser();
    if (!auth)
      return NextResponse.json({ error: "not_connected" }, { status: 401 });
    ({ client, userId } = auth);
  } catch (e) {
    return NextResponse.json(
      { error: "auth_failed", detail: errorMessage(e) },
      { status: 401 },
    );
  }

  try {
    const [topArtists, topTracks, recentTracks, recentPlays, profile, followed, playlists] =
      await Promise.all([
        getTopArtists(client, range),
        getTopTracks(client, range),
        getRecentlyPlayed(client).catch(() => []),
        getRecentPlays(client).catch(() => []),
        getProfile(client).catch(() => null),
        getFollowedArtistsCount(client).catch(() => 0),
        getPlaylistCount(client).catch(() => 0),
      ]);

    const topGenres = deriveTopGenres(topArtists, 18);

    // Best-effort: fold the latest plays into the persistent log and read back
    // the real, growing history. Never let storage hiccups break the page.
    let history = null;
    try {
      const store = userStore(userId);
      if (recentPlays.length) await recordRecentPlays(store, recentPlays);
      history = aggregatePlays(await store.getPlayHistory());
    } catch {
      history = null;
    }

    return NextResponse.json({
      range,
      profile,
      counts: { followedArtists: followed, playlists },
      topArtists,
      topTracks,
      recent: recentTracks,
      topGenres,
      insights: {
        mainstreamScore: mainstreamScore([...topArtists, ...topTracks]),
        explicitShare: explicitShare(topTracks),
        avgTrackLengthMs: averageTrackLengthMs(topTracks),
        topTracksMinutes: totalMinutes(topTracks),
        decades: decadeDistribution(topTracks),
        perArtistMinutes: perArtistMinutes(topTracks, 8),
        personality: listeningPersonality({
          artists: topArtists,
          tracks: topTracks,
          genreCount: topGenres.length,
        }),
      },
      history,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "spotify_failed", detail: errorMessage(e) },
      { status: 502 },
    );
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

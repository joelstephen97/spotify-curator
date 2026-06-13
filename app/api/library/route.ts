import { NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { getAllSavedTracks } from "@/lib/spotify/data";
import {
  totalMinutes,
  averageTrackLengthMs,
  decadeDistribution,
  explicitShare,
  perArtistMinutes,
} from "@/lib/insights";

export const dynamic = "force-dynamic";

// Library analysis is heavier (paginated), so it's its own endpoint the
// dashboard loads progressively after the fast stats land.
export async function GET() {
  let client;
  try {
    const auth = await authedUser();
    if (!auth)
      return NextResponse.json({ error: "not_connected" }, { status: 401 });
    client = auth.client;
  } catch {
    return NextResponse.json({ error: "auth_failed" }, { status: 401 });
  }

  try {
    const { tracks, total } = await getAllSavedTracks(client, 1000);
    const fetchedMinutes = totalMinutes(tracks);
    const avgMs = averageTrackLengthMs(tracks);
    // If the library exceeds the fetch cap, extrapolate from the sample.
    const estimatedTotalMinutes =
      tracks.length && total > tracks.length
        ? Math.round((avgMs * total) / 60000)
        : fetchedMinutes;

    return NextResponse.json({
      savedTotal: total,
      savedFetched: tracks.length,
      isEstimate: total > tracks.length,
      libraryMinutes: estimatedTotalMinutes,
      sampledMinutes: fetchedMinutes,
      avgTrackLengthMs: avgMs,
      decades: decadeDistribution(tracks),
      explicitShare: explicitShare(tracks),
      perArtistMinutes: perArtistMinutes(tracks, 10),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "spotify_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}

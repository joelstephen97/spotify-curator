import { NextRequest, NextResponse } from "next/server";
import { clientFromRequest } from "@/lib/api-auth";
import {
  getTopArtists,
  getTopTracks,
  getRecentlyPlayed,
  deriveTopGenres,
  type TimeRange,
} from "@/lib/spotify/data";

export const dynamic = "force-dynamic";

const RANGES: TimeRange[] = ["short_term", "medium_term", "long_term"];

export async function GET(req: NextRequest) {
  const param = new URL(req.url).searchParams.get("range");
  const range: TimeRange = RANGES.includes(param as TimeRange)
    ? (param as TimeRange)
    : "medium_term";

  let client;
  try {
    client = await clientFromRequest();
  } catch (e) {
    return NextResponse.json(
      { error: "auth_failed", detail: errorMessage(e) },
      { status: 401 },
    );
  }
  if (!client)
    return NextResponse.json({ error: "not_connected" }, { status: 401 });

  try {
    const [topArtists, topTracks, recent] = await Promise.all([
      getTopArtists(client, range),
      getTopTracks(client, range),
      getRecentlyPlayed(client),
    ]);
    return NextResponse.json({
      range,
      topArtists,
      topTracks,
      recent,
      topGenres: deriveTopGenres(topArtists, 18),
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

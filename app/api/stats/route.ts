import { NextResponse } from "next/server";
import { clientFromRequest } from "@/lib/api-auth";
import {
  getTopArtists,
  getTopTracks,
  getRecentlyPlayed,
  deriveTopGenres,
} from "@/lib/spotify/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = await clientFromRequest();
  if (!client)
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  const topArtists = await getTopArtists(client, "medium_term");
  return NextResponse.json({
    topArtists,
    topTracks: await getTopTracks(client, "medium_term"),
    recent: await getRecentlyPlayed(client),
    topGenres: deriveTopGenres(topArtists, 15),
  });
}

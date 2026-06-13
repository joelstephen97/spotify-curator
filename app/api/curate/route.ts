import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { getAllSavedTracks } from "@/lib/spotify/data";
import { getOrCreatePlaylist, addTracks } from "@/lib/spotify/playlist";

export const dynamic = "force-dynamic";

// Body: { name: string }
// v1 curation: build a new playlist from the user's saved (liked) tracks.
export async function POST(req: NextRequest) {
  const auth = await authedUser();
  if (!auth)
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  const { client } = auth;

  const { name } = (await req.json()) as { name?: string };
  if (!name?.trim())
    return NextResponse.json({ error: "name_required" }, { status: 400 });

  const { tracks } = await getAllSavedTracks(client);
  const playlistId = await getOrCreatePlaylist(client, name.trim());
  await addTracks(
    client,
    playlistId,
    tracks.map((t) => `spotify:track:${t.id}`),
  );
  return NextResponse.json({ playlistId, added: tracks.length });
}

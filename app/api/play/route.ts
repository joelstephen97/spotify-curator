import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { playTrack } from "@/lib/spotify/player";

export const dynamic = "force-dynamic";

// Start playback of one track on the user's active Spotify device.
export async function POST(req: NextRequest) {
  const auth = await authedUser().catch(() => null);
  if (!auth)
    return NextResponse.json({ error: "not_connected" }, { status: 401 });

  let uri: string | undefined;
  try {
    ({ uri } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!uri || !uri.startsWith("spotify:track:"))
    return NextResponse.json({ error: "bad_uri" }, { status: 400 });

  const result = await playTrack(auth.client, uri);
  if (result.ok) return NextResponse.json({ ok: true });
  return NextResponse.json(
    { ok: false, reason: result.reason, detail: result.detail },
    {
      status:
        result.reason === "no_device"
          ? 409
          : result.reason === "needs_reconnect"
            ? 401
            : 502,
    },
  );
}

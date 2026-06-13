import { NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { playAll } from "@/lib/spotify/player";
import { userStore } from "@/lib/store/redis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Play the latest discovery picks: start the first, queue the rest onto the
// user's active device. The individual-dev-app substitute for "add all to a
// playlist" (playlist writes are blocked in Development Mode).
export async function POST() {
  const auth = await authedUser().catch(() => null);
  if (!auth)
    return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const picks = await userStore(auth.userId).getLatestPicks();
  const uris = picks.map((p) => p.uri).filter(Boolean);
  if (!uris.length)
    return NextResponse.json({ error: "no_picks" }, { status: 422 });

  const result = await playAll(auth.client, uris);
  if (result.ok)
    return NextResponse.json({ ok: true, queued: result.queued, total: uris.length });
  return NextResponse.json(
    { ok: false, reason: result.reason, detail: result.detail },
    { status: result.reason === "no_device" ? 409 : 502 },
  );
}

import { NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { runDiscoveryForUser } from "@/lib/discovery/run";
import { userStore } from "@/lib/store/redis";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Latest AI picks (with reasons) for the connected user's discoveries view.
export async function GET() {
  const auth = await authedUser().catch(() => null);
  if (!auth)
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  return NextResponse.json({
    picks: await userStore(auth.userId).getLatestPicks(),
  });
}

// Manual discovery trigger — runs for the connected user only.
export async function POST() {
  const auth = await authedUser().catch(() => null);
  if (!auth)
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  const result = await runDiscoveryForUser(auth.userId);
  if (!result.ok)
    return NextResponse.json({ error: result.reason }, { status: 412 });
  return NextResponse.json({ added: result.added.length, picks: result.added });
}

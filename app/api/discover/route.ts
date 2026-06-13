import { NextResponse } from "next/server";
import { clientFromRequest } from "@/lib/api-auth";
import { runScheduledDiscovery } from "@/lib/discovery/run";
import { defaultStore } from "@/lib/store/redis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Latest AI picks (with reasons) for the discoveries view.
export async function GET() {
  return NextResponse.json({ picks: await defaultStore().getLatestPicks() });
}

// Manual discovery trigger — requires a connected dashboard user.
export async function POST() {
  const client = await clientFromRequest();
  if (!client)
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  const result = await runScheduledDiscovery();
  if (!result.ok)
    return NextResponse.json({ error: result.reason }, { status: 412 });
  return NextResponse.json({ added: result.added.length, picks: result.added });
}

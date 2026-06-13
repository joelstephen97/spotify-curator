import { NextRequest, NextResponse } from "next/server";
import { runScheduledDiscovery } from "@/lib/discovery/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runScheduledDiscovery();
  if (!result.ok)
    return NextResponse.json({ error: result.reason }, { status: 412 });
  return NextResponse.json({ added: result.added.length, picks: result.added });
}

import { NextRequest, NextResponse } from "next/server";
import { runAllUsers } from "@/lib/discovery/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Weekly fan-out: run discovery for every connected user.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const summaries = await runAllUsers();
  return NextResponse.json({
    users: summaries.length,
    totalAdded: summaries.reduce((s, u) => s + u.added, 0),
    summaries,
  });
}

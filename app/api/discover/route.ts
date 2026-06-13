import { NextResponse, after } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { runDiscoveryForUser, readStatus } from "@/lib/discovery/run";
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

// Kick discovery off in the BACKGROUND and return immediately. The work keeps
// running after the response (via after()), writing progress to Redis, so the
// user can close the tab and come back. Poll /api/discover/status for progress.
export async function POST() {
  const auth = await authedUser().catch(() => null);
  if (!auth)
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  const { userId } = auth;

  const status = await readStatus(userId);
  const tenMinAgo = Date.now() - 10 * 60 * 1000;
  if (status.state === "running" && status.startedAt > tenMinAgo) {
    return NextResponse.json({ state: "running", step: status.step });
  }

  // Mark running right away so the very first poll sees it.
  await userStore(userId).setDiscoveryStatus(
    JSON.stringify({ state: "running", step: "Starting…", startedAt: Date.now() }),
  );

  after(async () => {
    try {
      await runDiscoveryForUser(userId);
    } catch {
      /* error status already persisted inside runDiscoveryForUser */
    }
  });

  return NextResponse.json({ state: "running", step: "Starting…" });
}

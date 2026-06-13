import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import type { ImportAggregate } from "@/lib/import";
import { userStore } from "@/lib/store/redis";

export const dynamic = "force-dynamic";

// The browser parses the (large) streaming-history files and computes the
// aggregate locally; we only receive and persist the small summary. This keeps
// raw listening data on the device and stays well under serverless body limits.
export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await authedUser();
  } catch {
    return NextResponse.json({ error: "auth_failed" }, { status: 401 });
  }
  if (!auth)
    return NextResponse.json({ error: "not_connected" }, { status: 401 });

  let payload: { aggregate?: ImportAggregate };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const agg = payload?.aggregate;
  if (
    !agg ||
    typeof agg.totalMinutes !== "number" ||
    !Array.isArray(agg.topArtists)
  ) {
    return NextResponse.json({ error: "invalid_aggregate" }, { status: 422 });
  }

  try {
    await userStore(auth.userId).setImportAggregate(JSON.stringify(agg));
  } catch (e) {
    return NextResponse.json(
      { error: "store_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    summary: {
      totalMinutes: agg.totalMinutes,
      totalHours: agg.totalHours,
      totalPlays: agg.totalPlays,
      topArtist: agg.topArtists[0]?.artist ?? null,
      since: agg.since,
      until: agg.until,
    },
  });
}

// Surface whether an import already exists (so the UI can show its state).
export async function GET() {
  const auth = await authedUser().catch(() => null);
  if (!auth) return NextResponse.json({ imported: false });
  try {
    const raw = await userStore(auth.userId).getImportAggregate();
    return NextResponse.json({ imported: Boolean(raw) });
  } catch {
    return NextResponse.json({ imported: false });
  }
}

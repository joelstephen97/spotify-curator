import { NextRequest, NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { parseStreamingHistory, aggregateImport, collectRows } from "@/lib/import";
import { userStore } from "@/lib/store/redis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Accept the user's Spotify "Extended streaming history" JSON, aggregate it
// into real lifetime stats, and persist the summary (not the raw rows).
export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await authedUser();
  } catch {
    return NextResponse.json({ error: "auth_failed" }, { status: 401 });
  }
  if (!auth)
    return NextResponse.json({ error: "not_connected" }, { status: 401 });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rows = collectRows(payload);
  if (!rows.length)
    return NextResponse.json({ error: "no_rows" }, { status: 422 });

  const plays = parseStreamingHistory(rows);
  if (!plays.length)
    return NextResponse.json(
      { error: "no_music_rows", detail: "No music streams found in that file." },
      { status: 422 },
    );

  const aggregate = aggregateImport(plays);
  try {
    await userStore(auth.userId).setImportAggregate(JSON.stringify(aggregate));
  } catch (e) {
    return NextResponse.json(
      { error: "store_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    summary: {
      totalMinutes: aggregate.totalMinutes,
      totalHours: aggregate.totalHours,
      totalPlays: aggregate.totalPlays,
      topArtist: aggregate.topArtists[0]?.artist ?? null,
      since: aggregate.since,
      until: aggregate.until,
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

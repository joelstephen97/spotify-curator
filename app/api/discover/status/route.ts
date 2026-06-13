import { NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { readStatus } from "@/lib/discovery/run";

export const dynamic = "force-dynamic";

// Live discovery progress for the connected user (polled by the UI).
export async function GET() {
  const auth = await authedUser().catch(() => null);
  if (!auth)
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  return NextResponse.json(await readStatus(auth.userId));
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { unsealSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Lightweight connection check for the nav — no Spotify call, just the cookie.
export async function GET() {
  const raw = (await cookies()).get("session")?.value;
  const session = raw ? unsealSession(raw, process.env.SESSION_SECRET!) : null;
  return NextResponse.json({ connected: Boolean(session?.userId) });
}

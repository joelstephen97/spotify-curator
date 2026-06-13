import { NextResponse } from "next/server";
import { authedUser } from "@/lib/api-auth";
import { buildWrapped } from "@/lib/wrapped";
import { userStore } from "@/lib/store/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  let auth;
  try {
    auth = await authedUser();
  } catch {
    return NextResponse.json({ error: "auth_failed" }, { status: 401 });
  }
  if (!auth)
    return NextResponse.json({ error: "not_connected" }, { status: 401 });

  try {
    const card = await buildWrapped(auth.client, userStore(auth.userId));
    return NextResponse.json(card);
  } catch (e) {
    return NextResponse.json(
      { error: "wrapped_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}

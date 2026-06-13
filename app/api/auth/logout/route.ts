import { NextRequest, NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/http";

export const dynamic = "force-dynamic";

// Clear the browser session and return home (on the host the user is actually
// using, not the localhost req.url normalizes to). The stored refresh token is
// left intact so the weekly bot keeps running; reconnecting restores the app.
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", appBaseUrl(req)));
  res.cookies.set("session", "", { path: "/", maxAge: 0 });
  res.cookies.set("oauth_state", "", { path: "/", maxAge: 0 });
  return res;
}

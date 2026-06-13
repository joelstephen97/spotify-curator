import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Clear the browser session and return home. The stored refresh token is left
// intact so the weekly bot keeps running; reconnecting restores the dashboard.
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("session", "", { path: "/", maxAge: 0 });
  res.cookies.set("oauth_state", "", { path: "/", maxAge: 0 });
  return res;
}

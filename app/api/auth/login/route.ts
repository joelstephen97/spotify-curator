import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { buildAuthorizeUrl, spotifyConfig } from "@/lib/spotify/auth";

export const dynamic = "force-dynamic";

// `secure` cookies are dropped by browsers over plain http (local dev on
// 127.0.0.1), which would lose the OAuth state cookie. Only require it in prod.
const SECURE = process.env.NODE_ENV === "production";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthorizeUrl(spotifyConfig(), state));
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes — the OAuth round-trip window
  });
  return res;
}

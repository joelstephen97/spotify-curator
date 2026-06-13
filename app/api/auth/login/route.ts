import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { buildAuthorizeUrl, spotifyConfig } from "@/lib/spotify/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthorizeUrl(spotifyConfig(), state));
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}

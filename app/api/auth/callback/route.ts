import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, spotifyConfig } from "@/lib/spotify/auth";
import { sealSession } from "@/lib/session";
import { defaultStore } from "@/lib/store/redis";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("oauth_state")?.value;
  if (!code || !state || state !== cookieState) {
    return NextResponse.json({ error: "invalid_oauth_state" }, { status: 400 });
  }

  const tokens = await exchangeCode(spotifyConfig(), code);
  if (tokens.refreshToken)
    await defaultStore().setRefreshToken(tokens.refreshToken);

  const session = sealSession(
    {
      accessToken: tokens.accessToken,
      expiresAt: Date.now() + tokens.expiresIn * 1000,
    },
    process.env.SESSION_SECRET!,
  );
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("session", session, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}

import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, spotifyConfig } from "@/lib/spotify/auth";
import { sealSession } from "@/lib/session";
import { SpotifyClient } from "@/lib/spotify/client";
import { getProfile } from "@/lib/spotify/data";
import { userStore, registry } from "@/lib/store/redis";
import { appBaseUrl } from "@/lib/http";

export const dynamic = "force-dynamic";

const SECURE = process.env.NODE_ENV === "production";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // Redirect on the host the user actually used (req.url is normalized to
  // localhost in dev, which would break cookies set on 127.0.0.1).
  const home = new URL("/", appBaseUrl(req));

  // Always land the user back in the app — never dump a raw JSON/error page.
  const fail = (reason: string, detail?: string) => {
    home.searchParams.set("auth_error", reason);
    if (detail) home.searchParams.set("auth_detail", detail.slice(0, 300));
    return NextResponse.redirect(home);
  };

  try {
    const spotifyError = url.searchParams.get("error"); // e.g. access_denied
    if (spotifyError) return fail(spotifyError);

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieState = req.cookies.get("oauth_state")?.value;
    if (!code || !state || state !== cookieState) return fail("state_mismatch");

    const tokens = await exchangeCode(spotifyConfig(), code);

    // Identify the user so all their data is namespaced and the weekly bot can
    // find them later.
    const profile = await getProfile(new SpotifyClient(tokens.accessToken));
    const store = userStore(profile.id);
    if (tokens.refreshToken) await store.setRefreshToken(tokens.refreshToken);
    await registry().addUser(profile.id);

    const session = sealSession(
      {
        userId: profile.id,
        accessToken: tokens.accessToken,
        expiresAt: Date.now() + tokens.expiresIn * 1000,
      },
      process.env.SESSION_SECRET!,
    );

    const res = NextResponse.redirect(home);
    res.cookies.set("session", session, {
      httpOnly: true,
      secure: SECURE,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days; access token is refreshed as needed
    });
    res.cookies.set("oauth_state", "", { path: "/", maxAge: 0 }); // clear
    return res;
  } catch (e) {
    // Surface the real cause — in the server logs AND back to the app UI —
    // otherwise every failure looks identical.
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[auth/callback] login failed:", e);
    return fail("exchange_failed", detail);
  }
}

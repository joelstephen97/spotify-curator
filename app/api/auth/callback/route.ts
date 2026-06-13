import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, spotifyConfig } from "@/lib/spotify/auth";
import { sealSession } from "@/lib/session";
import { SpotifyClient } from "@/lib/spotify/client";
import { getProfile } from "@/lib/spotify/data";
import { userStore, registry } from "@/lib/store/redis";
import { appBaseUrl } from "@/lib/http";

export const dynamic = "force-dynamic";

const SECURE = process.env.NODE_ENV === "production";

// Map a raw exception to a SAFE, fixed discriminator. The full error is logged
// server-side only; we never put response bodies / messages in the redirect URL.
function classifyAuthError(msg: string): string {
  if (/invalid_grant/i.test(msg)) return "invalid_grant";
  if (/invalid_client/i.test(msg)) return "invalid_client";
  if (/redirect/i.test(msg)) return "redirect_mismatch";
  if (/GET \/me|profile/i.test(msg)) return "profile_unavailable";
  if (/upstash|redis|ECONN|ENOTFOUND|fetch failed/i.test(msg))
    return "store_unavailable";
  if (/SESSION_SECRET|hmac|"key" argument/i.test(msg)) return "session_config";
  const status = msg.match(/token request failed: (\d{3})/);
  if (status) return `token_${status[1]}`;
  return "unknown";
}

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
    // Full detail to the server log ONLY; a safe enum to the client.
    console.error("[auth/callback] login failed:", e);
    const code = classifyAuthError(e instanceof Error ? e.message : String(e));
    return fail("exchange_failed", code);
  }
}

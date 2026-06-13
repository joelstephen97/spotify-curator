import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, spotifyConfig } from "@/lib/spotify/auth";
import { sealSession } from "@/lib/session";
import { defaultStore } from "@/lib/store/redis";

export const dynamic = "force-dynamic";

const SECURE = process.env.NODE_ENV === "production";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const home = new URL("/", req.url);

  // Always land the user back in the app — never dump a raw JSON/error page.
  const fail = (reason: string) => {
    home.searchParams.set("auth_error", reason);
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
    if (tokens.refreshToken)
      await defaultStore().setRefreshToken(tokens.refreshToken);

    const session = sealSession(
      {
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
  } catch {
    return fail("exchange_failed");
  }
}

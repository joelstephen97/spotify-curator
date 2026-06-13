import { cookies } from "next/headers";
import { unsealSession } from "@/lib/session";
import { refreshAccessToken, spotifyConfig } from "@/lib/spotify/auth";
import { SpotifyClient } from "@/lib/spotify/client";
import { defaultStore } from "@/lib/store/redis";

/**
 * Build a SpotifyClient for the current dashboard user. Prefers the access
 * token in the session cookie; falls back to refreshing the stored token.
 * Returns null when the user has never connected Spotify.
 */
export async function clientFromRequest(): Promise<SpotifyClient | null> {
  const raw = (await cookies()).get("session")?.value;
  const session = raw ? unsealSession(raw, process.env.SESSION_SECRET!) : null;
  if (session && session.expiresAt > Date.now())
    return new SpotifyClient(session.accessToken);

  const refresh = await defaultStore().getRefreshToken();
  if (!refresh) return null;
  const tokens = await refreshAccessToken(spotifyConfig(), refresh);
  return new SpotifyClient(tokens.accessToken);
}

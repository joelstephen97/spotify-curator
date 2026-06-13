import { cookies } from "next/headers";
import { unsealSession } from "@/lib/session";
import { refreshAccessToken, spotifyConfig } from "@/lib/spotify/auth";
import { SpotifyClient } from "@/lib/spotify/client";
import { userStore } from "@/lib/store/redis";

export interface Authed {
  client: SpotifyClient;
  userId: string;
}

/**
 * Resolve the connected user from the signed session cookie. Identity always
 * comes from the cookie (which carries the Spotify user id); when the cached
 * access token has expired we mint a fresh one from that user's stored refresh
 * token. Returns null when nobody is connected in this browser.
 */
export async function authedUser(): Promise<Authed | null> {
  const raw = (await cookies()).get("session")?.value;
  const session = raw ? unsealSession(raw, process.env.SESSION_SECRET!) : null;
  if (!session?.userId) return null;

  if (session.expiresAt > Date.now())
    return {
      client: new SpotifyClient(session.accessToken),
      userId: session.userId,
    };

  const refresh = await userStore(session.userId).getRefreshToken();
  if (!refresh) return null;
  const tokens = await refreshAccessToken(spotifyConfig(), refresh);
  return {
    client: new SpotifyClient(tokens.accessToken),
    userId: session.userId,
  };
}

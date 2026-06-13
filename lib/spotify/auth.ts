export interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}
export interface Tokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

const SCOPES = [
  "user-top-read",
  "user-read-recently-played",
  "user-library-read",
  "playlist-read-private",
  "playlist-modify-private",
  "playlist-modify-public",
].join(" ");

export function spotifyConfig(): SpotifyConfig {
  return {
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI!,
  };
}

export function buildAuthorizeUrl(cfg: SpotifyConfig, state: string): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    scope: SCOPES,
    redirect_uri: cfg.redirectUri,
    state,
  });
  return `https://accounts.spotify.com/authorize?${p.toString()}`;
}

function basicAuth(cfg: SpotifyConfig) {
  return (
    "Basic " +
    Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")
  );
}

async function tokenRequest(
  cfg: SpotifyConfig,
  body: URLSearchParams,
  f: typeof fetch,
): Promise<Tokens> {
  const res = await f("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth(cfg),
    },
    body,
  });
  if (!res.ok) throw new Error(`token request failed: ${res.status}`);
  const j = await res.json();
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresIn: j.expires_in,
  };
}

export function exchangeCode(
  cfg: SpotifyConfig,
  code: string,
  f: typeof fetch = fetch,
) {
  return tokenRequest(
    cfg,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
    }),
    f,
  );
}

export function refreshAccessToken(
  cfg: SpotifyConfig,
  refreshToken: string,
  f: typeof fetch = fetch,
) {
  return tokenRequest(
    cfg,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    f,
  );
}

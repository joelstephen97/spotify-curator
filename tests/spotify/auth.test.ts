import { describe, it, expect, vi } from "vitest";
import {
  buildAuthorizeUrl,
  exchangeCode,
  refreshAccessToken,
} from "@/lib/spotify/auth";

const cfg = {
  clientId: "cid",
  clientSecret: "secret",
  redirectUri: "http://127.0.0.1:3000/api/auth/callback",
};

describe("spotify auth", () => {
  it("builds an authorize URL with scopes and state", () => {
    const url = new URL(buildAuthorizeUrl(cfg, "xyz"));
    expect(url.origin + url.pathname).toBe(
      "https://accounts.spotify.com/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("state")).toBe("xyz");
    expect(url.searchParams.get("scope")).toContain("playlist-modify-private");
  });

  it("exchanges a code for tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "at",
          refresh_token: "rt",
          expires_in: 3600,
        }),
        { status: 200 },
      ),
    );
    const t = await exchangeCode(cfg, "the-code", fetchMock);
    expect(t).toEqual({ accessToken: "at", refreshToken: "rt", expiresIn: 3600 });
    const [, init] = fetchMock.mock.calls[0];
    expect(String(init.body)).toContain("grant_type=authorization_code");
  });

  it("refreshes an access token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "at2", expires_in: 3600 }),
        { status: 200 },
      ),
    );
    const t = await refreshAccessToken(cfg, "rt", fetchMock);
    expect(t.accessToken).toBe("at2");
  });
});

import { describe, it, expect, vi } from "vitest";
import { SpotifyClient } from "@/lib/spotify/client";

describe("SpotifyClient", () => {
  it("GETs JSON with a bearer token", async () => {
    const f = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const c = new SpotifyClient("token-1", f);
    const data = await c.get<{ ok: boolean }>("/me");
    expect(data.ok).toBe(true);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.spotify.com/v1/me");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer token-1",
    );
  });

  it("retries once on 429 honoring Retry-After", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("", { status: 429, headers: { "Retry-After": "0" } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    const c = new SpotifyClient("t", f);
    const data = await c.get<{ ok: boolean }>("/me");
    expect(data.ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("throws on non-ok, non-429 responses", async () => {
    const f = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    const c = new SpotifyClient("t", f);
    await expect(c.get("/me")).rejects.toThrow(/500/);
  });

  it("sends a DELETE body via del()", async () => {
    const f = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    const c = new SpotifyClient("t", f);
    await c.del("/playlists/p1/tracks", { tracks: [{ uri: "spotify:track:1" }] });
    const [url, init] = f.mock.calls[0];
    expect(url).toContain("/playlists/p1/tracks");
    expect(init.method).toBe("DELETE");
    expect(String(init.body)).toContain("spotify:track:1");
  });
});

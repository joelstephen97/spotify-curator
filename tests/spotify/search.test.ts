import { describe, it, expect, vi } from "vitest";
import { resolveTrack } from "@/lib/spotify/search";
import { SpotifyClient } from "@/lib/spotify/client";

function clientReturning(payload: unknown) {
  const f = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
  return new SpotifyClient("t", f);
}

describe("resolveTrack", () => {
  it("returns the most popular match with its art and preview", async () => {
    const c = clientReturning({
      tracks: {
        items: [
          { uri: "spotify:track:low", popularity: 10 },
          {
            uri: "spotify:track:high",
            popularity: 90,
            preview_url: "https://p.scdn.co/mp3-preview/abc",
            album: { images: [{ url: "https://img/cover.jpg" }] },
          },
        ],
      },
    });
    expect(await resolveTrack(c, { artist: "A", title: "X" })).toEqual({
      uri: "spotify:track:high",
      image: "https://img/cover.jpg",
      previewUrl: "https://p.scdn.co/mp3-preview/abc",
    });
  });

  it("handles a missing preview (Spotify deprecation) gracefully", async () => {
    const c = clientReturning({
      tracks: { items: [{ uri: "spotify:track:x", popularity: 50 }] },
    });
    expect(await resolveTrack(c, { artist: "A", title: "X" })).toEqual({
      uri: "spotify:track:x",
      image: null,
      previewUrl: null,
    });
  });

  it("returns null when nothing is found", async () => {
    const c = clientReturning({ tracks: { items: [] } });
    expect(await resolveTrack(c, { artist: "A", title: "Nope" })).toBeNull();
  });
});

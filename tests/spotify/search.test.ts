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
  it("returns the most popular matching track uri", async () => {
    const c = clientReturning({
      tracks: {
        items: [
          { uri: "spotify:track:low", popularity: 10, name: "X", artists: [{ name: "A" }] },
          { uri: "spotify:track:high", popularity: 90, name: "X", artists: [{ name: "A" }] },
        ],
      },
    });
    expect(await resolveTrack(c, { artist: "A", title: "X" })).toBe(
      "spotify:track:high",
    );
  });

  it("returns null when nothing is found", async () => {
    const c = clientReturning({ tracks: { items: [] } });
    expect(await resolveTrack(c, { artist: "A", title: "Nope" })).toBeNull();
  });
});

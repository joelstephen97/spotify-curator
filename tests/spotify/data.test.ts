import { describe, it, expect, vi } from "vitest";
import {
  getTopArtists,
  getRecentlyPlayed,
  deriveTopGenres,
} from "@/lib/spotify/data";
import { SpotifyClient } from "@/lib/spotify/client";

function clientReturning(payload: unknown) {
  const f = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
  return new SpotifyClient("t", f);
}

describe("spotify data", () => {
  it("maps top artists", async () => {
    const c = clientReturning({
      items: [{ id: "1", name: "Radiohead", genres: ["alt rock"] }],
    });
    const artists = await getTopArtists(c, "medium_term");
    expect(artists[0]).toEqual({
      id: "1",
      name: "Radiohead",
      genres: ["alt rock"],
    });
  });

  it("maps recently played to track names", async () => {
    const c = clientReturning({
      items: [
        {
          track: {
            id: "9",
            name: "Idioteque",
            artists: [{ name: "Radiohead" }],
          },
        },
      ],
    });
    const recent = await getRecentlyPlayed(c);
    expect(recent[0]).toEqual({ id: "9", name: "Idioteque", artist: "Radiohead" });
  });

  it("derives top genres by frequency", () => {
    const genres = deriveTopGenres(
      [
        { id: "1", name: "A", genres: ["rock", "indie"] },
        { id: "2", name: "B", genres: ["rock"] },
      ],
      1,
    );
    expect(genres).toEqual(["rock"]);
  });
});

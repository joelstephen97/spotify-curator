import { describe, it, expect, vi } from "vitest";
import {
  getTopArtists,
  getTopTracks,
  getRecentlyPlayed,
  getRecentPlays,
  getAllSavedTracks,
  getFollowedArtistsCount,
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
  it("maps top artists with image, popularity and followers", async () => {
    const c = clientReturning({
      items: [
        {
          id: "1",
          name: "Radiohead",
          genres: ["alt rock"],
          images: [{ url: "https://img/rh.jpg" }],
          popularity: 82,
          followers: { total: 9000000 },
        },
      ],
    });
    const artists = await getTopArtists(c, "medium_term");
    expect(artists[0]).toEqual({
      id: "1",
      name: "Radiohead",
      genres: ["alt rock"],
      image: "https://img/rh.jpg",
      popularity: 82,
      followers: 9000000,
    });
  });

  it("maps top tracks with duration, year, explicit and uri", async () => {
    const c = clientReturning({
      items: [
        {
          id: "9",
          name: "Idioteque",
          uri: "spotify:track:9",
          duration_ms: 230000,
          popularity: 55,
          explicit: false,
          artists: [{ name: "Radiohead" }],
          album: {
            name: "Kid A",
            images: [{ url: "https://img/kida.jpg" }],
            release_date: "2000-10-02",
          },
        },
      ],
    });
    const tracks = await getTopTracks(c, "long_term");
    expect(tracks[0]).toEqual({
      id: "9",
      name: "Idioteque",
      artist: "Radiohead",
      image: "https://img/kida.jpg",
      durationMs: 230000,
      popularity: 55,
      explicit: false,
      releaseYear: 2000,
      album: "Kid A",
      uri: "spotify:track:9",
    });
  });

  it("maps recently played with album art", async () => {
    const c = clientReturning({
      items: [
        {
          track: {
            id: "9",
            name: "Idioteque",
            artists: [{ name: "Radiohead" }],
            album: { images: [{ url: "https://img/kida.jpg" }] },
          },
        },
      ],
    });
    const recent = await getRecentlyPlayed(c);
    expect(recent[0].name).toBe("Idioteque");
    expect(recent[0].image).toBe("https://img/kida.jpg");
  });

  it("maps recent plays with their timestamps", async () => {
    const c = clientReturning({
      items: [
        {
          played_at: "2026-06-13T10:00:00.000Z",
          track: {
            id: "9",
            name: "Idioteque",
            duration_ms: 230000,
            artists: [{ name: "Radiohead" }],
          },
        },
      ],
    });
    const plays = await getRecentPlays(c);
    expect(plays[0]).toEqual({
      playedAt: "2026-06-13T10:00:00.000Z",
      id: "9",
      name: "Idioteque",
      artist: "Radiohead",
      durationMs: 230000,
    });
  });

  it("paginates saved tracks and reports the true total", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            total: 70,
            next: "next",
            items: [
              { track: { id: "a", name: "A", artists: [{ name: "x" }] } },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            total: 70,
            next: null,
            items: [
              { track: { id: "b", name: "B", artists: [{ name: "y" }] } },
              { track: null }, // unavailable track is skipped
            ],
          }),
          { status: 200 },
        ),
      );
    const { tracks, total } = await getAllSavedTracks(new SpotifyClient("t", f));
    expect(total).toBe(70);
    expect(tracks.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("reads the followed-artist count", async () => {
    const c = clientReturning({ artists: { total: 137 } });
    expect(await getFollowedArtistsCount(c)).toBe(137);
  });

  it("derives top genres by frequency", () => {
    const genres = deriveTopGenres(
      [
        { id: "1", name: "A", genres: ["rock", "indie"], image: null },
        { id: "2", name: "B", genres: ["rock"], image: null },
      ],
      1,
    );
    expect(genres).toEqual(["rock"]);
  });
});

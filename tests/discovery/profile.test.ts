import { describe, it, expect } from "vitest";
import { buildProfile, seenKeys } from "@/lib/discovery/profile";

const artists = [{ id: "1", name: "Radiohead", genres: ["alt rock", "indie"] }];
const tracks = [{ id: "9", name: "Idioteque", artist: "Radiohead" }];

describe("profile", () => {
  it("summarizes genres and representative artists/tracks", () => {
    const p = buildProfile({ topArtists: artists, topTracks: tracks, recent: tracks });
    expect(p.topGenres).toContain("alt rock");
    expect(p.artists).toContain("Radiohead");
    expect(p.recentTracks[0]).toBe("Idioteque — Radiohead");
  });

  it("produces lowercase seen keys for artists and tracks", () => {
    const keys = seenKeys({ topArtists: artists, topTracks: tracks, recent: [] });
    expect(keys).toContain("artist:radiohead");
    expect(keys).toContain("track:radiohead - idioteque");
  });
});

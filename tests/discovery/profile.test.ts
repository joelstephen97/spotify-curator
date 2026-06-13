import { describe, it, expect } from "vitest";
import { buildProfile, seenKeys } from "@/lib/discovery/profile";

const artists = [
  { id: "1", name: "Radiohead", genres: ["alt rock", "indie"], image: null },
];
const tracks = [
  { id: "9", name: "Idioteque", artist: "Radiohead", image: null },
];

describe("profile", () => {
  it("summarizes genres and representative artists", () => {
    const p = buildProfile({ topArtists: artists, topTracks: tracks, recent: tracks });
    expect(p.topGenres).toContain("alt rock");
    expect(p.artists).toContain("Radiohead");
    // recent plays are intentionally NOT used as a taste signal
    expect(p).not.toHaveProperty("recentTracks");
  });

  it("produces lowercase seen keys for artists and tracks", () => {
    const keys = seenKeys({ topArtists: artists, topTracks: tracks, recent: [] });
    expect(keys).toContain("artist:radiohead");
    expect(keys).toContain("track:radiohead - idioteque");
  });

  it("uses liked songs for taste (lovedTracks + avoid-artists) and dedups them", () => {
    const saved = [
      { id: "s1", name: "Roads", artist: "Portishead", image: null },
      { id: "s2", name: "Glory Box", artist: "Portishead", image: null },
    ];
    const p = buildProfile({ topArtists: artists, topTracks: [], recent: [], saved });
    expect(p.lovedTracks).toContain("Roads — Portishead");
    expect(p.artists).toContain("Portishead"); // most-liked artist merged in

    const keys = seenKeys({ topArtists: artists, topTracks: [], recent: [], saved });
    expect(keys).toContain("track:portishead - roads"); // exact liked song deduped
  });
});

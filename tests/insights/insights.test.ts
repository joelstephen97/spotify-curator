import { describe, it, expect } from "vitest";
import {
  totalMinutes,
  averageTrackLengthMs,
  perArtistMinutes,
  decadeDistribution,
  mainstreamScore,
  explicitShare,
  averageReleaseYear,
  listeningPersonality,
} from "@/lib/insights";
import type { Artist, Track } from "@/lib/spotify/data";

const track = (p: Partial<Track>): Track => ({
  id: p.id ?? "x",
  name: p.name ?? "t",
  artist: p.artist ?? "A",
  image: null,
  ...p,
});

describe("insights", () => {
  it("sums total minutes from durations", () => {
    expect(
      totalMinutes([
        track({ durationMs: 180000 }),
        track({ durationMs: 240000 }),
      ]),
    ).toBe(7); // 7.0 min
  });

  it("computes average track length, ignoring missing durations", () => {
    expect(
      averageTrackLengthMs([
        track({ durationMs: 200000 }),
        track({ durationMs: 100000 }),
        track({}),
      ]),
    ).toBe(150000);
  });

  it("groups minutes by artist, biggest first", () => {
    const res = perArtistMinutes([
      track({ artist: "A", durationMs: 600000 }),
      track({ artist: "B", durationMs: 120000 }),
      track({ artist: "A", durationMs: 600000 }),
    ]);
    expect(res[0]).toEqual({ artist: "A", minutes: 20, tracks: 2 });
    expect(res[1]).toEqual({ artist: "B", minutes: 2, tracks: 1 });
  });

  it("buckets tracks into decades, ascending", () => {
    const res = decadeDistribution([
      track({ releaseYear: 1994 }),
      track({ releaseYear: 1999 }),
      track({ releaseYear: 2021 }),
    ]);
    expect(res).toEqual([
      { decade: "1990s", count: 2 },
      { decade: "2020s", count: 1 },
    ]);
  });

  it("averages popularity for the mainstream score, null when absent", () => {
    expect(mainstreamScore([{ popularity: 80 }, { popularity: 60 }])).toBe(70);
    expect(mainstreamScore([{}])).toBeNull();
  });

  it("computes explicit share as a percentage", () => {
    expect(
      explicitShare([
        track({ explicit: true }),
        track({ explicit: false }),
        track({ explicit: false }),
        track({ explicit: true }),
      ]),
    ).toBe(50);
  });

  it("averages release year", () => {
    expect(
      averageReleaseYear([track({ releaseYear: 2000 }), track({ releaseYear: 2010 })]),
    ).toBe(2005);
  });

  it("labels a mainstream, wide, current listener The Tastemaker", () => {
    const artists: Artist[] = [
      { id: "1", name: "A", genres: [], image: null, popularity: 80 },
    ];
    const tracks = [track({ popularity: 80, releaseYear: 2022 })];
    const p = listeningPersonality({ artists, tracks, genreCount: 14 });
    expect(p.title).toBe("The Tastemaker");
    expect(p.traits.some((t) => t.includes("mainstream"))).toBe(true);
  });

  it("labels an obscure, focused, old-music listener a Vintage Specialist", () => {
    const artists: Artist[] = [
      { id: "1", name: "A", genres: [], image: null, popularity: 20 },
    ];
    const tracks = [track({ popularity: 20, releaseYear: 1985 })];
    const p = listeningPersonality({ artists, tracks, genreCount: 3 });
    expect(p.title).toBe("Vintage Specialist");
    expect(p.traits.some((t) => t.includes("underground"))).toBe(true);
  });
});

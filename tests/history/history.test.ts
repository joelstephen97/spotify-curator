import { describe, it, expect } from "vitest";
import { mergePlays, aggregatePlays } from "@/lib/history";
import type { PlayEvent } from "@/lib/spotify/data";

const ev = (playedAt: string, p: Partial<PlayEvent> = {}): PlayEvent => ({
  playedAt,
  id: p.id ?? "t1",
  name: p.name ?? "Song",
  artist: p.artist ?? "A",
  durationMs: p.durationMs ?? 180000,
});

describe("history logger", () => {
  it("dedups on playedAt and keeps newest first", () => {
    const existing = [ev("2026-06-10T00:00:00Z")];
    const incoming = [
      ev("2026-06-10T00:00:00Z"), // duplicate
      ev("2026-06-12T00:00:00Z"),
      ev("2026-06-11T00:00:00Z"),
    ];
    const merged = mergePlays(existing, incoming);
    expect(merged.map((e) => e.playedAt)).toEqual([
      "2026-06-12T00:00:00Z",
      "2026-06-11T00:00:00Z",
      "2026-06-10T00:00:00Z",
    ]);
  });

  it("caps the log", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      ev(`2026-06-${String(i + 1).padStart(2, "0")}T00:00:00Z`),
    );
    expect(mergePlays([], many, 3)).toHaveLength(3);
  });

  it("aggregates plays into counts and minutes", () => {
    const agg = aggregatePlays([
      ev("2026-06-10T00:00:00Z", { id: "a", artist: "X", durationMs: 240000 }),
      ev("2026-06-11T00:00:00Z", { id: "a", artist: "X", durationMs: 240000 }),
      ev("2026-06-12T00:00:00Z", { id: "b", artist: "Y", durationMs: 120000 }),
    ]);
    expect(agg.totalPlays).toBe(3);
    expect(agg.totalMinutes).toBe(10); // 240k*2 + 120k = 600k ms = 10 min
    expect(agg.since).toBe("2026-06-10T00:00:00Z");
    expect(agg.until).toBe("2026-06-12T00:00:00Z");
    expect(agg.topTracks[0]).toMatchObject({ key: "a", plays: 2 });
    expect(agg.topArtists[0]).toMatchObject({ artist: "X", plays: 2, minutes: 8 });
  });

  it("returns an empty aggregate for no records", () => {
    const agg = aggregatePlays([]);
    expect(agg.totalPlays).toBe(0);
    expect(agg.since).toBeNull();
  });
});

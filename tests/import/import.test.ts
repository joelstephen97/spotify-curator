import { describe, it, expect } from "vitest";
import {
  parseStreamingHistory,
  aggregateImport,
  collectRows,
} from "@/lib/import";

describe("import parser", () => {
  it("parses the extended streaming-history shape", () => {
    const rows = parseStreamingHistory([
      {
        ts: "2023-05-01T08:30:00Z",
        ms_played: 210000,
        master_metadata_track_name: "Song A",
        master_metadata_album_artist_name: "Artist X",
      },
    ]);
    expect(rows).toEqual([
      { ts: "2023-05-01T08:30:00Z", msPlayed: 210000, track: "Song A", artist: "Artist X" },
    ]);
  });

  it("parses the legacy account-data shape", () => {
    const rows = parseStreamingHistory([
      { endTime: "2022-01-01 22:15", msPlayed: 200000, trackName: "B", artistName: "Y" },
    ]);
    expect(rows[0]).toEqual({
      ts: "2022-01-01 22:15",
      msPlayed: 200000,
      track: "B",
      artist: "Y",
    });
  });

  it("drops podcast/empty rows with no track name", () => {
    const rows = parseStreamingHistory([
      { ts: "2023-01-01T00:00:00Z", ms_played: 5000, master_metadata_track_name: null },
      { ts: "2023-01-01T00:00:00Z", ms_played: 5000, trackName: "ok", artistName: "z" },
    ]);
    expect(rows).toHaveLength(1);
  });

  it("aggregates lifetime totals, skip rate, hours and years", () => {
    const agg = aggregateImport([
      { ts: "2023-05-01T08:30:00Z", msPlayed: 240000, track: "A", artist: "X" },
      { ts: "2023-05-01T09:00:00Z", msPlayed: 240000, track: "A", artist: "X" },
      { ts: "2024-01-01T08:00:00Z", msPlayed: 10000, track: "B", artist: "Y" }, // skip
    ]);
    expect(agg.totalStreams).toBe(3);
    expect(agg.totalPlays).toBe(2); // one under 30s
    expect(agg.totalMinutes).toBe(8); // 240k*2 + 10k = 490k ms ≈ 8 min
    expect(agg.skipRate).toBe(33);
    expect(agg.topArtists[0]).toMatchObject({ artist: "X", plays: 2, minutes: 8 });
    expect(agg.topTracks[0]).toMatchObject({ name: "A", plays: 2 });
    expect(agg.byHour[8]).toBeGreaterThan(0);
    expect(agg.byYear.map((y) => y.year)).toEqual([2023, 2024]);
    expect(agg.since).toBe("2023-05-01T08:30:00Z");
  });

  it("collects rows from a single array or an array of file-arrays", () => {
    expect(collectRows([{ a: 1 }, { a: 2 }])).toHaveLength(2);
    expect(collectRows([[{ a: 1 }], [{ a: 2 }, { a: 3 }]])).toHaveLength(3);
  });
});

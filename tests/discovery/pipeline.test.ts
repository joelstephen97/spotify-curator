import { describe, it, expect, vi } from "vitest";
import { runDiscovery } from "@/lib/discovery/pipeline";
import type { Suggestion } from "@/lib/discovery/recommend";

describe("runDiscovery", () => {
  it("resolves suggestions, drops seen/unresolvable, adds the rest, updates store", async () => {
    const deps = {
      getSignals: vi.fn().mockResolvedValue({
        topArtists: [{ id: "1", name: "Radiohead", genres: ["alt rock"] }],
        topTracks: [],
        recent: [],
      }),
      recommend: vi.fn().mockResolvedValue([
        { artist: "Portishead", title: "Roads", reason: "r1" },
        { artist: "Radiohead", title: "Creep", reason: "seen-artist" },
        { artist: "Ghost", title: "Nowhere", reason: "unresolvable" },
      ]),
      resolve: vi.fn(
        async (s: Suggestion) =>
          s.artist === "Ghost" ? null : `spotify:track:${s.title}`,
      ),
      isSeen: vi.fn(async (key: string) => key.includes("radiohead")),
      addTracks: vi.fn(),
      markSeen: vi.fn(),
      setLatestPicks: vi.fn(),
    };
    const result = await runDiscovery(deps, { targetCount: 3 });
    expect(deps.addTracks).toHaveBeenCalledWith(["spotify:track:Roads"]);
    expect(result.added).toEqual([
      { artist: "Portishead", title: "Roads", reason: "r1", uri: "spotify:track:Roads" },
    ]);
    expect(deps.markSeen).toHaveBeenCalled();
    expect(deps.setLatestPicks).toHaveBeenCalledWith(result.added);
  });
});

import { describe, it, expect, vi } from "vitest";
import { recommend } from "@/lib/discovery/recommend";

const profile = {
  topGenres: ["alt rock"],
  artists: ["Radiohead"],
  lovedTracks: ["Weird Fishes — Radiohead"],
};

describe("recommend", () => {
  it("parses structured suggestions from the model tool call", async () => {
    const fakeAnthropic = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "tool_use",
              name: "suggest_tracks",
              input: {
                tracks: [
                  {
                    artist: "Portishead",
                    title: "Roads",
                    reason: "trip-hop adjacent to your alt-rock listens",
                  },
                ],
              },
            },
          ],
        }),
      },
    };
    const out = await recommend(fakeAnthropic as never, profile, 1);
    expect(out).toEqual([
      {
        artist: "Portishead",
        title: "Roads",
        reason: "trip-hop adjacent to your alt-rock listens",
      },
    ]);
  });

  it("returns [] when the model produces no tool call", async () => {
    const fakeAnthropic = {
      messages: {
        create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "no" }] }),
      },
    };
    const out = await recommend(fakeAnthropic as never, profile, 5);
    expect(out).toEqual([]);
  });
});

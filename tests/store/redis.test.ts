import { describe, it, expect } from "vitest";
import { createStore, type KV } from "@/lib/store/redis";

function fakeKV(): KV {
  const m = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  return {
    async get(k) {
      return m.get(k) ?? null;
    },
    async set(k, v) {
      m.set(k, v);
    },
    async sadd(k, ...members) {
      const s = sets.get(k) ?? new Set();
      members.forEach((x) => s.add(x));
      sets.set(k, s);
      return members.length;
    },
    async sismember(k, member) {
      return sets.get(k)?.has(member) ? 1 : 0;
    },
  };
}

describe("store", () => {
  it("stores and reads the refresh token", async () => {
    const s = createStore(fakeKV());
    await s.setRefreshToken("rt-123");
    expect(await s.getRefreshToken()).toBe("rt-123");
  });

  it("tracks the seen-set and reports membership", async () => {
    const s = createStore(fakeKV());
    await s.markSeen(["artist:Radiohead", "track:abc"]);
    expect(await s.isSeen("artist:Radiohead")).toBe(true);
    expect(await s.isSeen("artist:Unknown")).toBe(false);
  });

  it("round-trips the latest picks JSON", async () => {
    const s = createStore(fakeKV());
    const picks = [
      { artist: "A", title: "B", reason: "C", uri: "spotify:track:1" },
    ];
    await s.setLatestPicks(picks);
    expect(await s.getLatestPicks()).toEqual(picks);
  });
});

import { describe, it, expect } from "vitest";
import { createStore, createRegistry, type KV } from "@/lib/store/redis";

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
    async smembers(k) {
      return [...(sets.get(k) ?? [])];
    },
  };
}

describe("store", () => {
  it("stores and reads the refresh token per user", async () => {
    const s = createStore(fakeKV(), "u1");
    await s.setRefreshToken("rt-123");
    expect(await s.getRefreshToken()).toBe("rt-123");
  });

  it("isolates two users' data on the same KV", async () => {
    const kv = fakeKV();
    const a = createStore(kv, "alice");
    const b = createStore(kv, "bob");
    await a.setRefreshToken("alice-token");
    await b.setRefreshToken("bob-token");
    await a.markSeen(["track:x"]);
    expect(await a.getRefreshToken()).toBe("alice-token");
    expect(await b.getRefreshToken()).toBe("bob-token");
    expect(await a.isSeen("track:x")).toBe(true);
    expect(await b.isSeen("track:x")).toBe(false); // bob's seen-set is separate
  });

  it("tracks the seen-set and reports membership", async () => {
    const s = createStore(fakeKV(), "u1");
    await s.markSeen(["artist:Radiohead", "track:abc"]);
    expect(await s.isSeen("artist:Radiohead")).toBe(true);
    expect(await s.isSeen("artist:Unknown")).toBe(false);
  });

  it("round-trips the latest picks JSON", async () => {
    const s = createStore(fakeKV(), "u1");
    const picks = [
      { artist: "A", title: "B", reason: "C", uri: "spotify:track:1" },
    ];
    await s.setLatestPicks(picks);
    expect(await s.getLatestPicks()).toEqual(picks);
  });

  it("round-trips play history and the import aggregate", async () => {
    const s = createStore(fakeKV(), "u1");
    await s.setPlayHistory([
      { playedAt: "2026-06-13T00:00:00Z", id: "1", name: "n", artist: "a", durationMs: 1000 },
    ]);
    expect((await s.getPlayHistory())[0].id).toBe("1");
    await s.setImportAggregate('{"totalMinutes":42}');
    expect(await s.getImportAggregate()).toBe('{"totalMinutes":42}');
  });

  it("registers and lists users", async () => {
    const reg = createRegistry(fakeKV());
    await reg.addUser("alice");
    await reg.addUser("bob");
    await reg.addUser("alice"); // idempotent
    const users = await reg.listUsers();
    expect(users.sort()).toEqual(["alice", "bob"]);
  });
});

import { Redis } from "@upstash/redis";
import type { PlayEvent } from "@/lib/spotify/data";

export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  sadd(key: string, ...members: string[]): Promise<number>;
  sismember(key: string, member: string): Promise<number>;
  smembers(key: string): Promise<string[]>;
}

export interface Pick {
  artist: string;
  title: string;
  reason: string;
  uri: string;
  image?: string | null;
  previewUrl?: string | null;
}

// All listening data is namespaced per Spotify user id so multiple connected
// accounts never collide. The user registry is the one global key.
const USERS = "users:all";
const keys = (uid: string) => ({
  refresh: `spotify:refresh_token:${uid}`,
  seen: `discovery:seen:${uid}`,
  picks: `discovery:latest_picks:${uid}`,
  history: `history:plays:${uid}`,
  importAgg: `import:aggregate:${uid}`,
  status: `discovery:status:${uid}`,
});

export function createStore(kv: KV, userId: string) {
  const K = keys(userId);
  return {
    userId,
    async setRefreshToken(t: string) {
      await kv.set(K.refresh, t);
    },
    async getRefreshToken() {
      return kv.get(K.refresh);
    },
    async markSeen(seenKeys: string[]) {
      if (seenKeys.length) await kv.sadd(K.seen, ...seenKeys);
    },
    async isSeen(key: string) {
      return (await kv.sismember(K.seen, key)) === 1;
    },
    async setLatestPicks(picks: Pick[]) {
      await kv.set(K.picks, JSON.stringify(picks));
    },
    async getLatestPicks(): Promise<Pick[]> {
      const raw = await kv.get(K.picks);
      return raw ? JSON.parse(raw) : [];
    },
    async getPlayHistory(): Promise<PlayEvent[]> {
      const raw = await kv.get(K.history);
      return raw ? JSON.parse(raw) : [];
    },
    async setPlayHistory(events: PlayEvent[]) {
      await kv.set(K.history, JSON.stringify(events));
    },
    async getImportAggregate(): Promise<string | null> {
      return kv.get(K.importAgg);
    },
    async setImportAggregate(json: string) {
      await kv.set(K.importAgg, json);
    },
    async getDiscoveryStatus(): Promise<string | null> {
      return kv.get(K.status);
    },
    async setDiscoveryStatus(json: string) {
      await kv.set(K.status, json);
    },
  };
}

export type Store = ReturnType<typeof createStore>;

/** The global registry of connected users — drives the weekly cron fan-out. */
export function createRegistry(kv: KV) {
  return {
    async addUser(userId: string) {
      await kv.sadd(USERS, userId);
    },
    async listUsers(): Promise<string[]> {
      return kv.smembers(USERS);
    },
  };
}
export type Registry = ReturnType<typeof createRegistry>;

function redis(): KV {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    // We store JSON strings and parse them ourselves. Without this, the client
    // auto-JSON-parses on read, so our JSON.parse would double-parse and throw —
    // silently breaking history, imports, picks and discovery status.
    automaticDeserialization: false,
  }) as unknown as KV;
}

export function userStore(userId: string): Store {
  return createStore(redis(), userId);
}
export function registry(): Registry {
  return createRegistry(redis());
}

import { Redis } from "@upstash/redis";

export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  sadd(key: string, ...members: string[]): Promise<number>;
  sismember(key: string, member: string): Promise<number>;
}

export interface Pick {
  artist: string;
  title: string;
  reason: string;
  uri: string;
}

const K = {
  refresh: "spotify:refresh_token",
  seen: "discovery:seen",
  picks: "discovery:latest_picks",
};

export function createStore(kv: KV) {
  return {
    async setRefreshToken(t: string) {
      await kv.set(K.refresh, t);
    },
    async getRefreshToken() {
      return kv.get(K.refresh);
    },
    async markSeen(keys: string[]) {
      if (keys.length) await kv.sadd(K.seen, ...keys);
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
  };
}

export type Store = ReturnType<typeof createStore>;

export function defaultStore(): Store {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return createStore(redis as unknown as KV);
}

# Spotify Curator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user, AI-powered Spotify companion (Next.js on Vercel) with a stats dashboard, library curation, and a weekly Claude-driven discovery job that adds new tracks to a bot-owned playlist — published as a public GitHub portfolio repo.

**Architecture:** One Next.js (App Router) repo. Pure, testable `lib/` modules wrap Spotify auth/data/search/playlist, Redis storage, and Claude recommendation. Thin API routes compose those modules. A Vercel Cron route runs the weekly discovery pipeline headless. The dashboard UI reads from the API routes.

**Tech Stack:** Next.js + TypeScript, Tailwind CSS + shadcn/ui, Vitest (unit/integration with mocked APIs), Upstash Redis (`@upstash/redis`), Spotify Web API (direct `fetch`), Anthropic Claude (`@anthropic-ai/sdk`).

> **Note on Claude integration:** Per the `claude-api` skill, the model is `claude-opus-4-8` (the skill's default; the user named no model). Structured output is forced via `tool_choice` → `suggest_tracks`. Thinking is left off for this single forced-tool extraction call.

---

## File Structure

```
spotify-curator/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx                      # Stats view (home)
│   │   ├── curate/page.tsx               # Curation view
│   │   └── discoveries/page.tsx          # Discoveries view
│   ├── api/
│   │   ├── auth/login/route.ts
│   │   ├── auth/callback/route.ts
│   │   ├── stats/route.ts
│   │   ├── curate/route.ts
│   │   ├── discover/route.ts             # manual discovery trigger
│   │   └── cron/discover/route.ts        # Vercel Cron target
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── spotify/{auth,client,data,search,playlist}.ts
│   ├── discovery/{profile,recommend}.ts
│   ├── store/redis.ts
│   └── session.ts                        # httpOnly cookie helpers
├── tests/ (mirrors lib/ + api/)
├── vercel.json                           # cron schedule
├── .env.example
├── vitest.config.ts
└── README.md
```

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `.gitignore`, `app/layout.tsx`, `app/globals.css`

- [ ] **Step 1: Scaffold Next.js app**

Run in the repo root (it already contains `docs/` and `.git`):
```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*" --no-turbopack --yes
```
Expected: Next.js files created alongside existing `docs/`.

- [ ] **Step 2: Install runtime + test deps**

```bash
npm install @upstash/redis @anthropic-ai/sdk
npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", globals: true, include: ["tests/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

- [ ] **Step 4: Add test script**

In `package.json` `"scripts"`, add: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 5: Create `.env.example`**

```
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/auth/callback
ANTHROPIC_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SESSION_SECRET=
CRON_SECRET=
DISCOVERY_PLAYLIST_NAME=🤖 Weekly Discoveries
DISCOVERY_TARGET_COUNT=20
DISCOVERY_PLAYLIST_CAP=50
```

- [ ] **Step 6: Verify the toolchain runs**

Run: `npm run test`
Expected: Vitest runs and reports "No test files found" (exit 0) — confirms config is valid.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js app with Vitest"
```

---

## Task 1: Redis store wrapper

**Files:**
- Create: `lib/store/redis.ts`
- Test: `tests/store/redis.test.ts`

Define a `Store` interface so tests can inject a fake; export a real Redis-backed implementation and a factory.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createStore, type KV } from "@/lib/store/redis";

function fakeKV(): KV {
  const m = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  return {
    async get(k) { return m.get(k) ?? null; },
    async set(k, v) { m.set(k, v); },
    async sadd(k, ...members) {
      const s = sets.get(k) ?? new Set(); members.forEach((x) => s.add(x)); sets.set(k, s); return members.length;
    },
    async sismember(k, member) { return sets.get(k)?.has(member) ? 1 : 0; },
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
    const picks = [{ artist: "A", title: "B", reason: "C", uri: "spotify:track:1" }];
    await s.setLatestPicks(picks);
    expect(await s.getLatestPicks()).toEqual(picks);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/store/redis.test.ts`
Expected: FAIL — `createStore` not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
import { Redis } from "@upstash/redis";

export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  sadd(key: string, ...members: string[]): Promise<number>;
  sismember(key: string, member: string): Promise<number>;
}

export interface Pick { artist: string; title: string; reason: string; uri: string; }

const K = { refresh: "spotify:refresh_token", seen: "discovery:seen", picks: "discovery:latest_picks" };

export function createStore(kv: KV) {
  return {
    async setRefreshToken(t: string) { await kv.set(K.refresh, t); },
    async getRefreshToken() { return kv.get(K.refresh); },
    async markSeen(keys: string[]) { if (keys.length) await kv.sadd(K.seen, ...keys); },
    async isSeen(key: string) { return (await kv.sismember(K.seen, key)) === 1; },
    async setLatestPicks(picks: Pick[]) { await kv.set(K.picks, JSON.stringify(picks)); },
    async getLatestPicks(): Promise<Pick[]> { const raw = await kv.get(K.picks); return raw ? JSON.parse(raw) : []; },
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/store/redis.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/store/redis.ts tests/store/redis.test.ts && git commit -m "feat: redis store wrapper with seen-set and picks"
```

---

## Task 2: Spotify OAuth helpers

**Files:**
- Create: `lib/spotify/auth.ts`
- Test: `tests/spotify/auth.test.ts`

Authorization Code flow. Scopes: `user-top-read user-read-recently-played user-library-read playlist-read-private playlist-modify-private playlist-modify-public`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { buildAuthorizeUrl, exchangeCode, refreshAccessToken } from "@/lib/spotify/auth";

const cfg = { clientId: "cid", clientSecret: "secret", redirectUri: "http://127.0.0.1:3000/api/auth/callback" };

describe("spotify auth", () => {
  it("builds an authorize URL with scopes and state", () => {
    const url = new URL(buildAuthorizeUrl(cfg, "xyz"));
    expect(url.origin + url.pathname).toBe("https://accounts.spotify.com/authorize");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("state")).toBe("xyz");
    expect(url.searchParams.get("scope")).toContain("playlist-modify-private");
  });

  it("exchanges a code for tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "at", refresh_token: "rt", expires_in: 3600 }), { status: 200 })
    );
    const t = await exchangeCode(cfg, "the-code", fetchMock);
    expect(t).toEqual({ accessToken: "at", refreshToken: "rt", expiresIn: 3600 });
    const [, init] = fetchMock.mock.calls[0];
    expect(String(init.body)).toContain("grant_type=authorization_code");
  });

  it("refreshes an access token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: "at2", expires_in: 3600 }), { status: 200 })
    );
    const t = await refreshAccessToken(cfg, "rt", fetchMock);
    expect(t.accessToken).toBe("at2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/spotify/auth.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface SpotifyConfig { clientId: string; clientSecret: string; redirectUri: string; }
export interface Tokens { accessToken: string; refreshToken?: string; expiresIn: number; }

const SCOPES = [
  "user-top-read", "user-read-recently-played", "user-library-read",
  "playlist-read-private", "playlist-modify-private", "playlist-modify-public",
].join(" ");

export function spotifyConfig(): SpotifyConfig {
  return {
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI!,
  };
}

export function buildAuthorizeUrl(cfg: SpotifyConfig, state: string): string {
  const p = new URLSearchParams({
    response_type: "code", client_id: cfg.clientId, scope: SCOPES,
    redirect_uri: cfg.redirectUri, state,
  });
  return `https://accounts.spotify.com/authorize?${p.toString()}`;
}

function basicAuth(cfg: SpotifyConfig) {
  return "Basic " + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
}

async function tokenRequest(cfg: SpotifyConfig, body: URLSearchParams, f: typeof fetch): Promise<Tokens> {
  const res = await f("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basicAuth(cfg) },
    body,
  });
  if (!res.ok) throw new Error(`token request failed: ${res.status}`);
  const j = await res.json();
  return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresIn: j.expires_in };
}

export function exchangeCode(cfg: SpotifyConfig, code: string, f: typeof fetch = fetch) {
  return tokenRequest(cfg, new URLSearchParams({
    grant_type: "authorization_code", code, redirect_uri: cfg.redirectUri,
  }), f);
}

export function refreshAccessToken(cfg: SpotifyConfig, refreshToken: string, f: typeof fetch = fetch) {
  return tokenRequest(cfg, new URLSearchParams({
    grant_type: "refresh_token", refresh_token: refreshToken,
  }), f);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/spotify/auth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/spotify/auth.ts tests/spotify/auth.test.ts && git commit -m "feat: spotify oauth authorize/exchange/refresh helpers"
```

---

## Task 3: Spotify API client with rate-limit retry

**Files:**
- Create: `lib/spotify/client.ts`
- Test: `tests/spotify/client.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { SpotifyClient } from "@/lib/spotify/client";

describe("SpotifyClient", () => {
  it("GETs JSON with a bearer token", async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const c = new SpotifyClient("token-1", f);
    const data = await c.get<{ ok: boolean }>("/me");
    expect(data.ok).toBe(true);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.spotify.com/v1/me");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-1");
  });

  it("retries once on 429 honoring Retry-After", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "Retry-After": "0" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const c = new SpotifyClient("t", f);
    const data = await c.get<{ ok: boolean }>("/me");
    expect(data.ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("throws on non-ok, non-429 responses", async () => {
    const f = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    const c = new SpotifyClient("t", f);
    await expect(c.get("/me")).rejects.toThrow(/500/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/spotify/client.test.ts`
Expected: FAIL — `SpotifyClient` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
const BASE = "https://api.spotify.com/v1";

export class SpotifyClient {
  constructor(private token: string, private f: typeof fetch = fetch, private maxRetries = 2) {}

  private async request(path: string, init: RequestInit, attempt = 0): Promise<Response> {
    const res = await this.f(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    if (res.status === 429 && attempt < this.maxRetries) {
      const wait = Number(res.headers.get("Retry-After") ?? "1") * 1000;
      await new Promise((r) => setTimeout(r, wait));
      return this.request(path, init, attempt + 1);
    }
    if (!res.ok) throw new Error(`Spotify ${init.method ?? "GET"} ${path} failed: ${res.status}`);
    return res;
  }

  async get<T>(path: string): Promise<T> {
    const res = await this.request(path, { method: "GET" });
    return res.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.request(path, { method: "POST", body: JSON.stringify(body) });
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  async put(path: string, body: unknown): Promise<void> {
    await this.request(path, { method: "PUT", body: JSON.stringify(body) });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/spotify/client.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/spotify/client.ts tests/spotify/client.test.ts && git commit -m "feat: spotify api client with 429 retry"
```

---

## Task 4: Spotify data read helpers

**Files:**
- Create: `lib/spotify/data.ts`
- Test: `tests/spotify/data.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { getTopArtists, getRecentlyPlayed, deriveTopGenres } from "@/lib/spotify/data";
import { SpotifyClient } from "@/lib/spotify/client";

function clientReturning(payload: unknown) {
  const f = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
  return new SpotifyClient("t", f);
}

describe("spotify data", () => {
  it("maps top artists", async () => {
    const c = clientReturning({ items: [{ id: "1", name: "Radiohead", genres: ["alt rock"] }] });
    const artists = await getTopArtists(c, "medium_term");
    expect(artists[0]).toEqual({ id: "1", name: "Radiohead", genres: ["alt rock"] });
  });

  it("maps recently played to track names", async () => {
    const c = clientReturning({ items: [{ track: { id: "9", name: "Idioteque", artists: [{ name: "Radiohead" }] } }] });
    const recent = await getRecentlyPlayed(c);
    expect(recent[0]).toEqual({ id: "9", name: "Idioteque", artist: "Radiohead" });
  });

  it("derives top genres by frequency", () => {
    const genres = deriveTopGenres([
      { id: "1", name: "A", genres: ["rock", "indie"] },
      { id: "2", name: "B", genres: ["rock"] },
    ], 1);
    expect(genres).toEqual(["rock"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/spotify/data.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { SpotifyClient } from "./client";

export interface Artist { id: string; name: string; genres: string[]; }
export interface Track { id: string; name: string; artist: string; }
export type TimeRange = "short_term" | "medium_term" | "long_term";

export async function getTopArtists(c: SpotifyClient, range: TimeRange, limit = 50): Promise<Artist[]> {
  const data = await c.get<{ items: { id: string; name: string; genres?: string[] }[] }>(
    `/me/top/artists?time_range=${range}&limit=${limit}`
  );
  return data.items.map((a) => ({ id: a.id, name: a.name, genres: a.genres ?? [] }));
}

export async function getTopTracks(c: SpotifyClient, range: TimeRange, limit = 50): Promise<Track[]> {
  const data = await c.get<{ items: { id: string; name: string; artists: { name: string }[] }[] }>(
    `/me/top/tracks?time_range=${range}&limit=${limit}`
  );
  return data.items.map((t) => ({ id: t.id, name: t.name, artist: t.artists[0]?.name ?? "" }));
}

export async function getRecentlyPlayed(c: SpotifyClient, limit = 50): Promise<Track[]> {
  const data = await c.get<{ items: { track: { id: string; name: string; artists: { name: string }[] } }[] }>(
    `/me/player/recently-played?limit=${limit}`
  );
  return data.items.map((i) => ({ id: i.track.id, name: i.track.name, artist: i.track.artists[0]?.name ?? "" }));
}

export async function getSavedTracks(c: SpotifyClient, limit = 50): Promise<Track[]> {
  const data = await c.get<{ items: { track: { id: string; name: string; artists: { name: string }[] } }[] }>(
    `/me/tracks?limit=${limit}`
  );
  return data.items.map((i) => ({ id: i.track.id, name: i.track.name, artist: i.track.artists[0]?.name ?? "" }));
}

export function deriveTopGenres(artists: Artist[], limit = 10): string[] {
  const counts = new Map<string, number>();
  for (const a of artists) for (const g of a.genres) counts.set(g, (counts.get(g) ?? 0) + 1);
  return [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, limit).map(([g]) => g);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/spotify/data.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/spotify/data.ts tests/spotify/data.test.ts && git commit -m "feat: spotify data read helpers"
```

---

## Task 5: Search resolution

**Files:**
- Create: `lib/spotify/search.ts`
- Test: `tests/spotify/search.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { resolveTrack } from "@/lib/spotify/search";
import { SpotifyClient } from "@/lib/spotify/client";

function clientReturning(payload: unknown) {
  const f = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
  return new SpotifyClient("t", f);
}

describe("resolveTrack", () => {
  it("returns the most popular matching track uri", async () => {
    const c = clientReturning({ tracks: { items: [
      { uri: "spotify:track:low", popularity: 10, name: "X", artists: [{ name: "A" }] },
      { uri: "spotify:track:high", popularity: 90, name: "X", artists: [{ name: "A" }] },
    ] } });
    expect(await resolveTrack(c, { artist: "A", title: "X" })).toBe("spotify:track:high");
  });

  it("returns null when nothing is found", async () => {
    const c = clientReturning({ tracks: { items: [] } });
    expect(await resolveTrack(c, { artist: "A", title: "Nope" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/spotify/search.test.ts`
Expected: FAIL — `resolveTrack` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { SpotifyClient } from "./client";

export interface Suggestion { artist: string; title: string; }

export async function resolveTrack(c: SpotifyClient, s: Suggestion): Promise<string | null> {
  const q = encodeURIComponent(`track:${s.title} artist:${s.artist}`);
  const data = await c.get<{ tracks: { items: { uri: string; popularity: number }[] } }>(
    `/search?type=track&limit=5&q=${q}`
  );
  const items = data.tracks.items;
  if (!items.length) return null;
  return items.reduce((best, t) => (t.popularity > best.popularity ? t : best)).uri;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/spotify/search.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/spotify/search.ts tests/spotify/search.test.ts && git commit -m "feat: resolve suggestions to spotify track uris"
```

---

## Task 6: Playlist get-or-create / add / trim

**Files:**
- Create: `lib/spotify/playlist.ts`
- Test: `tests/spotify/playlist.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { getOrCreatePlaylist, addTracks } from "@/lib/spotify/playlist";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

describe("playlist", () => {
  it("returns an existing playlist by name", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: "me" }))                                  // /me
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: "pl1", name: "Bot" }] }));       // playlists
    const { SpotifyClient } = await import("@/lib/spotify/client");
    const id = await getOrCreatePlaylist(new SpotifyClient("t", f), "Bot");
    expect(id).toBe("pl1");
  });

  it("creates the playlist when missing", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: "me" }))                                   // /me
      .mockResolvedValueOnce(jsonResponse({ items: [] }))                                  // playlists (none)
      .mockResolvedValueOnce(jsonResponse({ id: "new1" }, 201));                           // create
    const { SpotifyClient } = await import("@/lib/spotify/client");
    const id = await getOrCreatePlaylist(new SpotifyClient("t", f), "Bot");
    expect(id).toBe("new1");
  });

  it("adds tracks to a playlist", async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ snapshot_id: "s1" }, 201));
    const { SpotifyClient } = await import("@/lib/spotify/client");
    await addTracks(new SpotifyClient("t", f), "pl1", ["spotify:track:1"]);
    const [url, init] = f.mock.calls[0];
    expect(url).toContain("/playlists/pl1/tracks");
    expect(init.method).toBe("POST");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/spotify/playlist.test.ts`
Expected: FAIL — functions not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { SpotifyClient } from "./client";

export async function getOrCreatePlaylist(c: SpotifyClient, name: string): Promise<string> {
  const me = await c.get<{ id: string }>("/me");
  const lists = await c.get<{ items: { id: string; name: string }[] }>("/me/playlists?limit=50");
  const existing = lists.items.find((p) => p.name === name);
  if (existing) return existing.id;
  const created = await c.post<{ id: string }>(`/users/${me.id}/playlists`, {
    name, public: false, description: "Weekly AI-curated discoveries.",
  });
  return created.id;
}

export async function addTracks(c: SpotifyClient, playlistId: string, uris: string[]): Promise<void> {
  if (!uris.length) return;
  await c.post(`/playlists/${playlistId}/tracks`, { uris });
}

export async function getPlaylistTrackUris(c: SpotifyClient, playlistId: string): Promise<string[]> {
  const data = await c.get<{ items: { track: { uri: string } | null }[] }>(
    `/playlists/${playlistId}/tracks?fields=items(track(uri))&limit=100`
  );
  return data.items.map((i) => i.track?.uri).filter((u): u is string => Boolean(u));
}

export async function trimToCap(c: SpotifyClient, playlistId: string, cap: number): Promise<void> {
  const uris = await getPlaylistTrackUris(c, playlistId);
  if (uris.length <= cap) return;
  const remove = uris.slice(0, uris.length - cap).map((uri) => ({ uri }));
  await c.post(`/playlists/${playlistId}/tracks`, { tracks: remove }); // DELETE-equivalent body; see note
}
```

> **Implementation note for trim:** Spotify removes tracks via HTTP `DELETE /playlists/{id}/tracks` with a `{ tracks: [{uri}] }` body. Add a `del(path, body)` method to `SpotifyClient` (mirror of `post`, method `"DELETE"`) and call it here. Add a unit test for `del` in `tests/spotify/client.test.ts` mirroring the `post` path before wiring trim.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/spotify/playlist.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/spotify/playlist.ts tests/spotify/playlist.test.ts lib/spotify/client.ts tests/spotify/client.test.ts && git commit -m "feat: playlist get-or-create, add, and trim"
```

---

## Task 7: Discovery profile builder

**Files:**
- Create: `lib/discovery/profile.ts`
- Test: `tests/discovery/profile.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildProfile, seenKeys } from "@/lib/discovery/profile";

const artists = [{ id: "1", name: "Radiohead", genres: ["alt rock", "indie"] }];
const tracks = [{ id: "9", name: "Idioteque", artist: "Radiohead" }];

describe("profile", () => {
  it("summarizes genres and representative artists/tracks", () => {
    const p = buildProfile({ topArtists: artists, topTracks: tracks, recent: tracks });
    expect(p.topGenres).toContain("alt rock");
    expect(p.artists).toContain("Radiohead");
    expect(p.recentTracks[0]).toBe("Idioteque — Radiohead");
  });

  it("produces lowercase seen keys for artists and tracks", () => {
    const keys = seenKeys({ topArtists: artists, topTracks: tracks, recent: [] });
    expect(keys).toContain("artist:radiohead");
    expect(keys).toContain("track:radiohead - idioteque");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/discovery/profile.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
import { deriveTopGenres, type Artist, type Track } from "@/lib/spotify/data";

export interface Signals { topArtists: Artist[]; topTracks: Track[]; recent: Track[]; }
export interface Profile { topGenres: string[]; artists: string[]; recentTracks: string[]; }

export function buildProfile(s: Signals): Profile {
  return {
    topGenres: deriveTopGenres(s.topArtists, 12),
    artists: [...new Set(s.topArtists.map((a) => a.name))].slice(0, 25),
    recentTracks: s.recent.slice(0, 25).map((t) => `${t.name} — ${t.artist}`),
  };
}

export function seenKeys(s: Signals): string[] {
  const keys = new Set<string>();
  for (const a of s.topArtists) keys.add(`artist:${a.name.toLowerCase()}`);
  for (const t of [...s.topTracks, ...s.recent]) {
    keys.add(`artist:${t.artist.toLowerCase()}`);
    keys.add(`track:${t.artist.toLowerCase()} - ${t.name.toLowerCase()}`);
  }
  return [...keys];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/discovery/profile.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/discovery/profile.ts tests/discovery/profile.test.ts && git commit -m "feat: taste profile + seen-key derivation"
```

---

## Task 8: Claude recommendation engine

**Files:**
- Create: `lib/discovery/recommend.ts`
- Test: `tests/discovery/recommend.test.ts`

> Consult the `claude-api` skill first to confirm model id (`claude-sonnet-4-6`) and `@anthropic-ai/sdk` tool-use shape. Inject the Anthropic client so tests don't hit the network.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { recommend } from "@/lib/discovery/recommend";

const profile = { topGenres: ["alt rock"], artists: ["Radiohead"], recentTracks: ["Idioteque — Radiohead"] };

describe("recommend", () => {
  it("parses structured suggestions from the model tool call", async () => {
    const fakeAnthropic = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "tool_use", name: "suggest_tracks", input: { tracks: [
            { artist: "Portishead", title: "Roads", reason: "trip-hop adjacent to your alt-rock listens" },
          ] } }],
        }),
      },
    };
    const out = await recommend(fakeAnthropic as never, profile, 1);
    expect(out).toEqual([{ artist: "Portishead", title: "Roads", reason: "trip-hop adjacent to your alt-rock listens" }]);
  });

  it("returns [] when the model produces no tool call", async () => {
    const fakeAnthropic = { messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "no" }] }) } };
    const out = await recommend(fakeAnthropic as never, profile, 5);
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/discovery/recommend.test.ts`
Expected: FAIL — `recommend` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import type Anthropic from "@anthropic-ai/sdk";
import type { Profile } from "./profile";

export interface Suggestion { artist: string; title: string; reason: string; }

const TOOL = {
  name: "suggest_tracks",
  description: "Return new track suggestions the listener has not heard.",
  input_schema: {
    type: "object",
    properties: {
      tracks: {
        type: "array",
        items: {
          type: "object",
          properties: { artist: { type: "string" }, title: { type: "string" }, reason: { type: "string" } },
          required: ["artist", "title", "reason"],
        },
      },
    },
    required: ["tracks"],
  },
} as const;

export async function recommend(client: Anthropic, profile: Profile, count: number): Promise<Suggestion[]> {
  const prompt = [
    "You are a music curator. Suggest NEW tracks the listener likely has not heard,",
    `based on their taste. Avoid their listed artists. Return exactly ${count} suggestions.`,
    `Top genres: ${profile.topGenres.join(", ")}`,
    `Favourite artists (avoid these): ${profile.artists.join(", ")}`,
    `Recent plays: ${profile.recentTracks.join("; ")}`,
  ].join("\n");

  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1500,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "suggest_tracks" },
    messages: [{ role: "user", content: prompt }],
  });

  const block = res.content.find((b: { type: string }) => b.type === "tool_use") as
    | { input: { tracks: Suggestion[] } } | undefined;
  return block?.input.tracks ?? [];
}

export function defaultAnthropic(): Anthropic {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const AnthropicCtor = require("@anthropic-ai/sdk").default;
  return new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY! });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/discovery/recommend.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/discovery/recommend.ts tests/discovery/recommend.test.ts && git commit -m "feat: claude-powered track recommendation"
```

---

## Task 9: Discovery pipeline orchestrator

**Files:**
- Create: `lib/discovery/pipeline.ts`
- Test: `tests/discovery/pipeline.test.ts`

Pure orchestration over injected dependencies so it is fully testable with everything mocked.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { runDiscovery } from "@/lib/discovery/pipeline";

describe("runDiscovery", () => {
  it("resolves suggestions, drops seen/unresolvable, adds the rest, updates store", async () => {
    const deps = {
      getSignals: vi.fn().mockResolvedValue({
        topArtists: [{ id: "1", name: "Radiohead", genres: ["alt rock"] }],
        topTracks: [], recent: [],
      }),
      recommend: vi.fn().mockResolvedValue([
        { artist: "Portishead", title: "Roads", reason: "r1" },
        { artist: "Radiohead", title: "Creep", reason: "seen-artist" }, // should be dropped (seen)
        { artist: "Ghost", title: "Nowhere", reason: "unresolvable" },   // resolves to null
      ]),
      resolve: vi.fn(async (s) => (s.artist === "Ghost" ? null : `spotify:track:${s.title}`)),
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/discovery/pipeline.test.ts`
Expected: FAIL — `runDiscovery` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Signals } from "./profile";
import { buildProfile, seenKeys } from "./profile";
import type { Suggestion } from "./recommend";

export interface PipelineDeps {
  getSignals: () => Promise<Signals>;
  recommend: (profile: ReturnType<typeof buildProfile>, count: number) => Promise<Suggestion[]>;
  resolve: (s: Suggestion) => Promise<string | null>;
  isSeen: (key: string) => Promise<boolean>;
  addTracks: (uris: string[]) => Promise<void>;
  markSeen: (keys: string[]) => Promise<void>;
  setLatestPicks: (picks: { artist: string; title: string; reason: string; uri: string }[]) => Promise<void>;
}

export async function runDiscovery(deps: PipelineDeps, opts: { targetCount: number }) {
  const signals = await deps.getSignals();
  const profile = buildProfile(signals);
  const suggestions = await deps.recommend(profile, Math.ceil(opts.targetCount * 1.5));

  const added: { artist: string; title: string; reason: string; uri: string }[] = [];
  for (const s of suggestions) {
    if (added.length >= opts.targetCount) break;
    if (await deps.isSeen(`artist:${s.artist.toLowerCase()}`)) continue;
    if (await deps.isSeen(`track:${s.artist.toLowerCase()} - ${s.title.toLowerCase()}`)) continue;
    const uri = await deps.resolve(s);
    if (!uri) continue;
    if (added.some((a) => a.uri === uri)) continue;
    added.push({ ...s, uri });
  }

  await deps.addTracks(added.map((a) => a.uri));
  await deps.markSeen([
    ...seenKeys(signals),
    ...added.flatMap((a) => [
      `artist:${a.artist.toLowerCase()}`,
      `track:${a.artist.toLowerCase()} - ${a.title.toLowerCase()}`,
    ]),
  ]);
  await deps.setLatestPicks(added);
  return { added };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/discovery/pipeline.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add lib/discovery/pipeline.ts tests/discovery/pipeline.test.ts && git commit -m "feat: discovery pipeline orchestrator"
```

---

## Task 10: Session cookie helpers

**Files:**
- Create: `lib/session.ts`
- Test: `tests/session.test.ts`

Sign the access token into an httpOnly cookie value (HMAC) so the dashboard can read it without a DB.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { sealSession, unsealSession } from "@/lib/session";

const secret = "test-secret";

describe("session", () => {
  it("seals and unseals a payload", () => {
    const sealed = sealSession({ accessToken: "at", expiresAt: 123 }, secret);
    expect(unsealSession(sealed, secret)).toEqual({ accessToken: "at", expiresAt: 123 });
  });

  it("rejects a tampered payload", () => {
    const sealed = sealSession({ accessToken: "at", expiresAt: 123 }, secret);
    expect(unsealSession(sealed + "x", secret)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/session.test.ts`
Expected: FAIL — functions not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import crypto from "node:crypto";

export interface Session { accessToken: string; expiresAt: number; }

function sign(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

export function sealSession(s: Session, secret: string): string {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function unsealSession(value: string, secret: string): Session | null {
  const [payload, mac] = value.split(".");
  if (!payload || !mac) return null;
  const expected = sign(payload, secret);
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { return null; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/session.test.ts`
Expected: PASS (2 tests). (Note: tampered-mac comparison may throw on length mismatch — wrap `timingSafeEqual` in a try/catch returning null; add that before running.)

- [ ] **Step 5: Commit**

```bash
git add lib/session.ts tests/session.test.ts && git commit -m "feat: signed session cookie helpers"
```

---

## Task 11: Auth API routes

**Files:**
- Create: `app/api/auth/login/route.ts`, `app/api/auth/callback/route.ts`

These are thin wrappers over tested `lib` functions; verified manually (browser) rather than unit-tested.

- [ ] **Step 1: Implement `login` route**

`app/api/auth/login/route.ts`:
```ts
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { buildAuthorizeUrl, spotifyConfig } from "@/lib/spotify/auth";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthorizeUrl(spotifyConfig(), state));
  res.cookies.set("oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  return res;
}
```

- [ ] **Step 2: Implement `callback` route**

`app/api/auth/callback/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, spotifyConfig } from "@/lib/spotify/auth";
import { sealSession } from "@/lib/session";
import { defaultStore } from "@/lib/store/redis";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("oauth_state")?.value;
  if (!code || !state || state !== cookieState) {
    return NextResponse.json({ error: "invalid_oauth_state" }, { status: 400 });
  }
  const tokens = await exchangeCode(spotifyConfig(), code);
  if (tokens.refreshToken) await defaultStore().setRefreshToken(tokens.refreshToken);

  const session = sealSession(
    { accessToken: tokens.accessToken, expiresAt: Date.now() + tokens.expiresIn * 1000 },
    process.env.SESSION_SECRET!
  );
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("session", session, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  return res;
}
```

- [ ] **Step 3: Verify build typechecks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/auth && git commit -m "feat: spotify oauth login and callback routes"
```

---

## Task 12: Cron discovery route

**Files:**
- Create: `app/api/cron/discover/route.ts`, `vercel.json`

- [ ] **Step 1: Implement the cron route**

`app/api/cron/discover/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { refreshAccessToken, spotifyConfig } from "@/lib/spotify/auth";
import { SpotifyClient } from "@/lib/spotify/client";
import { getTopArtists, getTopTracks, getRecentlyPlayed } from "@/lib/spotify/data";
import { resolveTrack } from "@/lib/spotify/search";
import { getOrCreatePlaylist, addTracks, trimToCap } from "@/lib/spotify/playlist";
import { recommend, defaultAnthropic } from "@/lib/discovery/recommend";
import { runDiscovery } from "@/lib/discovery/pipeline";
import { defaultStore } from "@/lib/store/redis";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const store = defaultStore();
  const refresh = await store.getRefreshToken();
  if (!refresh) return NextResponse.json({ error: "not_connected" }, { status: 412 });

  const tokens = await refreshAccessToken(spotifyConfig(), refresh);
  const client = new SpotifyClient(tokens.accessToken);
  const anthropic = defaultAnthropic();
  const playlistId = await getOrCreatePlaylist(client, process.env.DISCOVERY_PLAYLIST_NAME!);

  const result = await runDiscovery(
    {
      getSignals: async () => ({
        topArtists: [
          ...(await getTopArtists(client, "short_term")),
          ...(await getTopArtists(client, "medium_term")),
          ...(await getTopArtists(client, "long_term")),
        ],
        topTracks: await getTopTracks(client, "medium_term"),
        recent: await getRecentlyPlayed(client),
      }),
      recommend: (profile, count) => recommend(anthropic, profile, count),
      resolve: (s) => resolveTrack(client, s),
      isSeen: (key) => store.isSeen(key),
      addTracks: (uris) => addTracks(client, playlistId, uris),
      markSeen: (keys) => store.markSeen(keys),
      setLatestPicks: (picks) => store.setLatestPicks(picks),
    },
    { targetCount: Number(process.env.DISCOVERY_TARGET_COUNT ?? "20") }
  );

  await trimToCap(client, playlistId, Number(process.env.DISCOVERY_PLAYLIST_CAP ?? "50"));
  return NextResponse.json({ added: result.added.length, picks: result.added });
}
```

- [ ] **Step 2: Add `vercel.json` cron schedule**

```json
{ "crons": [{ "path": "/api/cron/discover", "schedule": "0 6 * * 1" }] }
```

> Vercel sends the cron request with `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set in project env — matches the guard above.

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron vercel.json && git commit -m "feat: weekly cron discovery route"
```

---

## Task 13: Stats, curate, and discover API routes

**Files:**
- Create: `app/api/stats/route.ts`, `app/api/discover/route.ts`, `app/api/curate/route.ts`
- Create: `lib/api-auth.ts` (read session → SpotifyClient, refreshing if expired)

- [ ] **Step 1: Implement `lib/api-auth.ts`**

```ts
import { cookies } from "next/headers";
import { unsealSession } from "@/lib/session";
import { refreshAccessToken, spotifyConfig } from "@/lib/spotify/auth";
import { SpotifyClient } from "@/lib/spotify/client";
import { defaultStore } from "@/lib/store/redis";

export async function clientFromRequest(): Promise<SpotifyClient | null> {
  const raw = (await cookies()).get("session")?.value;
  const session = raw ? unsealSession(raw, process.env.SESSION_SECRET!) : null;
  if (session && session.expiresAt > Date.now()) return new SpotifyClient(session.accessToken);
  const refresh = await defaultStore().getRefreshToken();
  if (!refresh) return null;
  const tokens = await refreshAccessToken(spotifyConfig(), refresh);
  return new SpotifyClient(tokens.accessToken);
}
```

- [ ] **Step 2: Implement `app/api/stats/route.ts`**

```ts
import { NextResponse } from "next/server";
import { clientFromRequest } from "@/lib/api-auth";
import { getTopArtists, getTopTracks, getRecentlyPlayed, deriveTopGenres } from "@/lib/spotify/data";

export async function GET() {
  const client = await clientFromRequest();
  if (!client) return NextResponse.json({ error: "not_connected" }, { status: 401 });
  const topArtists = await getTopArtists(client, "medium_term");
  return NextResponse.json({
    topArtists,
    topTracks: await getTopTracks(client, "medium_term"),
    recent: await getRecentlyPlayed(client),
    topGenres: deriveTopGenres(topArtists, 15),
  });
}
```

- [ ] **Step 3: Implement `app/api/discover/route.ts`** (manual trigger, reuses cron logic)

```ts
import { NextResponse } from "next/server";
export { GET as cronGET } from "@/app/api/cron/discover/route";

export async function POST() {
  // Manual trigger: forward to the cron handler with the server-side secret.
  const res = await fetch(`${process.env.SELF_URL ?? "http://127.0.0.1:3000"}/api/cron/discover`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
```

> Add `SELF_URL` to `.env.example` (set to the Vercel deployment URL in production).

- [ ] **Step 4: Implement `app/api/curate/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { clientFromRequest } from "@/lib/api-auth";
import { getSavedTracks } from "@/lib/spotify/data";
import { getOrCreatePlaylist, addTracks } from "@/lib/spotify/playlist";

// Body: { name: string, decade?: number }  — v1 curation: saved tracks filtered by release decade.
export async function POST(req: NextRequest) {
  const client = await clientFromRequest();
  if (!client) return NextResponse.json({ error: "not_connected" }, { status: 401 });
  const { name } = await req.json();
  const saved = await getSavedTracks(client, 50);
  const playlistId = await getOrCreatePlaylist(client, name);
  await addTracks(client, playlistId, saved.map((t) => `spotify:track:${t.id}`));
  return NextResponse.json({ playlistId, added: saved.length });
}
```

> v1 curation is intentionally minimal (saved tracks → new playlist). Mood/era/genre filters are a follow-up once the dashboard exposes criteria.

- [ ] **Step 5: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/stats app/api/discover app/api/curate lib/api-auth.ts && git commit -m "feat: stats, curate, and manual discover api routes"
```

---

## Task 14: Dashboard UI

**Files:**
- Create: `app/(dashboard)/page.tsx` (stats), `app/(dashboard)/discoveries/page.tsx`, `app/(dashboard)/curate/page.tsx`
- Create: `components/Nav.tsx`, `components/Connect.tsx`

- [ ] **Step 1: Add shadcn/ui**

```bash
npx shadcn@latest init -d
npx shadcn@latest add card button input
```

- [ ] **Step 2: Implement stats page** (`app/(dashboard)/page.tsx`)

Client component: `fetch("/api/stats")`; if 401, render a "Connect Spotify" button linking to `/api/auth/login`. Otherwise render top artists, top tracks, top genres, and recent plays in `Card`s. Include a "Run discovery now" button that `POST`s `/api/discover` and shows the returned picks.

```tsx
"use client";
import { useEffect, useState } from "react";

export default function StatsPage() {
  const [data, setData] = useState<any>(null);
  const [connected, setConnected] = useState(true);
  useEffect(() => {
    fetch("/api/stats").then((r) => { if (r.status === 401) setConnected(false); else return r.json(); }).then(setData).catch(() => {});
  }, []);
  if (!connected) return <a href="/api/auth/login" className="underline">Connect Spotify</a>;
  if (!data) return <p>Loading…</p>;
  return (
    <main className="p-8 space-y-6">
      <section><h2 className="font-bold">Top genres</h2><p>{data.topGenres.join(", ")}</p></section>
      <section><h2 className="font-bold">Top artists</h2><ul>{data.topArtists.slice(0,10).map((a:any)=><li key={a.id}>{a.name}</li>)}</ul></section>
      <section><h2 className="font-bold">Recent</h2><ul>{data.recent.slice(0,10).map((t:any,i:number)=><li key={i}>{t.name} — {t.artist}</li>)}</ul></section>
    </main>
  );
}
```

- [ ] **Step 3: Implement discoveries page** (`app/(dashboard)/discoveries/page.tsx`)

Fetch latest picks (add `GET /api/discover` returning `store.getLatestPicks()`); render each pick with its `reason`. Add that GET handler to `app/api/discover/route.ts`:
```ts
import { defaultStore } from "@/lib/store/redis";
export async function GET() { return NextResponse.json({ picks: await defaultStore().getLatestPicks() }); }
```
(Remove the earlier `export { GET as cronGET }` line — the manual trigger stays as `POST`.)

- [ ] **Step 4: Implement curate page** (`app/(dashboard)/curate/page.tsx`)

Form with a playlist-name input and a "Create from saved tracks" button that `POST`s `/api/curate`.

- [ ] **Step 5: Add nav + layout**

`components/Nav.tsx` linking `/`, `/curate`, `/discoveries`; render it in `app/layout.tsx`.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add app components && git commit -m "feat: dashboard stats, discoveries, and curate views"
```

---

## Task 15: README + portfolio polish + publish

**Files:**
- Create/replace: `README.md`

- [ ] **Step 1: Write `README.md`**

Sections: title + one-line pitch; the Nov-2024 Spotify API deprecation story (why Claude replaces the recommendations endpoint); features (stats / curation / weekly AI discovery); architecture diagram (copy from the design doc); tech stack; local setup (env vars from `.env.example`, Spotify app + redirect URI, Upstash, Anthropic key); deploy-to-Vercel steps incl. setting `CRON_SECRET`; screenshots placeholder; license (MIT).

- [ ] **Step 2: Run the full test suite**

Run: `npm run test`
Expected: all tests PASS.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git add README.md && git commit -m "docs: portfolio README"
```

- [ ] **Step 5: Create the public GitHub repo and push**

```bash
gh repo create spotify-curator --public --source=. --remote=origin --description "AI-powered Spotify discovery & curation (Next.js + Claude)" --push
```
Expected: repo created and `main` pushed.

- [ ] **Step 6: (Manual, by Joel) Deploy on Vercel**

Import the repo in Vercel, add all env vars, confirm the cron appears under Project → Cron Jobs, run it once manually, and verify the `🤖 Weekly Discoveries` playlist fills.

---

## Self-Review Notes

- **Spec coverage:** auto-discovery (Tasks 5–9, 12), curation (Task 13/14), stats dashboard (Tasks 13/14), Redis token+seen store (Task 1), OAuth (Tasks 2, 11), Claude engine (Task 8), cron (Task 12), portfolio repo/README (Task 15) — all spec sections map to tasks.
- **Type consistency:** `Suggestion {artist,title,reason}` (recommend) vs `Suggestion {artist,title}` (search) are intentionally distinct types in different modules; the pipeline passes the richer one to `resolve`, which only reads `artist`/`title` — compatible. `Pick`/picks shape `{artist,title,reason,uri}` is consistent across store, pipeline, and discoveries view.
- **Known follow-ups flagged inline:** `del()` method needed for trim (Task 6 note); curation filters beyond saved-tracks (Task 13 note); confirm Claude SDK shape via `claude-api` skill (Task 8 note).

import { refreshAccessToken, spotifyConfig } from "@/lib/spotify/auth";
import { SpotifyClient } from "@/lib/spotify/client";
import {
  getTopArtists,
  getTopTracks,
  getRecentlyPlayed,
} from "@/lib/spotify/data";
import { resolveTrack } from "@/lib/spotify/search";
import { getOrCreatePlaylist, addTracks, trimToCap } from "@/lib/spotify/playlist";
import { recommend, defaultAnthropic } from "@/lib/discovery/recommend";
import { runDiscovery } from "@/lib/discovery/pipeline";
import { userStore, registry } from "@/lib/store/redis";

export type DiscoveryRunResult =
  | { ok: true; added: { artist: string; title: string; reason: string; uri: string }[] }
  | { ok: false; reason: "not_connected" };

export interface DiscoveryStatus {
  state: "idle" | "running" | "done" | "error";
  step: string;
  startedAt: number;
  finishedAt?: number;
  added?: number;
  error?: string;
}

export async function readStatus(userId: string): Promise<DiscoveryStatus> {
  try {
    const raw = await userStore(userId).getDiscoveryStatus();
    if (raw) return JSON.parse(raw) as DiscoveryStatus;
  } catch {
    /* fall through */
  }
  return { state: "idle", step: "", startedAt: 0 };
}

async function writeStatus(userId: string, s: DiscoveryStatus) {
  try {
    await userStore(userId).setDiscoveryStatus(JSON.stringify(s));
  } catch {
    /* status is best-effort */
  }
}

/**
 * Headless discovery for ONE user: refresh their token, gather taste signals,
 * ask Claude for new tracks, resolve and add them to that user's bot-owned
 * playlist, then trim to the cap. Writes live progress to Redis so the UI can
 * show what's happening and the user can leave while it runs.
 */
export async function runDiscoveryForUser(
  userId: string,
  now = Date.now(),
): Promise<DiscoveryRunResult> {
  const store = userStore(userId);
  const refresh = await store.getRefreshToken();
  if (!refresh) {
    await writeStatus(userId, {
      state: "error",
      step: "",
      startedAt: now,
      finishedAt: now,
      error: "not_connected",
    });
    return { ok: false, reason: "not_connected" };
  }

  await writeStatus(userId, {
    state: "running",
    step: "Warming up…",
    startedAt: now,
  });

  try {
    const tokens = await refreshAccessToken(spotifyConfig(), refresh);
    const client = new SpotifyClient(tokens.accessToken);
    const anthropic = defaultAnthropic();
    const playlistId = await getOrCreatePlaylist(
      client,
      process.env.DISCOVERY_PLAYLIST_NAME ?? "🤖 Weekly Discoveries",
    );

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
        onStep: (step) =>
          writeStatus(userId, { state: "running", step, startedAt: now }),
      },
      { targetCount: Number(process.env.DISCOVERY_TARGET_COUNT ?? "20") },
    );

    await trimToCap(
      client,
      playlistId,
      Number(process.env.DISCOVERY_PLAYLIST_CAP ?? "50"),
    );

    await writeStatus(userId, {
      state: "done",
      step: `Added ${result.added.length} tracks`,
      startedAt: now,
      finishedAt: Date.now(),
      added: result.added.length,
    });
    return { ok: true, added: result.added };
  } catch (e) {
    await writeStatus(userId, {
      state: "error",
      step: "",
      startedAt: now,
      finishedAt: Date.now(),
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

export interface UserRunSummary {
  userId: string;
  added: number;
  error?: string;
}

/**
 * Fan the weekly job out across every connected user. One user's failure
 * (revoked token, rate limit) is logged and skipped — it never aborts the run.
 */
export async function runAllUsers(): Promise<UserRunSummary[]> {
  const users = await registry().listUsers();
  const summaries: UserRunSummary[] = [];
  for (const userId of users) {
    try {
      const r = await runDiscoveryForUser(userId);
      summaries.push({
        userId,
        added: r.ok ? r.added.length : 0,
        error: r.ok ? undefined : r.reason,
      });
    } catch (e) {
      summaries.push({
        userId,
        added: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return summaries;
}

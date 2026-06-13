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
import { defaultStore } from "@/lib/store/redis";

export type DiscoveryRunResult =
  | { ok: true; added: { artist: string; title: string; reason: string; uri: string }[] }
  | { ok: false; reason: "not_connected" };

/**
 * Headless weekly discovery: refresh the stored token, gather taste signals,
 * ask Claude for new tracks, resolve and add them to the bot-owned playlist,
 * then trim to the cap. Shared by the cron route and the manual trigger.
 */
export async function runScheduledDiscovery(): Promise<DiscoveryRunResult> {
  const store = defaultStore();
  const refresh = await store.getRefreshToken();
  if (!refresh) return { ok: false, reason: "not_connected" };

  const tokens = await refreshAccessToken(spotifyConfig(), refresh);
  const client = new SpotifyClient(tokens.accessToken);
  const anthropic = defaultAnthropic();
  const playlistId = await getOrCreatePlaylist(
    client,
    process.env.DISCOVERY_PLAYLIST_NAME!,
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
    },
    { targetCount: Number(process.env.DISCOVERY_TARGET_COUNT ?? "20") },
  );

  await trimToCap(
    client,
    playlistId,
    Number(process.env.DISCOVERY_PLAYLIST_CAP ?? "50"),
  );
  return { ok: true, added: result.added };
}

import type { SpotifyClient } from "./client";

export type PlayResult =
  | { ok: true }
  | { ok: false; reason: "no_device" | "forbidden" | "error"; detail?: string };

interface Device {
  id: string | null;
  is_active: boolean;
}

/**
 * Start playback of a single track on the user's active Spotify device
 * (desktop/mobile app — not a web player). Replaces whatever is currently
 * playing. If no device is "active" we target the first available one. Requires
 * Spotify Premium + the user-modify-playback-state scope.
 */
export async function playTrack(
  c: SpotifyClient,
  uri: string,
): Promise<PlayResult> {
  try {
    await c.put("/me/player/play", { uris: [uri] });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    // 404 = no active device. Find a device and target it explicitly.
    if (/failed: 404/.test(msg)) {
      try {
        const { devices } = await c.get<{ devices: Device[] }>(
          "/me/player/devices",
        );
        const target = devices.find((d) => d.is_active) ?? devices[0];
        if (!target?.id) return { ok: false, reason: "no_device" };
        await c.put(`/me/player/play?device_id=${target.id}`, { uris: [uri] });
        return { ok: true };
      } catch (e2) {
        const m2 = e2 instanceof Error ? e2.message : String(e2);
        if (/failed: 404/.test(m2)) return { ok: false, reason: "no_device" };
        if (/failed: 403/.test(m2))
          return { ok: false, reason: "forbidden", detail: m2 };
        return { ok: false, reason: "error", detail: m2 };
      }
    }

    // 403 = Premium required, or Development-Mode restriction.
    if (/failed: 403/.test(msg))
      return { ok: false, reason: "forbidden", detail: msg };
    return { ok: false, reason: "error", detail: msg };
  }
}

export type PlayAllResult = PlayResult & { queued?: number };

/**
 * Play the first track and queue the rest onto the active device — the closest
 * an individual (Development-Mode) app can get to "add all these to a playlist",
 * since playlist writes are blocked. Queue order follows the array.
 */
export async function playAll(
  c: SpotifyClient,
  uris: string[],
): Promise<PlayAllResult> {
  if (!uris.length) return { ok: false, reason: "error", detail: "no tracks" };

  const first = await playTrack(c, uris[0]);
  if (!first.ok) return first;

  let queued = 0;
  for (const uri of uris.slice(1)) {
    try {
      await c.post(`/me/player/queue?uri=${encodeURIComponent(uri)}`, {});
      queued += 1;
    } catch {
      // A single queue failure shouldn't abort the rest.
    }
  }
  return { ok: true, queued };
}

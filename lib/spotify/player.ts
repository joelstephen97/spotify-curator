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

import { describe, it, expect, vi } from "vitest";
import { getOrCreatePlaylist, addTracks, trimToCap } from "@/lib/spotify/playlist";
import { SpotifyClient } from "@/lib/spotify/client";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

describe("playlist", () => {
  it("returns an existing playlist by name", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "me" }))
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: "pl1", name: "Bot" }] }));
    const id = await getOrCreatePlaylist(new SpotifyClient("t", f), "Bot");
    expect(id).toBe("pl1");
  });

  it("creates the playlist when missing", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: "me" }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: "new1" }, 201));
    const id = await getOrCreatePlaylist(new SpotifyClient("t", f), "Bot");
    expect(id).toBe("new1");
  });

  it("adds tracks to a playlist", async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ snapshot_id: "s1" }, 201));
    await addTracks(new SpotifyClient("t", f), "pl1", ["spotify:track:1"]);
    const [url, init] = f.mock.calls[0];
    expect(url).toContain("/playlists/pl1/tracks");
    expect(init.method).toBe("POST");
  });

  it("does not call the API when there are no tracks to add", async () => {
    const f = vi.fn();
    await addTracks(new SpotifyClient("t", f), "pl1", []);
    expect(f).not.toHaveBeenCalled();
  });

  it("trims the oldest tracks beyond the cap via DELETE", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            { track: { uri: "spotify:track:old" } },
            { track: { uri: "spotify:track:keep1" } },
            { track: { uri: "spotify:track:keep2" } },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({}, 200));
    await trimToCap(new SpotifyClient("t", f), "pl1", 2);
    const [url, init] = f.mock.calls[1];
    expect(url).toContain("/playlists/pl1/tracks");
    expect(init.method).toBe("DELETE");
    expect(String(init.body)).toContain("spotify:track:old");
    expect(String(init.body)).not.toContain("keep1");
  });

  it("does not trim when under the cap", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ items: [{ track: { uri: "spotify:track:a" } }] }),
      );
    await trimToCap(new SpotifyClient("t", f), "pl1", 5);
    expect(f).toHaveBeenCalledTimes(1);
  });
});

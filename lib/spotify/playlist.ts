import type { SpotifyClient } from "./client";

export async function getOrCreatePlaylist(
  c: SpotifyClient,
  name: string,
): Promise<string> {
  const me = await c.get<{ id: string }>("/me");

  // Page through ALL of the user's playlists — only checking the first 50 would
  // miss an existing bot playlist and create a duplicate every run.
  for (let offset = 0; offset < 1000; offset += 50) {
    const lists = await c.get<{
      items: { id: string; name: string }[];
      next: string | null;
    }>(`/me/playlists?limit=50&offset=${offset}`);
    const existing = lists.items.find((p) => p.name === name);
    if (existing) return existing.id;
    if (!lists.next || lists.items.length === 0) break;
  }

  const created = await c.post<{ id: string }>(`/users/${me.id}/playlists`, {
    name,
    public: false,
    description: "Weekly AI-curated discoveries.",
  });
  return created.id;
}

export async function addTracks(
  c: SpotifyClient,
  playlistId: string,
  uris: string[],
): Promise<void> {
  // Spotify accepts at most 100 URIs per request — chunk so large playlists
  // (e.g. a full liked-songs export) don't get silently rejected.
  for (let i = 0; i < uris.length; i += 100) {
    const chunk = uris.slice(i, i + 100);
    if (chunk.length) await c.post(`/playlists/${playlistId}/tracks`, { uris: chunk });
  }
}

export async function getPlaylistTrackUris(
  c: SpotifyClient,
  playlistId: string,
): Promise<string[]> {
  const data = await c.get<{ items: { track: { uri: string } | null }[] }>(
    `/playlists/${playlistId}/tracks?fields=items(track(uri))&limit=100`,
  );
  return data.items
    .map((i) => i.track?.uri)
    .filter((u): u is string => Boolean(u));
}

export async function trimToCap(
  c: SpotifyClient,
  playlistId: string,
  cap: number,
): Promise<void> {
  const uris = await getPlaylistTrackUris(c, playlistId);
  if (uris.length <= cap) return;
  const remove = uris.slice(0, uris.length - cap).map((uri) => ({ uri }));
  await c.del(`/playlists/${playlistId}/tracks`, { tracks: remove });
}

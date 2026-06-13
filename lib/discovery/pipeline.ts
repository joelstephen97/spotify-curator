import type { Signals } from "./profile";
import { buildProfile, seenKeys } from "./profile";
import type { Suggestion } from "./recommend";
import type { ResolvedTrack } from "@/lib/spotify/search";

export interface PipelineDeps {
  getSignals: () => Promise<Signals>;
  recommend: (
    profile: ReturnType<typeof buildProfile>,
    count: number,
  ) => Promise<Suggestion[]>;
  resolve: (s: Suggestion) => Promise<ResolvedTrack | null>;
  isSeen: (key: string) => Promise<boolean>;
  addTracks: (uris: string[]) => Promise<void>;
  markSeen: (keys: string[]) => Promise<void>;
  setLatestPicks: (
    picks: {
      artist: string;
      title: string;
      reason: string;
      uri: string;
      image: string | null;
      previewUrl: string | null;
    }[],
  ) => Promise<void>;
  onStep?: (msg: string) => void | Promise<void>;
}

export async function runDiscovery(
  deps: PipelineDeps,
  opts: { targetCount: number },
) {
  await deps.onStep?.("Reading your taste profile…");
  const signals = await deps.getSignals();
  const profile = buildProfile(signals);

  await deps.onStep?.("Asking Claude for fresh tracks…");
  const suggestions = await deps.recommend(
    profile,
    Math.ceil(opts.targetCount * 1.5),
  );

  await deps.onStep?.(
    `Got ${suggestions.length} ideas — finding them on Spotify…`,
  );
  const added: {
    artist: string;
    title: string;
    reason: string;
    uri: string;
    image: string | null;
    previewUrl: string | null;
  }[] = [];
  for (const s of suggestions) {
    if (added.length >= opts.targetCount) break;
    if (await deps.isSeen(`artist:${s.artist.toLowerCase()}`)) continue;
    if (
      await deps.isSeen(
        `track:${s.artist.toLowerCase()} - ${s.title.toLowerCase()}`,
      )
    )
      continue;
    // A single failed search must never abort the whole run.
    let resolved: ResolvedTrack | null = null;
    try {
      resolved = await deps.resolve(s);
    } catch {
      resolved = null;
    }
    if (!resolved) continue;
    if (added.some((a) => a.uri === resolved.uri)) continue;
    added.push({
      ...s,
      uri: resolved.uri,
      image: resolved.image,
      previewUrl: resolved.previewUrl,
    });
  }

  await deps.onStep?.(`Adding ${added.length} new tracks to your playlist…`);

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

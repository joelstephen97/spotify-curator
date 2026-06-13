import type { Signals } from "./profile";
import { buildProfile, seenKeys } from "./profile";
import type { Suggestion } from "./recommend";

export interface PipelineDeps {
  getSignals: () => Promise<Signals>;
  recommend: (
    profile: ReturnType<typeof buildProfile>,
    count: number,
  ) => Promise<Suggestion[]>;
  resolve: (s: Suggestion) => Promise<string | null>;
  isSeen: (key: string) => Promise<boolean>;
  addTracks: (uris: string[]) => Promise<void>;
  markSeen: (keys: string[]) => Promise<void>;
  setLatestPicks: (
    picks: { artist: string; title: string; reason: string; uri: string }[],
  ) => Promise<void>;
}

export async function runDiscovery(
  deps: PipelineDeps,
  opts: { targetCount: number },
) {
  const signals = await deps.getSignals();
  const profile = buildProfile(signals);
  const suggestions = await deps.recommend(
    profile,
    Math.ceil(opts.targetCount * 1.5),
  );

  const added: {
    artist: string;
    title: string;
    reason: string;
    uri: string;
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

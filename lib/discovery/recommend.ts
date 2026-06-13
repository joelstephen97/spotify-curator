import Anthropic from "@anthropic-ai/sdk";
import type { Profile } from "./profile";

export interface Suggestion {
  artist: string;
  title: string;
  reason: string;
}

// Static curator instructions — the stable prefix we cache across calls.
const SYSTEM =
  "You are an expert music curator with deep, eclectic knowledge across genres, eras, and scenes. " +
  "Your job: suggest NEW tracks the listener likely has not heard, chosen to genuinely match their taste. " +
  "Rules: never suggest an artist they already listen to; favour fresh, lesser-heard picks over obvious hits; " +
  "order your list best-first. For EACH track, the 'reason' must be a specific, vivid 1–2 sentence pitch that " +
  "(a) ties it to their taste — name a genre, artist, or recent play it connects to — and (b) says what makes the " +
  "track itself great: the hook, the mood, the production, or an exact moment to listen for. No generic filler, " +
  "no repeating the title back, no 'if you like X you'll like this' clichés.";

const TOOL: Anthropic.Tool = {
  name: "suggest_tracks",
  description: "Return new track suggestions the listener has not heard.",
  // Cache the (stable) tool definition. Cache prefix order is tools → system →
  // messages, so this + the system block form the cached prefix; the per-user
  // message stays uncached. Note: caching only activates when the cached prefix
  // exceeds the model's minimum (1024 tokens for opus-4-8) — otherwise it's a
  // harmless no-op.
  cache_control: { type: "ephemeral" },
  input_schema: {
    type: "object",
    properties: {
      tracks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            artist: { type: "string" },
            title: { type: "string" },
            reason: {
              type: "string",
              description:
                "A vivid 1–2 sentence pitch: connect it to the listener's taste (a genre, artist, or recent track) AND say what makes the track itself great — the hook, mood, production, or a moment to listen for. No generic filler.",
            },
          },
          required: ["artist", "title", "reason"],
        },
      },
    },
    required: ["tracks"],
  },
};

export async function recommend(
  client: Anthropic,
  profile: Profile,
  count: number,
): Promise<Suggestion[]> {
  // Only the per-user taste data varies — keep it in the (uncached) message.
  const prompt = [
    `Return exactly ${count} suggestions.`,
    `Top genres: ${profile.topGenres.join(", ")}`,
    `Favourite artists (avoid these): ${profile.artists.join(", ")}`,
    `Recent plays: ${profile.recentTracks.join("; ")}`,
  ].join("\n");

  const res = await client.messages.create({
    // Haiku 4.5: fast, near-frontier, and far cheaper for this curation task.
    // Override with DISCOVERY_MODEL if you ever want a larger model.
    model: process.env.DISCOVERY_MODEL ?? "claude-haiku-4-5-20251001",
    // Generous headroom: many suggestions, each with a real reason. Too small a
    // budget truncates the tool output and silently yields zero usable picks.
    max_tokens: 8192,
    // Prompt caching: cache the stable instructions prefix (explicit breakpoint).
    // We deliberately do NOT use automatic top-level caching, which would key the
    // breakpoint on the varying user message and never hit.
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    tools: [TOOL],
    tool_choice: { type: "tool", name: "suggest_tracks" },
    messages: [{ role: "user", content: prompt }],
  });

  const block = res.content.find(
    (b: { type: string }) => b.type === "tool_use",
  ) as { input: { tracks: Suggestion[] } } | undefined;
  return block?.input.tracks ?? [];
}

export function defaultAnthropic(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

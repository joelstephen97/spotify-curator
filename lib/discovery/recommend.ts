import Anthropic from "@anthropic-ai/sdk";
import type { Profile } from "./profile";

export interface Suggestion {
  artist: string;
  title: string;
  reason: string;
}

const TOOL: Anthropic.Tool = {
  name: "suggest_tracks",
  description: "Return new track suggestions the listener has not heard.",
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
            reason: { type: "string" },
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

  const block = res.content.find(
    (b: { type: string }) => b.type === "tool_use",
  ) as { input: { tracks: Suggestion[] } } | undefined;
  return block?.input.tracks ?? [];
}

export function defaultAnthropic(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

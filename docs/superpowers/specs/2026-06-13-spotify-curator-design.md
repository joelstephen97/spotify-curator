# Spotify Curator — Design

**Date:** 2026-06-13
**Status:** Approved (architecture), proceeding to implementation plan
**Owner:** Joel Stephen

## Summary

A single-user, AI-powered Spotify companion deployed on Vercel and published as a
public GitHub portfolio repo. It does three things:

1. **Auto-discovery** — a weekly scheduled job uses Claude to suggest *new* tracks
   (artists/songs not in your history), resolves them on Spotify, and adds them to a
   dedicated, bot-owned playlist. Each pick comes with a one-line "why".
2. **Smart curation** — build playlists from songs already in your library, filtered
   by mood / era / genre / listening patterns.
3. **Stats dashboard** — top artists/tracks/genres and recent listening, with a view
   to hand-pick suggested adds.

### Why this shape

Spotify deprecated key Web API endpoints for new apps in **November 2024**
(Recommendations, Related Artists, audio-features/audio-analysis, 30-second
previews). This tool therefore builds recommendations from endpoints that *still*
work — top tracks/artists, recently played, saved tracks, playlist read/write,
search — and uses **Claude** as the recommendation engine in place of Spotify's
retired one. The LLM angle is also the portfolio differentiator: it explains *why*
each track was chosen.

## Tech stack

- **Next.js (App Router) + TypeScript** — one repo: dashboard UI + API routes + cron route.
- **Tailwind CSS + shadcn/ui** — polished dashboard for the portfolio.
- **Vercel** — hosting; **Vercel Cron** — weekly trigger.
- **Upstash Redis** (Vercel Marketplace) — stores the Spotify refresh token and a
  "already seen" track/artist cache for dedup.
- **Spotify Web API** — direct `fetch` calls (no heavy SDK).
- **Anthropic Claude API** (`@anthropic-ai/sdk`) — discovery + explanations.
  Model: `claude-opus-4-8` (the `claude-api` skill's default; user named no model).
  Structured suggestions via a forced tool call (`tool_choice` → `suggest_tracks`).

## Architecture

```
spotify-curator/  (Next.js App Router, deployed on Vercel)
│
├── Dashboard (/)                  ← log in with Spotify (OAuth)
│   ├── Stats view                 ← top artists/tracks/genres, recent plays
│   ├── Curation view              ← build mood/era/genre playlists from your library
│   └── Discoveries view           ← this week's AI picks + "why", approve/skip
│
├── API routes
│   ├── /api/auth/*                ← Spotify OAuth (login, callback, refresh)
│   ├── /api/stats                 ← reads top/recent/saved from Spotify
│   ├── /api/curate                ← builds playlist from your own library
│   └── /api/discover              ← LLM discovery pipeline (manual trigger)
│
├── /api/cron/discover             ← Vercel Cron hits weekly; runs headless
│
└── Storage: Upstash Redis         ← refresh token + "already seen" track cache
```

Three external services: **Spotify Web API**, **Claude API**, **Upstash Redis**.

## Components (units, each with one purpose)

- **`lib/spotify/auth.ts`** — OAuth Authorization Code flow: build authorize URL,
  exchange code → tokens, refresh access token. Depends on Spotify token endpoint.
- **`lib/spotify/client.ts`** — thin authenticated fetch wrapper around the Spotify
  Web API: handles bearer token, JSON parsing, and 429 rate-limit retry (`Retry-After`).
- **`lib/spotify/data.ts`** — read helpers: top artists/tracks (short/medium/long
  term), recently played, saved tracks, derived top genres.
- **`lib/spotify/playlist.ts`** — get-or-create the bot-owned playlist, add tracks,
  enforce cap (keep newest ~50, trim oldest), dedupe.
- **`lib/spotify/search.ts`** — resolve a `{artist, title}` suggestion to a Spotify
  track URI via search; pick best match (exact-ish + popularity); return null if not found.
- **`lib/discovery/profile.ts`** — turn raw Spotify signals into a compact taste
  profile (top genres, representative artists, recent vibe) for the prompt.
- **`lib/discovery/recommend.ts`** — build the Claude prompt, call the API with
  structured (JSON) output, return `{artist, title, reason}[]` excluding the seen set.
- **`lib/store/redis.ts`** — Upstash wrapper: get/set refresh token; read/extend the
  seen-set; store latest picks-with-reasons for the dashboard.
- **`app/api/cron/discover/route.ts`** — orchestrates the weekly pipeline (below).
- **`app/(dashboard)/*`** — UI views for stats, curation, discoveries.

Each unit communicates through plain typed inputs/outputs and can be tested with the
external API mocked.

## Discovery pipeline (the weekly job)

1. Vercel Cron calls `/api/cron/discover` (default: **Mondays 06:00**), authorized by
   a `CRON_SECRET` header check.
2. Load refresh token from Redis → exchange for a fresh access token.
3. Fetch signals: top artists (short+medium+long term), top tracks, recently played,
   saved tracks.
4. Build the taste profile (top genres, representative artists, recent vibe).
5. Load the **seen-set** from Redis (everything already known/previously suggested).
6. Prompt Claude: "Given this profile, suggest N new tracks (artist + title) NOT in
   this list, each with a one-line reason." Enforce JSON structured output.
7. Resolve each suggestion via Spotify search → URI. Drop: not found, already in
   library, already in playlist, duplicates.
8. Get-or-create the bot-owned playlist (`🤖 Weekly Discoveries`).
9. Add new tracks additively; trim to the most recent ~50.
10. Update the Redis seen-set; store this week's picks + reasons for the dashboard.

Idempotent: re-running the same week adds nothing new because resolved URIs are
deduped against the playlist and seen-set.

## Data flow (dashboard)

Browser → `/api/auth/login` → Spotify consent → `/api/auth/callback` stores tokens
(access token in an httpOnly session cookie; refresh token in Redis for the cron job).
Dashboard views call `/api/stats`, `/api/curate`, `/api/discover`, which call Spotify
on the user's behalf and render results. Curation: user picks criteria → server filters
their library → creates a new playlist.

## Error handling

- **Token refresh failure** — surface a clear "reconnect Spotify" state in the
  dashboard; cron logs and exits non-fatally (no partial writes).
- **Spotify 429** — respect `Retry-After`, bounded retries in the client wrapper.
- **Claude returns a track that doesn't exist** — search resolution returns null; the
  pick is silently dropped (logged), pipeline continues. We over-request from Claude
  (e.g. ask for 1.5× the target) to absorb drop-out.
- **Empty/insufficient history** — fall back to top genres only; if still empty, skip
  the run and log.
- **Cron auth** — reject requests without the correct `CRON_SECRET`.

## Testing (TDD)

- **Unit (mocked APIs):** search resolution (best-match + not-found), playlist cap/
  trim/dedupe, profile building, prompt assembly, seen-set dedup, 429 retry logic.
- **Pipeline:** end-to-end discovery with Spotify + Claude mocked — asserts only new,
  resolvable, unseen tracks reach the playlist and the seen-set/picks store updates.
- **Auth:** code→token exchange and refresh with the token endpoint mocked.

## Portfolio deliverables

- Public GitHub repo with a clean README (what/why, the Nov-2024 API-deprecation
  story, architecture diagram, screenshots, setup steps, live demo link).
- Live Vercel deployment.
- `.env.example` documenting required secrets; no secrets committed.

## Out of scope (YAGNI)

- Multi-user support / accounts.
- Push/email notifications.
- Last.fm hybrid sourcing (Claude-only for v1; can add later).
- Mobile app.

# Spotify Curator

An AI-powered Spotify companion: a stats dashboard, one-click library curation, and a weekly job that uses Claude to find new music and drop it into a dedicated playlist — with a one-line reason for every pick.

Built with Next.js on Vercel. Single-user by design (it's my own listening assistant), and a worked example of building on the Spotify API *after* the 2024 endpoint cuts.

## Why it works this way

In November 2024 Spotify deprecated a large part of the Web API for newly created apps, including the Recommendations endpoint, Related Artists, audio-features/audio-analysis, and 30-second previews. The classic "feed it seed tracks, get recommendations back" approach no longer works for new apps.

What still works: your top tracks and artists, recently played, saved tracks, search, and playlist read/write. So this project builds a taste profile from those signals and hands it to **Claude**, which suggests new artists and tracks the listener probably hasn't heard. Each suggestion is resolved back to a real Spotify track via search before it's added. The LLM stands in for the recommendation engine Spotify retired, and it can explain itself, which the old endpoint never could.

## Features

- **Stats** — top artists, top genres, and recent plays, read live from your account.
- **Curate** — build a new playlist from your saved (liked) tracks.
- **Weekly discovery** — a scheduled job asks Claude for new tracks based on your listening, resolves them on Spotify, and adds them to a bot-owned `🤖 Weekly Discoveries` playlist (capped, deduped against what you've already heard). It never touches your existing playlists.

## Architecture

```
spotify-curator/  (Next.js App Router on Vercel)
│
├── Dashboard (/, /curate, /discoveries)   ← log in with Spotify
├── API routes
│   ├── /api/auth/*        ← Spotify OAuth (login, callback)
│   ├── /api/stats         ← top/recent/saved from Spotify
│   ├── /api/curate        ← playlist from your library
│   └── /api/discover      ← latest picks (GET) + manual trigger (POST)
├── /api/cron/discover     ← Vercel Cron hits this weekly, runs headless
│
└── lib/
    ├── spotify/{auth,client,data,search,playlist}.ts
    ├── discovery/{profile,recommend,pipeline,run}.ts
    ├── store/redis.ts     ← refresh token + "already seen" cache
    └── session.ts         ← signed httpOnly session cookie
```

The `lib/` modules are pure and unit-tested with the external APIs mocked; the API routes are thin composition over them.

## Tech stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS** for the dashboard
- **Vitest** for unit and pipeline tests
- **Upstash Redis** for the refresh token and dedup cache
- **Spotify Web API** (direct `fetch`)
- **Anthropic Claude** (`claude-opus-4-8`) for discovery and the per-pick reasons

## Local setup

1. Create a Spotify app at the [developer dashboard](https://developer.spotify.com/dashboard) and add a redirect URI of `http://127.0.0.1:3000/api/auth/callback`.
2. Create an [Upstash Redis](https://upstash.com) database (free tier is enough) and grab its REST URL and token.
3. Get an [Anthropic API key](https://console.anthropic.com).
4. Copy the env template and fill it in:
   ```bash
   cp .env.example .env.local
   ```
   `SESSION_SECRET` and `CRON_SECRET` can be any long random strings (e.g. `openssl rand -hex 32`).
5. Install and run:
   ```bash
   npm install
   npm run dev
   ```
6. Open `http://127.0.0.1:3000`, click **Connect Spotify**, and you're in.

Run the tests with `npm run test`.

## Deploy on Vercel

1. Push this repo to GitHub and import it into Vercel.
2. Add every variable from `.env.example` to the project's environment variables. Set `SPOTIFY_REDIRECT_URI` to `https://<your-app>.vercel.app/api/auth/callback` and add that same URI to your Spotify app.
3. Vercel reads `vercel.json` and registers the weekly cron (`/api/cron/discover`, Mondays 06:00 UTC). With `CRON_SECRET` set, Vercel sends it as a bearer token and the route rejects anything else.
4. Connect Spotify once in the deployed app so the refresh token lands in Redis, then trigger a run from the **Discoveries** tab to confirm the playlist fills.

## License

MIT

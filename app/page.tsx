"use client";

import { useEffect, useState } from "react";

interface Artist {
  id: string;
  name: string;
  genres: string[];
}
interface Track {
  id: string;
  name: string;
  artist: string;
}
interface Stats {
  topArtists: Artist[];
  topTracks: Track[];
  recent: Track[];
  topGenres: string[];
}

export default function StatsPage() {
  const [data, setData] = useState<Stats | null>(null);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then(async (r) => {
        if (r.status === 401) {
          setConnected(false);
          return null;
        }
        return (await r.json()) as Stats;
      })
      .then((d) => d && setData(d))
      .catch(() => setConnected(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-neutral-400">Loading…</p>;

  if (!connected)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Connect your Spotify</h1>
        <p className="text-neutral-400">
          See your top artists, genres, and recent plays — and let the weekly AI
          discovery job fill a playlist for you.
        </p>
        <a
          href="/api/auth/login"
          className="inline-block rounded-full bg-emerald-500 px-5 py-2.5 font-medium text-neutral-950 transition-colors hover:bg-emerald-400"
        >
          Connect Spotify
        </a>
      </div>
    );

  if (!data) return <p className="text-neutral-400">No data.</p>;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Top genres
        </h2>
        <div className="flex flex-wrap gap-2">
          {data.topGenres.map((g) => (
            <span
              key={g}
              className="rounded-full bg-neutral-800 px-3 py-1 text-sm text-neutral-200"
            >
              {g}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Top artists
        </h2>
        <ol className="space-y-1">
          {data.topArtists.slice(0, 10).map((a, i) => (
            <li key={a.id} className="flex gap-3">
              <span className="w-5 text-right text-neutral-600">{i + 1}</span>
              <span>{a.name}</span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Recently played
        </h2>
        <ul className="space-y-1 text-sm">
          {data.recent.slice(0, 12).map((t, i) => (
            <li key={`${t.id}-${i}`} className="text-neutral-300">
              {t.name} <span className="text-neutral-500">— {t.artist}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

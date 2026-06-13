"use client";

import { useEffect, useState } from "react";

interface Pick {
  artist: string;
  title: string;
  reason: string;
  uri: string;
}

export default function DiscoveriesPage() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = () =>
    fetch("/api/discover")
      .then((r) => r.json())
      .then((d: { picks: Pick[] }) => setPicks(d.picks ?? []))
      .catch(() => {});

  useEffect(() => {
    load();
  }, []);

  async function runNow() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/discover", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setMessage(
          body.error === "not_connected"
            ? "Connect Spotify first (on the Stats tab)."
            : `Discovery failed: ${body.error ?? res.status}`,
        );
      } else {
        setMessage(`Added ${body.added} new track(s).`);
        await load();
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          This week&apos;s picks
        </h1>
        <button
          onClick={runNow}
          disabled={running}
          className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
        >
          {running ? "Running…" : "Run discovery now"}
        </button>
      </div>

      {message && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">{message}</p>
      )}

      {picks.length === 0 ? (
        <p className="text-neutral-600 dark:text-neutral-400">
          No discoveries yet. Run it now, or wait for the weekly job.
        </p>
      ) : (
        <ul className="space-y-3">
          {picks.map((p) => (
            <li
              key={p.uri}
              className="rounded-lg border border-black/10 p-4 dark:border-white/10"
            >
              <div className="font-medium text-neutral-900 dark:text-neutral-100">
                {p.title}{" "}
                <span className="text-neutral-500">— {p.artist}</span>
              </div>
              <p className="mt-1 text-sm text-neutral-500">{p.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

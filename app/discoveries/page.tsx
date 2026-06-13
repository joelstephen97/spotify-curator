"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface Pick {
  artist: string;
  title: string;
  reason: string;
  uri: string;
}
interface Status {
  state: "idle" | "running" | "done" | "error";
  step: string;
  added?: number;
  error?: string;
}

const ERROR_COPY: Record<string, string> = {
  not_connected: "Connect Spotify first (on the Stats tab).",
};

export default function DiscoveriesPage() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [status, setStatus] = useState<Status>({ state: "idle", step: "" });
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPicks = useCallback(async () => {
    try {
      const r = await fetch("/api/discover");
      const d = await r.json();
      setPicks(d.picks ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (poll.current) {
      clearInterval(poll.current);
      poll.current = null;
    }
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/discover/status");
      const s: Status = await r.json();
      setStatus(s);
      if (s.state === "done") {
        stopPolling();
        await loadPicks();
      } else if (s.state === "error") {
        stopPolling();
      }
    } catch {
      /* keep polling */
    }
  }, [loadPicks, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    poll.current = setInterval(checkStatus, 2500);
  }, [checkStatus, stopPolling]);

  // On mount: load picks + resume a run already in progress (e.g. user left and
  // came back, or the weekly cron is mid-flight).
  useEffect(() => {
    loadPicks();
    fetch("/api/discover/status")
      .then((r) => r.json())
      .then((s: Status) => {
        setStatus(s);
        if (s.state === "running") startPolling();
      })
      .catch(() => {});
    return stopPolling;
  }, [loadPicks, startPolling, stopPolling]);

  async function runNow() {
    setStatus({ state: "running", step: "Starting…" });
    startPolling();
    try {
      const res = await fetch("/api/discover", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        stopPolling();
        setStatus({
          state: "error",
          step: "",
          error: ERROR_COPY[body.error] ?? body.error ?? `HTTP ${res.status}`,
        });
      }
    } catch {
      stopPolling();
      setStatus({ state: "error", step: "", error: "Couldn't reach the server." });
    }
  }

  const running = status.state === "running";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400/80">
            AI discovery
          </p>
          <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight">
            This week&apos;s picks
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Claude studies your taste and drops fresh, unheard tracks into your{" "}
            <span className="font-medium">🤖 Weekly Discoveries</span> playlist.
          </p>
        </div>
        <button
          onClick={runNow}
          disabled={running}
          className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
        >
          {running ? "Working…" : "✦ Run discovery now"}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {running && (
          <motion.div
            key="running"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] p-6"
          >
            <div className="flex items-center gap-3">
              <Pulse />
              <div className="min-w-0">
                <p className="font-display text-lg font-bold text-emerald-700 dark:text-emerald-300">
                  Claude is composing your picks…
                </p>
                <p className="truncate text-sm text-neutral-600 dark:text-neutral-300">
                  {status.step || "Starting…"}
                </p>
              </div>
            </div>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/15">
              <motion.div
                className="h-full w-1/3 rounded-full bg-emerald-500"
                animate={{ x: ["-110%", "330%"] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              This takes ~30–60s. You can leave this page — it keeps running, and
              your picks will be here when you&apos;re back.
            </p>
          </motion.div>
        )}

        {status.state === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] px-5 py-4"
          >
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              ✓ Added {status.added ?? 0} new track{status.added === 1 ? "" : "s"} to
              your playlist.
            </p>
          </motion.div>
        )}

        {status.state === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-red-500/30 bg-red-500/[0.07] px-5 py-4"
          >
            <p className="text-sm font-medium text-red-600 dark:text-red-300">
              {(status.error && ERROR_COPY[status.error]) ||
                status.error ||
                "Discovery failed."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {picks.length === 0 ? (
        !running && (
          <p className="text-neutral-600 dark:text-neutral-400">
            No discoveries yet. Hit{" "}
            <span className="font-medium">Run discovery now</span>, or wait for the
            weekly job.
          </p>
        )
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {picks.map((p, i) => (
            <motion.li
              key={p.uri}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className="group rounded-xl border border-black/10 p-4 transition-colors hover:border-emerald-500/40 dark:border-white/10"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                    {p.title}
                  </div>
                  <div className="truncate text-sm text-neutral-500">{p.artist}</div>
                </div>
                <a
                  href={`https://open.spotify.com/track/${p.uri.split(":").pop()}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-full border border-emerald-500/40 px-3 py-1 text-xs font-medium text-emerald-700 opacity-0 transition-opacity group-hover:opacity-100 dark:text-emerald-300"
                >
                  Open ↗
                </a>
              </div>
              <p className="mt-2 text-sm text-neutral-500">{p.reason}</p>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Pulse() {
  return (
    <span className="relative flex h-3 w-3 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
    </span>
  );
}

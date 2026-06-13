"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

// A spotify: URI deep-links to the installed desktop/mobile app (not the web
// player). p.uri is already "spotify:track:<id>".
const openInApp = (uri: string) => {
  window.location.href = uri;
};

interface Pick {
  artist: string;
  title: string;
  reason: string;
  uri: string;
  image?: string | null;
  previewUrl?: string | null;
}
interface Status {
  state: "idle" | "running" | "done" | "error";
  step: string;
  added?: number;
  playlistUpdated?: boolean;
  error?: string;
}

const ERROR_COPY: Record<string, string> = {
  not_connected: "Connect Spotify first (on the Stats tab).",
  spotify_write_forbidden:
    "Spotify blocked playlist changes (403). Your app is in Development Mode — add your Spotify account under Settings → User Management in the Spotify Developer Dashboard (or request Extended Quota Mode), then reconnect.",
};

export default function DiscoveriesPage() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [status, setStatus] = useState<Status>({ state: "idle", step: "" });
  const [nowPlaying, setNowPlaying] = useState<string | null>(null);
  const [playMsg, setPlayMsg] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  // Click a pick → start it on the user's active Spotify device (replacing
  // whatever's playing). Falls back to opening the app when there's no active
  // device or playback is blocked.
  const playPick = useCallback(async (p: Pick) => {
    setPlayMsg(null);
    setNowPlaying(p.uri);
    try {
      const res = await fetch("/api/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri: p.uri }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        setPlayMsg(`▶ Playing “${p.title}” on your Spotify.`);
        return;
      }
      setNowPlaying(null);
      if (body.reason === "no_device") {
        setPlayMsg(
          "No active Spotify device — opening the app. Start playing once there, then clicks control it.",
        );
        openInApp(p.uri);
      } else if (body.reason === "forbidden") {
        setPlayMsg(
          "Playback needs Spotify Premium + an active device (and may be blocked in Development Mode).",
        );
      } else if (body.error === "not_connected") {
        setPlayMsg("Connect Spotify first (on the Stats tab).");
      } else {
        setPlayMsg("Couldn’t start playback — opening it in the app instead.");
        openInApp(p.uri);
      }
    } catch {
      setNowPlaying(null);
      openInApp(p.uri);
    }
  }, []);

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
            {status.playlistUpdated ? (
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                ✓ Added {status.added ?? 0} new track
                {status.added === 1 ? "" : "s"} to your playlist.
              </p>
            ) : (
              <div className="text-sm text-emerald-700 dark:text-emerald-300">
                <p className="font-medium">
                  ✓ Found {status.added ?? 0} fresh pick
                  {status.added === 1 ? "" : "s"} for you — listed below.
                </p>
                <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                  Auto-adding them to a Spotify playlist needs Extended Quota Mode
                  — Spotify blocks playlist writes for apps in Development Mode.
                  For now, click any pick to play it on your Spotify.
                </p>
              </div>
            )}
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

      {playMsg && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {playMsg}
        </p>
      )}

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
              onClick={() => playPick(p)}
              onKeyDown={(e) => {
                if (e.key === "Enter") playPick(p);
              }}
              role="button"
              tabIndex={0}
              title="Click to play on your Spotify"
              className={`group flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors focus:outline-none focus-visible:border-emerald-500/60 ${
                nowPlaying === p.uri
                  ? "border-emerald-500/50 bg-emerald-500/[0.06]"
                  : "border-black/10 hover:border-emerald-500/40 hover:bg-black/[0.02] dark:border-white/10 dark:hover:bg-white/[0.03]"
              }`}
            >
              <Cover pick={p} active={nowPlaying === p.uri} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                      {p.title}
                    </div>
                    <div className="truncate text-sm text-neutral-500">{p.artist}</div>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-emerald-400">
                    {nowPlaying === p.uri ? "Playing ♪" : "Play ▶"}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-3 text-sm text-neutral-500">{p.reason}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Cover({ pick, active }: { pick: Pick; active: boolean }) {
  return (
    <div className="relative h-14 w-14 shrink-0">
      {pick.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pick.image}
          alt=""
          loading="lazy"
          className="h-14 w-14 rounded-md object-cover"
        />
      ) : (
        <div className="grid h-14 w-14 place-items-center rounded-md bg-black/5 text-sm font-bold text-neutral-400 dark:bg-white/10">
          {pick.title.charAt(0).toUpperCase()}
        </div>
      )}
      {/* Play affordance on hover; steady indicator when this pick is playing. */}
      <div
        className="absolute inset-0 grid place-items-center rounded-md bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100"
        style={active ? { opacity: 1 } : undefined}
      >
        <span className="text-lg leading-none">{active ? "♪" : "▶"}</span>
      </div>
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

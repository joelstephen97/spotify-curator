"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";

interface Artist {
  id: string;
  name: string;
  genres: string[];
  image: string | null;
}
interface Track {
  id: string;
  name: string;
  artist: string;
  image: string | null;
}
interface Stats {
  range: string;
  topArtists: Artist[];
  topTracks: Track[];
  recent: Track[];
  topGenres: string[];
}

type Status = "loading" | "ready" | "error" | "disconnected";

const TABS = [
  { key: "short_term", label: "4 weeks", sub: "Recent obsessions" },
  { key: "medium_term", label: "6 months", sub: "This era" },
  { key: "long_term", label: "All-time", sub: "The canon" },
] as const;

function Rise({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Art({
  src,
  alt,
  rounded,
  size = "h-12 w-12",
}: {
  src: string | null;
  alt: string;
  rounded: string;
  size?: string;
}) {
  if (src)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`${size} ${rounded} shrink-0 object-cover`}
      />
    );
  return (
    <div
      className={`${size} ${rounded} grid shrink-0 place-items-center bg-black/5 text-sm font-bold text-neutral-400 dark:bg-white/10`}
    >
      {alt.charAt(0).toUpperCase()}
    </div>
  );
}

export default function StatsPage() {
  const [range, setRange] = useState<string>("medium_term");
  const [cache, setCache] = useState<Record<string, Stats>>({});
  const [status, setStatus] = useState<Status>("loading");
  const [detail, setDetail] = useState<string | null>(null);

  const load = useCallback(
    async (r: string) => {
      if (cache[r]) {
        setStatus("ready");
        return;
      }
      setStatus("loading");
      setDetail(null);

      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 20_000);
      try {
        const res = await fetch(`/api/stats?range=${r}`, { signal: ctrl.signal });
        const body = await res.json().catch(() => ({}));
        if (res.status === 401 && body.error === "not_connected") {
          setStatus("disconnected");
          return;
        }
        if (!res.ok) {
          setDetail(body.detail || body.error || `HTTP ${res.status}`);
          setStatus("error");
          return;
        }
        setCache((c) => ({ ...c, [r]: body as Stats }));
        setStatus("ready");
      } catch (e) {
        setDetail(
          e instanceof DOMException && e.name === "AbortError"
            ? "Request timed out after 20s — Spotify or the server didn't respond."
            : e instanceof Error
              ? e.message
              : "Unknown error",
        );
        setStatus("error");
      } finally {
        clearTimeout(timeout);
      }
    },
    [cache],
  );

  useEffect(() => {
    load(range);
  }, [range, load]);

  const data = cache[range];
  const activeTab = TABS.find((t) => t.key === range)!;

  if (status === "disconnected") return <Disconnected />;

  return (
    <div className="space-y-10">
      <Rise className="space-y-5">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400/80">
          Listening report
        </p>
        <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
          What you&apos;ve had
          <br />
          <span className="text-emerald-600 dark:text-emerald-400">
            on repeat.
          </span>
        </h1>

        <div className="flex flex-wrap gap-2 pt-2">
          {TABS.map((t) => {
            const active = t.key === range;
            return (
              <button
                key={t.key}
                onClick={() => setRange(t.key)}
                className={`group rounded-full border px-4 py-2 text-left transition-colors ${
                  active
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : "border-black/10 hover:border-black/25 dark:border-white/10 dark:hover:border-white/25"
                }`}
              >
                <span
                  className={`block text-sm font-semibold ${
                    active
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-neutral-700 dark:text-neutral-200"
                  }`}
                >
                  {t.label}
                </span>
                <span className="block text-[11px] text-neutral-500">
                  {t.sub}
                </span>
              </button>
            );
          })}
        </div>
      </Rise>

      {status === "error" && (
        <ErrorCard detail={detail} onRetry={() => load(range)} />
      )}

      {status === "loading" && !data && <Skeleton />}

      {data && (
        <div className={status === "loading" ? "opacity-40 transition-opacity" : ""}>
          <Report data={data} label={activeTab.label} />
        </div>
      )}
    </div>
  );
}

function Report({ data, label }: { data: Stats; label: string }) {
  const topArtist = data.topArtists[0];
  const topTrack = data.topTracks[0];

  return (
    <div className="space-y-12">
      {(topArtist || topTrack) && (
        <Rise delay={0.04}>
          <div className="grid gap-4 sm:grid-cols-2">
            {topArtist && (
              <Spotlight
                kicker="#1 artist"
                image={topArtist.image}
                rounded="rounded-full"
                primary={topArtist.name}
                secondary={topArtist.genres.slice(0, 2).join(" · ")}
              />
            )}
            {topTrack && (
              <Spotlight
                kicker="#1 track"
                image={topTrack.image}
                rounded="rounded-lg"
                primary={topTrack.name}
                secondary={topTrack.artist}
              />
            )}
          </div>
        </Rise>
      )}

      {data.topGenres.length > 0 && (
        <Rise delay={0.1}>
          <SectionLabel>Top genres · {label}</SectionLabel>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            {data.topGenres.map((g, i) => (
              <span
                key={g}
                className="font-display font-bold leading-none text-neutral-700 transition-colors hover:text-emerald-600 dark:text-neutral-300 dark:hover:text-emerald-300"
                style={{
                  fontSize: `${Math.max(0.9, 2.1 - i * 0.12)}rem`,
                  opacity: Math.max(0.5, 1 - i * 0.045),
                }}
              >
                {g}
              </span>
            ))}
          </div>
        </Rise>
      )}

      <div className="grid gap-12 sm:grid-cols-2">
        <Rise delay={0.16}>
          <SectionLabel>Top artists</SectionLabel>
          <Ranked
            items={data.topArtists.slice(0, 10).map((a) => ({
              id: a.id,
              image: a.image,
              rounded: "rounded-full",
              primary: a.name,
            }))}
          />
        </Rise>

        <Rise delay={0.22}>
          <SectionLabel>Top tracks</SectionLabel>
          <Ranked
            items={data.topTracks.slice(0, 10).map((t) => ({
              id: t.id,
              image: t.image,
              rounded: "rounded-md",
              primary: t.name,
              secondary: t.artist,
            }))}
          />
        </Rise>
      </div>

      {data.recent.length > 0 && (
        <Rise delay={0.28}>
          <SectionLabel>Recently played</SectionLabel>
          <ul className="space-y-1">
            {data.recent.slice(0, 12).map((t, i) => (
              <li
                key={`${t.id}-${i}`}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.03]"
              >
                <Art
                  src={t.image}
                  alt={t.name}
                  rounded="rounded"
                  size="h-9 w-9"
                />
                <span className="min-w-0">
                  <span className="block truncate text-neutral-800 dark:text-neutral-200">
                    {t.name}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">
                    {t.artist}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Rise>
      )}
    </div>
  );
}

function Spotlight({
  kicker,
  image,
  rounded,
  primary,
  secondary,
}: {
  kicker: string;
  image: string | null;
  rounded: string;
  primary: string;
  secondary: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-black/5 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <Art src={image} alt={primary} rounded={rounded} size="h-20 w-20" />
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-600 dark:text-emerald-400/80">
          {kicker}
        </p>
        <p className="mt-1 truncate font-display text-xl font-bold leading-tight">
          {primary}
        </p>
        {secondary && (
          <p className="truncate text-sm text-neutral-500">{secondary}</p>
        )}
      </div>
    </div>
  );
}

function Ranked({
  items,
}: {
  items: {
    id: string;
    image: string | null;
    rounded: string;
    primary: string;
    secondary?: string;
  }[];
}) {
  return (
    <ol className="space-y-1">
      {items.map((it, i) => (
        <li
          key={`${it.id}-${i}`}
          className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.03]"
        >
          <span className="w-6 text-right font-display text-lg font-extrabold tabular-nums text-neutral-300 transition-colors group-hover:text-emerald-600 dark:text-neutral-700 dark:group-hover:text-emerald-400">
            {i + 1}
          </span>
          <Art src={it.image} alt={it.primary} rounded={it.rounded} size="h-11 w-11" />
          <span className="min-w-0">
            <span className="block truncate font-medium text-neutral-900 dark:text-neutral-100">
              {it.primary}
            </span>
            {it.secondary && (
              <span className="block truncate text-xs text-neutral-500">
                {it.secondary}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-neutral-500">
      {children}
    </h2>
  );
}

function ErrorCard({
  detail,
  onRetry,
}: {
  detail: string | null;
  onRetry: () => void;
}) {
  return (
    <Rise className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
      <h2 className="font-display text-lg font-bold text-red-600 dark:text-red-300">
        Couldn&apos;t load your stats
      </h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        {detail ?? "Something went wrong talking to Spotify."}
      </p>
      <p className="mt-2 text-xs text-neutral-500">
        Common causes: you haven&apos;t connected yet, the Spotify access expired
        (reconnect below), or the dev server restarted mid-request. Check the
        terminal running the dev server for the full error.
      </p>
      <div className="mt-4 flex gap-3">
        <button
          onClick={onRetry}
          className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-white"
        >
          Try again
        </button>
        <a
          href="/api/auth/login"
          className="rounded-full border border-emerald-500/40 px-4 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
        >
          Reconnect Spotify
        </a>
      </div>
    </Rise>
  );
}

function Skeleton() {
  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5"
          />
        ))}
      </div>
      <div className="grid gap-12 sm:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col} className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-lg bg-black/5 dark:bg-white/5"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const AUTH_ERRORS: Record<string, string> = {
  access_denied: "You declined the Spotify authorization.",
  state_mismatch:
    "Login couldn't be verified (cookies may have been blocked). Please try again.",
  exchange_failed: "Couldn't complete the Spotify login. Please try again.",
};

function Disconnected() {
  const [authError, setAuthError] = useState<string | null>(null);
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("auth_error");
    if (code) setAuthError(AUTH_ERRORS[code] ?? `Login failed (${code}).`);
  }, []);

  return (
    <Rise className="mx-auto max-w-xl space-y-6 py-16 text-center">
      {authError && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          {authError}
        </div>
      )}
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400/80">
        Spotify Curator
      </p>
      <h1 className="font-display text-4xl font-extrabold leading-tight sm:text-5xl">
        See what you actually
        <br />
        <span className="text-emerald-600 dark:text-emerald-400">
          listen to.
        </span>
      </h1>
      <p className="mx-auto max-w-md text-neutral-600 dark:text-neutral-400">
        Connect Spotify to see your top artists, genres, and tracks across the last
        4 weeks, 6 months, and all time — and let the weekly AI job fill a discovery
        playlist for you.
      </p>
      <a
        href="/api/auth/login"
        className="inline-block rounded-full bg-emerald-500 px-6 py-3 font-semibold text-neutral-950 transition-colors hover:bg-emerald-400"
      >
        Connect Spotify
      </a>
    </Rise>
  );
}

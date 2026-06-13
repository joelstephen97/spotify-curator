"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import BigNumber from "@/components/viz/BigNumber";
import Bars from "@/components/viz/Bars";
import PersonalityBadge, {
  type Personality,
} from "@/components/wrapped/PersonalityBadge";
import ImportDropzone from "@/components/wrapped/ImportDropzone";
import { commas, minutesLabel } from "@/lib/format";

interface Artist {
  id: string;
  name: string;
  genres: string[];
  image: string | null;
  popularity?: number;
}
interface Track {
  id: string;
  name: string;
  artist: string;
  image: string | null;
  durationMs?: number;
  popularity?: number;
}
interface Decade {
  decade: string;
  count: number;
}
interface ArtistMinutes {
  artist: string;
  minutes: number;
  tracks: number;
}
interface History {
  totalPlays: number;
  totalMinutes: number;
  since: string | null;
  until: string | null;
  topTracks: { name: string; artist: string; plays: number }[];
  topArtists: { artist: string; plays: number; minutes: number }[];
}
interface Stats {
  range: string;
  profile: { displayName: string; image: string | null; followers: number } | null;
  counts: { followedArtists: number; playlists: number };
  topArtists: Artist[];
  topTracks: Track[];
  recent: Track[];
  topGenres: string[];
  insights: {
    mainstreamScore: number | null;
    explicitShare: number;
    avgTrackLengthMs: number;
    topTracksMinutes: number;
    decades: Decade[];
    perArtistMinutes: ArtistMinutes[];
    personality: Personality;
  };
  history: History | null;
}
interface Library {
  savedTotal: number;
  savedFetched: number;
  isEstimate: boolean;
  libraryMinutes: number;
  explicitShare: number;
  decades: Decade[];
  perArtistMinutes: ArtistMinutes[];
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
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-neutral-500">
      {children}
    </h2>
  );
}

const mmss = (ms?: number) => {
  if (!ms) return "";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const fmtDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

export default function StatsPage() {
  const [range, setRange] = useState<string>("medium_term");
  const [cache, setCache] = useState<Record<string, Stats>>({});
  const [status, setStatus] = useState<Status>("loading");
  const [detail, setDetail] = useState<string | null>(null);
  const [library, setLibrary] = useState<Library | null>(null);

  const load = useCallback(
    async (r: string) => {
      if (cache[r]) {
        setStatus("ready");
        return;
      }
      setStatus("loading");
      setDetail(null);
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 25_000);
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
            ? "Request timed out after 25s — Spotify or the server didn't respond."
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

  // Lazy-load the heavier library analysis once, after first connect.
  useEffect(() => {
    if (status !== "ready" || library) return;
    fetch("/api/library")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => b && !b.error && setLibrary(b as Library))
      .catch(() => {});
  }, [status, library]);

  const data = cache[range];
  const activeTab = TABS.find((t) => t.key === range)!;

  if (status === "disconnected") return <Disconnected />;

  return (
    <div className="space-y-14">
      <Rise className="space-y-5">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400/80">
          {data?.profile?.displayName
            ? `${data.profile.displayName}'s Soundprint`
            : "Soundprint"}
        </p>
        <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
          What you&apos;ve had
          <br />
          <span className="text-emerald-600 dark:text-emerald-400">
            on repeat.
          </span>
        </h1>

        <div className="flex flex-wrap items-center gap-2 pt-2">
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
                <span className="block text-[11px] text-neutral-500">{t.sub}</span>
              </button>
            );
          })}
          <Link
            href="/wrapped"
            className="ml-auto rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400"
          >
            ✦ Create your Soundprint
          </Link>
        </div>
      </Rise>

      {status === "error" && (
        <ErrorCard detail={detail} onRetry={() => load(range)} />
      )}
      {status === "loading" && !data && <Skeleton />}

      {data && (
        <div className={status === "loading" ? "opacity-40 transition-opacity" : ""}>
          <Report data={data} label={activeTab.label} library={library} />
        </div>
      )}
    </div>
  );
}

function Report({
  data,
  label,
  library,
}: {
  data: Stats;
  label: string;
  library: Library | null;
}) {
  const ins = data.insights;
  const topArtist = data.topArtists[0];
  const topTrack = data.topTracks[0];
  const maxPop = Math.max(1, ...data.topArtists.map((a) => a.popularity ?? 0));

  return (
    <div className="space-y-14">
      {/* The brag strip — real, live numbers. Any card with no data (0 or null)
          is left out, so it never reads as broken. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ins.topTracksMinutes > 0 && (
          <BigNumber
            value={ins.topTracksMinutes}
            label="min in your top 50"
            sub="≈ sum of durations"
            accent
          />
        )}
        {!!ins.mainstreamScore && (
          <BigNumber value={ins.mainstreamScore} label="mainstream" suffix="/100" delay={0.04} />
        )}
        {data.topGenres.length > 0 && (
          <BigNumber value={data.topGenres.length} label="genres mapped" delay={0.08} />
        )}
        {data.counts.followedArtists > 0 && (
          <BigNumber value={data.counts.followedArtists} label="artists followed" delay={0.12} />
        )}
        {data.counts.playlists > 0 && (
          <BigNumber value={data.counts.playlists} label="playlists" delay={0.16} />
        )}
        {ins.explicitShare > 0 && (
          <BigNumber value={ins.explicitShare} label="explicit" suffix="%" delay={0.2} />
        )}
      </div>

      <PersonalityBadge p={ins.personality} />

      {/* Real logged listening, grows over time */}
      {data.history && data.history.totalPlays > 0 && (
        <Rise className="rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-transparent p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionLabel>
                Real listening · since {fmtDate(data.history.since)}
              </SectionLabel>
              <p className="font-display text-3xl font-extrabold">
                {commas(data.history.totalPlays)} plays ·{" "}
                {minutesLabel(data.history.totalMinutes)}
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Logged from your actual play history — 100% real, and it keeps
                growing every time you visit.
              </p>
            </div>
            {data.history.topArtists[0] && (
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-neutral-500">
                  Most played
                </p>
                <p className="font-display text-xl font-bold text-emerald-600 dark:text-emerald-300">
                  {data.history.topArtists[0].artist}
                </p>
                <p className="text-xs text-neutral-500">
                  {data.history.topArtists[0].plays} plays
                </p>
              </div>
            )}
          </div>
        </Rise>
      )}

      {/* #1 spotlights */}
      {(topArtist || topTrack) && (
        <Rise>
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
        <Rise>
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
        <Rise>
          <SectionLabel>Top artists · {label}</SectionLabel>
          <ol className="space-y-1">
            {data.topArtists.slice(0, 10).map((a, i) => (
              <RankRow
                key={`${a.id}-${i}`}
                rank={i + 1}
                image={a.image}
                rounded="rounded-full"
                primary={a.name}
                secondary={a.genres[0]}
                pop={a.popularity}
                maxPop={maxPop}
              />
            ))}
          </ol>
        </Rise>

        <Rise>
          <SectionLabel>Top tracks · {label}</SectionLabel>
          <ol className="space-y-1">
            {data.topTracks.slice(0, 10).map((t, i) => (
              <RankRow
                key={`${t.id}-${i}`}
                rank={i + 1}
                image={t.image}
                rounded="rounded-md"
                primary={t.name}
                secondary={t.artist}
                meta={mmss(t.durationMs)}
                pop={t.popularity}
                maxPop={100}
              />
            ))}
          </ol>
        </Rise>
      </div>

      {/* Minutes by artist + decade spread */}
      <div className="grid gap-12 lg:grid-cols-2">
        {ins.perArtistMinutes.length > 0 && (
          <Rise>
            <SectionLabel>Minutes by artist · across your top tracks</SectionLabel>
            <Bars
              items={ins.perArtistMinutes.map((a) => ({
                label: a.artist,
                value: a.minutes,
              }))}
              unit="m"
            />
          </Rise>
        )}
        {ins.decades.length > 0 && (
          <Rise>
            <SectionLabel>Which eras you live in</SectionLabel>
            <Bars
              items={ins.decades.map((d) => ({ label: d.decade, value: d.count }))}
            />
          </Rise>
        )}
      </div>

      {/* Your whole library */}
      <Rise className="rounded-3xl border border-black/10 p-7 dark:border-white/10">
        <SectionLabel>Your saved library</SectionLabel>
        {library ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {library.savedTotal > 0 && (
                <BigNumber value={library.savedTotal} label="songs saved" accent />
              )}
              {library.libraryMinutes > 0 && (
                <BigNumber
                  value={library.libraryMinutes}
                  label={library.isEstimate ? "≈ library minutes" : "library minutes"}
                  delay={0.04}
                />
              )}
              {library.libraryMinutes >= 60 && (
                <BigNumber
                  value={Math.round(library.libraryMinutes / 60)}
                  label="hours of music"
                  delay={0.08}
                />
              )}
              {library.explicitShare > 0 && (
                <BigNumber value={library.explicitShare} label="explicit" suffix="%" delay={0.12} />
              )}
            </div>
            {library.perArtistMinutes.length > 0 && (
              <div>
                <SectionLabel>Most-saved artists by minutes</SectionLabel>
                <Bars
                  items={library.perArtistMinutes.map((a) => ({
                    label: a.artist,
                    value: a.minutes,
                  }))}
                  unit="m"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="h-24 animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />
        )}
      </Rise>

      {/* Lifetime import */}
      <Rise className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.04] p-7">
        <SectionLabel>Unlock your lifetime numbers</SectionLabel>
        <p className="mb-5 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          The Spotify API can&apos;t reveal lifetime play counts. Upload your
          official data export and we&apos;ll compute your true all-time minutes,
          play counts, top artists, and listening clock — then it powers your
          Soundprint card.
        </p>
        <ImportDropzone />
      </Rise>

      {data.recent.length > 0 && (
        <Rise>
          <SectionLabel>Recently played</SectionLabel>
          <ul className="grid gap-1 sm:grid-cols-2">
            {data.recent.slice(0, 12).map((t, i) => (
              <li
                key={`${t.id}-${i}`}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.03]"
              >
                <Art src={t.image} alt={t.name} rounded="rounded" size="h-9 w-9" />
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

function RankRow({
  rank,
  image,
  rounded,
  primary,
  secondary,
  meta,
  pop,
  maxPop,
}: {
  rank: number;
  image: string | null;
  rounded: string;
  primary: string;
  secondary?: string;
  meta?: string;
  pop?: number;
  maxPop: number;
}) {
  return (
    <li className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.03]">
      <span className="w-6 text-right font-display text-lg font-extrabold tabular-nums text-neutral-300 transition-colors group-hover:text-emerald-600 dark:text-neutral-700 dark:group-hover:text-emerald-400">
        {rank}
      </span>
      <Art src={image} alt={primary} rounded={rounded} size="h-11 w-11" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-neutral-900 dark:text-neutral-100">
          {primary}
        </span>
        {secondary && (
          <span className="block truncate text-xs text-neutral-500">
            {secondary}
          </span>
        )}
        {typeof pop === "number" && (
          <span className="mt-1 block h-1 w-full max-w-[120px] overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <span
              className="block h-full rounded-full bg-emerald-500/70"
              style={{ width: `${Math.min(100, (pop / maxPop) * 100)}%` }}
            />
          </span>
        )}
      </span>
      {meta && (
        <span className="shrink-0 font-mono text-xs tabular-nums text-neutral-400">
          {meta}
        </span>
      )}
    </li>
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-3xl bg-black/5 dark:bg-white/5" />
      <div className="grid gap-12 sm:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col} className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
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
        Soundprint
      </p>
      <h1 className="font-display text-4xl font-extrabold leading-tight sm:text-5xl">
        See what you actually
        <br />
        <span className="text-emerald-600 dark:text-emerald-400">listen to.</span>
      </h1>
      <p className="mx-auto max-w-md text-neutral-600 dark:text-neutral-400">
        Connect Spotify for a year-in-review of your top artists, genres, minutes,
        and a downloadable poster of your taste — plus a weekly AI discovery
        playlist on the side.
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

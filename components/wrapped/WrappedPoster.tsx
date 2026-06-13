"use client";

import { motion } from "motion/react";
import type { WrappedCard } from "@/lib/wrapped";
import { useCountUp } from "@/components/viz/useCountUp";
import { commas } from "@/lib/format";

function Tile({
  kicker,
  image,
  round,
  primary,
  secondary,
}: {
  kicker: string;
  image: string | null;
  round: string;
  primary: string;
  secondary: string;
}) {
  return (
    <div className="flex flex-1 flex-col rounded-2xl border border-emerald-400/25 bg-white/5 p-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-300">
        {kicker}
      </span>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className={`mt-3 h-16 w-16 object-cover ${round}`}
        />
      ) : (
        <div className={`mt-3 h-16 w-16 bg-white/10 ${round}`} />
      )}
      <span className="mt-3 truncate font-display text-lg font-extrabold leading-tight text-white">
        {primary}
      </span>
      {secondary && (
        <span className="truncate text-sm text-emerald-100/70">{secondary}</span>
      )}
    </div>
  );
}

export default function WrappedPoster({ card }: { card: WrappedCard }) {
  const n = useCountUp(card.minutes.value);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto flex aspect-[4/5] w-full max-w-md flex-col overflow-hidden rounded-3xl p-7 text-emerald-50 shadow-2xl"
      style={{
        backgroundColor: "#04140d",
        backgroundImage:
          "radial-gradient(60% 45% at 12% 0%, rgba(52,211,153,0.35), transparent 70%), radial-gradient(70% 55% at 100% 100%, rgba(16,185,129,0.28), transparent 70%), linear-gradient(160deg, #05231a, #04140d 70%)",
      }}
    >
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-300">
        <span>◗ Soundprint</span>
        <span className="text-emerald-100/60">Year in sound</span>
      </div>

      <div className="mt-6">
        <p className="text-sm text-emerald-100/80">{card.displayName}</p>
        <p className="font-display text-6xl font-extrabold leading-none tracking-tight tabular-nums text-emerald-300 sm:text-7xl">
          {commas(n)}
        </p>
        <p className="mt-1 text-emerald-50/90">
          {card.minutes.estimated ? "≈ " : ""}
          {card.minutes.label}
        </p>
      </div>

      <div className="mt-6 flex gap-3">
        <Tile
          kicker="Top artist"
          image={card.topArtist.image}
          round="rounded-full"
          primary={card.topArtist.name}
          secondary={card.topArtist.detail}
        />
        <Tile
          kicker="Top track"
          image={card.topTrack.image}
          round="rounded-lg"
          primary={card.topTrack.name}
          secondary={card.topTrack.artist}
        />
      </div>

      <div className="mt-auto pt-6">
        <p className="font-display text-lg font-extrabold tracking-wide text-emerald-300">
          {card.personality.title.toUpperCase()}
        </p>
        <p className="text-sm text-emerald-50/90">
          {card.topGenre ? `Mostly ${card.topGenre}. ` : "Genre nomad. "}
          {card.personality.tagline}
        </p>
        <p className="mt-4 text-[10px] text-emerald-100/40">
          Not affiliated with Spotify · Data via the Spotify API
        </p>
      </div>
    </motion.div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import WrappedPoster from "@/components/wrapped/WrappedPoster";
import ImportDropzone from "@/components/wrapped/ImportDropzone";
import type { WrappedCard } from "@/lib/wrapped";

type Status = "loading" | "ready" | "error" | "disconnected";

const SOURCE_NOTE: Record<WrappedCard["source"], string> = {
  import: "Lifetime totals from your imported Spotify history.",
  history: "Real plays logged since you connected.",
  live: "Estimated from your top 50 — import your history for true lifetime numbers.",
};

export default function WrappedPage() {
  const [card, setCard] = useState<WrappedCard | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/wrapped");
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setStatus("disconnected");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setCard(body as WrappedCard);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (status === "disconnected") {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="font-display text-3xl font-extrabold">
          Connect Spotify first
        </h1>
        <p className="mt-2 text-neutral-500">
          Your Soundprint is built from your listening.
        </p>
        <a
          href="/api/auth/login"
          className="mt-6 inline-block rounded-full bg-emerald-500 px-6 py-3 font-semibold text-neutral-950 hover:bg-emerald-400"
        >
          Connect Spotify
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-3"
      >
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400/80">
          Your Soundprint
        </p>
        <h1 className="font-display text-4xl font-extrabold leading-[0.95] tracking-tight sm:text-5xl">
          A poster of your
          <br />
          <span className="text-emerald-600 dark:text-emerald-400">
            year in sound.
          </span>
        </h1>
        <Link
          href="/"
          className="inline-block text-sm text-neutral-500 hover:text-emerald-600 dark:hover:text-emerald-400"
        >
          ← Back to the dashboard
        </Link>
      </motion.div>

      {status === "loading" && (
        <div className="mx-auto aspect-[4/5] w-full max-w-md animate-pulse rounded-3xl bg-black/5 dark:bg-white/5" />
      )}

      {status === "error" && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
          <p className="font-semibold text-red-600 dark:text-red-300">
            Couldn&apos;t build your Soundprint.
          </p>
          <button
            onClick={load}
            className="mt-3 rounded-full bg-neutral-900 px-4 py-1.5 text-sm text-white dark:bg-white dark:text-neutral-900"
          >
            Try again
          </button>
        </div>
      )}

      {status === "ready" && card && (
        <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-start">
          <WrappedPoster card={card} />

          <div className="space-y-5">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {SOURCE_NOTE[card.source]}
            </p>

            <div className="flex flex-wrap gap-3">
              <a
                href="/api/card"
                download="soundprint.png"
                className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400"
              >
                ↓ Download PNG
              </a>
              <button
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(`${window.location.origin}/api/card`)
                    .then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    });
                }}
                className="rounded-full border border-black/15 px-5 py-2.5 text-sm font-medium hover:border-emerald-500/50 dark:border-white/15"
              >
                {copied ? "Copied!" : "Copy image link"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              {card.stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <div className="font-display text-xl font-extrabold tabular-nums">
                    {s.value}
                  </div>
                  <div className="text-xs text-neutral-500">{s.label}</div>
                </div>
              ))}
            </div>

            {card.source === "live" && (
              <div className="pt-2">
                <ImportDropzone onDone={load} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

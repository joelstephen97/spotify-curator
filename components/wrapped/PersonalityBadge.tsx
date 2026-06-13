"use client";

import { motion } from "motion/react";

export interface Personality {
  title: string;
  tagline: string;
  traits: string[];
}

export default function PersonalityBadge({ p }: { p: Personality }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-transparent to-emerald-400/5 p-7"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400/80">
        Your listening type
      </p>
      <h3 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
        {p.title}
      </h3>
      <p className="mt-2 max-w-lg text-neutral-700 dark:text-neutral-300">
        {p.tagline}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {p.traits.map((t) => (
          <span
            key={t}
            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
          >
            {t}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

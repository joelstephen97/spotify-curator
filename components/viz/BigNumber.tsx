"use client";

import { motion } from "motion/react";
import { useCountUp } from "./useCountUp";
import { commas } from "@/lib/format";

export default function BigNumber({
  value,
  label,
  sub,
  prefix,
  suffix,
  delay = 0,
  accent = false,
}: {
  value: number;
  label: string;
  sub?: string;
  prefix?: string;
  suffix?: string;
  delay?: number;
  accent?: boolean;
}) {
  const n = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-2xl border p-5 ${
        accent
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.04]"
      }`}
    >
      <div
        className={`font-display text-4xl font-extrabold leading-none tracking-tight tabular-nums sm:text-5xl ${
          accent ? "text-emerald-600 dark:text-emerald-300" : ""
        }`}
      >
        {prefix}
        {commas(n)}
        {suffix}
      </div>
      <div className="mt-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </div>
      {sub && <div className="mt-0.5 text-xs text-neutral-500">{sub}</div>}
    </motion.div>
  );
}

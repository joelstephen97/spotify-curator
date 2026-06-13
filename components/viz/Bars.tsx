"use client";

import { motion } from "motion/react";

export interface BarItem {
  label: string;
  value: number;
  sub?: string;
}

/** Horizontal bar chart that grows its bars in on scroll. */
export default function Bars({
  items,
  unit = "",
  max,
}: {
  items: BarItem[];
  unit?: string;
  max?: number;
}) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => (
        <div key={`${it.label}-${i}`} className="flex items-center gap-3">
          <div className="w-28 shrink-0 truncate text-sm text-neutral-700 dark:text-neutral-300">
            {it.label}
          </div>
          <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-black/[0.04] dark:bg-white/[0.05]">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${Math.max(3, (it.value / top) * 100)}%` }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.8, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-md bg-gradient-to-r from-emerald-500/80 to-emerald-400"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold tabular-nums text-neutral-700 dark:text-neutral-100">
              {it.value.toLocaleString()}
              {unit}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

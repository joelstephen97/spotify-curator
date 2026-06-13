"use client";

import { useEffect, useRef, useState } from "react";

/** Eased count-up from 0 to `value`. requestAnimationFrame, no deps. */
export function useCountUp(value: number, duration = 1100): number {
  const [n, setN] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(value) || value <= 0) {
      setN(value || 0);
      return;
    }
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  return n;
}

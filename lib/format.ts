/** Thousands separators without locale surprises (stable for shareable cards). */
export function commas(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Compact a minute count into a human "Xh Ym" / "X,XXX min" style. */
export function minutesLabel(min: number): string {
  if (min >= 600) {
    const h = Math.round(min / 60);
    return `${commas(h)} hrs`;
  }
  return `${commas(min)} min`;
}

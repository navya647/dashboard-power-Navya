export function fmt(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function mode(arr: number[]): number | null {
  if (!arr.length) return null;
  const counts = new Map<number, number>();
  for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1);
  let best: number | null = null;
  let bestN = -1;
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

/** "2023-24" -> "FY24" — the standard Indian financial-year shorthand (named for the ending
 * year), used everywhere a year string from the extracted data is shown to the user instead of
 * spelling out the full "FY 2023-24" range. */
export function fyLabel(year: string): string {
  const end = year.split('-')[1] ?? year;
  return 'FY' + end.slice(-2);
}

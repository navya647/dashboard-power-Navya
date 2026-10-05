'use client';

import { useEffect, useState } from 'react';

/** Chart.js options are a plain JS object baked in at render time — unlike CSS, they can't pick up
 * a `var(--chart-grid)` change live, so a hardcoded hex would go stale the moment the theme toggles
 * (ThemeToggle.tsx flips `data-theme` without a page reload). Reading the token via
 * `getComputedStyle` at render time, combined with `useThemeTick` forcing a re-render whenever
 * `data-theme` changes, keeps a chart's grid/axis-title/tooltip colors in sync with the shared
 * dark-theme tokens in tokens.css instead of duplicating light/dark literals in TSX. */
export function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function useThemeTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setTick((t) => t + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return tick;
}

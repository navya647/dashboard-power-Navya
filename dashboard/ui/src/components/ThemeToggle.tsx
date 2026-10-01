'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'acpet-theme-v2'; // keep in sync with THEME_INIT_SCRIPT in app/layout.tsx
type Theme = 'light' | 'dark';

/** The blocking init script (layout.tsx) already sets data-theme on <html> before first paint, so
 * the page itself never flashes the wrong theme — but this button's own label/icon still has to
 * start from a fixed value on the server-rendered markup (statically exported, no per-request
 * theme available at build time) and sync to the real value after mount, same as any SSR dark-mode
 * toggle. A lazy initializer here would read the DOM during hydration and risk a text mismatch
 * against the statically-built markup, so this stays an effect deliberately. */
function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  // Bumped only on the no-View-Transitions fallback path, to key-remount the icon so its
  // mount animation (theme-icon-in, shared with the view-transition version below) replays.
  const [iconTick, setIconTick] = useState(0);

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  function applyTheme(next: Theme) {
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore — worst case the preference doesn't persist across visits
    }
  }

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      applyTheme(next);
      return;
    }
    if (!document.startViewTransition) {
      // No View Transitions support: the live DOM never leaves the screen (unlike the VT
      // path), so a plain remount + CSS keyframe animates in full view — no pseudo-element
      // plumbing needed.
      setIconTick((t) => t + 1);
      applyTheme(next);
      return;
    }
    document.startViewTransition(() => applyTheme(next));
  }

  const isDark = theme === 'dark';

  return (
    <button type="button" className="theme-toggle" role="switch" aria-checked={isDark} onClick={toggle}>
      <span className="theme-toggle-icon" key={iconTick}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {isDark ? <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /> : <><circle cx="12" cy="12" r="4.5" /><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></>}
        </svg>
      </span>
      <span>{isDark ? 'Dark' : 'Light'}</span>
    </button>
  );
}

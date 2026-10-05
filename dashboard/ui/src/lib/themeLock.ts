/**
 * Dark-only lock for the home page's animated street hero, which is designed for dark only.
 * While locked, <html> carries `data-theme-lock` and is forced to dark without touching the
 * visitor's saved choice; unlocking restores that saved choice. HeroSection locks while the street
 * is the dominant backdrop and unlocks once the map takes over (and on unmount); THEME_INIT_SCRIPT
 * in app/layout.tsx sets the lock before first paint on a direct load of the home page.
 * ThemeToggle listens for THEME_LOCK_EVENT to disable itself and refresh its label.
 */

export const THEME_STORAGE_KEY = 'acpet-theme-v2'; // keep in sync with THEME_INIT_SCRIPT in app/layout.tsx
export const THEME_LOCK_EVENT = 'acpet-theme-lock';
const LOCK_ATTR = 'data-theme-lock';

export type Theme = 'light' | 'dark';

export function storedTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function isThemeLocked(): boolean {
  return document.documentElement.hasAttribute(LOCK_ATTR);
}

/** Called every frame of HeroSection's scroll timeline, so it's cheap when nothing changes. While
 * locked it re-asserts dark on every call (not only on the transition into the lock), so the
 * street can never be left showing in light, whatever else touched data-theme in between. */
export function setThemeLocked(locked: boolean) {
  const root = document.documentElement;
  const changed = root.hasAttribute(LOCK_ATTR) !== locked;
  if (!changed && !locked) return;
  if (changed) root.toggleAttribute(LOCK_ATTR, locked);
  const next: Theme = locked ? 'dark' : storedTheme();
  const themeChanged = root.getAttribute('data-theme') !== next;
  if (themeChanged) root.setAttribute('data-theme', next);
  if (changed || themeChanged) window.dispatchEvent(new Event(THEME_LOCK_EVENT));
}

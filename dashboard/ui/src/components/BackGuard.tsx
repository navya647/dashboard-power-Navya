'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MAP_VIEW_PARAM, MAP_VIEW_VALUE, LANDING_HREF, MAP_HREF } from '@/lib/routes';

const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p) || '/';

// Strict Back rules, keyed on the page being left:
//   /about                           → the landing page
//   map view (/?view=map)            → /about
//   /methodology, /accessibility     → /about
//   /state/<slug>, /compare          → the map view (home page)
//   landing page (/)                 → leaves the site (the page the visitor came from)
//   Forward (any page)               → never available
//
// How it holds:
//  1. The popstate listener runs ahead of Next's own (see layout.tsx's trampoline) and, for the
//     pages above, stops Next handling the pop, so the page being left is never swapped for
//     another one. Landing → About is a push, so Back normally has a real entry to pop to.
//  2. The Forward button is enabled only while entries exist after the current one, and a Back
//     press always leaves the entry it came from there. So after the pop lands, the guard steps one
//     more entry back and pushes the target page as a fresh entry: that push discards everything
//     after it, the left page included. Net history size is unchanged on every round trip (no
//     growth, so the browser's ~50-entry cap never evicts the visitor's own previous page).
//  3. That needs at least two entries of ours under the page being left, so a page opened as the
//     very first entry of the tab (a pasted link, a refresh in a fresh tab) gets them inserted once.
//  4. Back on the landing page jumps past every entry this tab has on the site in one go.
//  5. Anything that still moves forward (browsers without the Navigation API can't tell the
//     direction, so they keep a working Forward button) is undone where the direction is known.
const TARGET: Record<string, string> = {
  '/about': LANDING_HREF,
  '/map': '/about',
  '/methodology': '/about',
  '/accessibility': '/about',
  '/detail': MAP_HREF, // a state / UT page or the compare page → the home (map) page
};
// what to put beneath a page that opens as the first entry of the tab, bottom first
const BENEATH: Record<string, string[]> = {
  '/': [LANDING_HREF],
  '/about': [LANDING_HREF, LANDING_HREF],
  '/map': [LANDING_HREF, LANDING_HREF, '/about'],
  '/methodology': [LANDING_HREF, LANDING_HREF, '/about'],
  '/accessibility': [LANDING_HREF, LANDING_HREF, '/about'],
  '/detail': [LANDING_HREF, LANDING_HREF, '/about', MAP_HREF],
};
const isDetail = (p: string) => p === '/compare' || p.startsWith('/state/');

type Nav = EventTarget & { currentEntry?: { index: number } };
const navApi = () => (typeof window === 'undefined' ? undefined : (window as unknown as { navigation?: Nav }).navigation);
const entryIndex = () => navApi()?.currentEntry?.index;

function isFirstEntry() {
  const index = entryIndex();
  return typeof index === 'number' ? index === 0 : window.history.length <= 1;
}

function leaveSite() {
  const index = entryIndex();
  window.history.go(-((typeof index === 'number' && index >= 0 ? index : window.history.length - 1) + 1));
}

// Called by the inline trampoline in app/layout.tsx, which registers the capture-phase popstate
// listener before anything else on the page. It has to run ahead of Next's own listener: the page
// being left must be read before Next restores the entry we popped to and re-renders.
let shown = '/'; // key of the page currently on screen
let router_: { push: (href: string) => void; replace: (href: string) => void } | null = null;
let delta = 0; // how far the latest traversal moved: negative = Back, positive = Forward
let swallow = false; // the next popstate is one we caused ourselves (a Forward undone)
let pending: string | null = null; // Back is mid-way: step-back popstate due, then push this
let leaving = false;
// the page the latest traversal left, read from the history entry itself: `shown` only updates once
// React has rendered the new page, and a Back pressed in that gap would otherwise be judged as
// coming from the page before it (About → "landing" → leaves the site)
let leftKey: string | null = null;
function keyOfUrl(href: string) {
  const u = new URL(href, window.location.href);
  const p = norm(u.pathname);
  return p === '/' && u.searchParams.get(MAP_VIEW_PARAM) === MAP_VIEW_VALUE ? '/map' : isDetail(p) ? '/detail' : p;
}

if (typeof window !== 'undefined') {
  navApi()?.addEventListener('currententrychange', ((e: Event & { navigationType?: string | null; from?: { index: number; url?: string | null } }) => {
    const now = entryIndex();
    leftKey = e.navigationType === 'traverse' && e.from?.url ? keyOfUrl(e.from.url) : null;
    delta = e.navigationType === 'traverse' && typeof now === 'number' && e.from ? now - e.from.index : 0;
  }) as EventListener);
  window.addEventListener('pageshow', () => (leaving = false));
}

// ?bgdebug in the URL switches on a small on-screen panel (history list + what the guard did), for
// diagnosing Back problems on a machine we can't see; it does nothing otherwise
const dbg: string[] = [];
function log(msg: string) {
  dbg.push(msg);
  if (dbg.length > 14) dbg.shift();
  window.dispatchEvent(new Event('bgdebug'));
}
function onPop(e: PopStateEvent) {
  log(`pop left=${leftKey ?? '?'} shown=${shown} delta=${delta} idx=${entryIndex() ?? '?'} pending=${pending ?? '-'}`);
  if (swallow) {
    swallow = false;
    e.stopImmediatePropagation(); // the page never changed; nothing to restore
    return;
  }
  if (pending !== null) {
    // the step back below the entry Back landed on: now push the target over what's left
    const href = pending;
    pending = null;
    e.stopImmediatePropagation();
    // a plain router.push() would only replace here: Next sees the location already at href.
    // The native push discards the entries after this one; the replace then renders the page.
    window.history.pushState(null, '', href);
    router_?.replace(href);
    return;
  }
  if (delta > 0) {
    e.stopImmediatePropagation();
    swallow = true;
    window.history.go(-delta);
    return;
  }
  const page = leftKey ?? shown;
  if (page === '/') {
    log('→ leave site');
    e.stopImmediatePropagation();
    if (leaving) return;
    leaving = true;
    // never stay latched: the jump may be a no-op (nothing before the site)
    window.setTimeout(() => (leaving = false), 800);
    leaveSite();
    return;
  }
  const target = TARGET[page];
  if (!target || !router_) return;
  e.stopImmediatePropagation();
  const index = entryIndex();
  if (typeof index === 'number' && index >= 1) {
    pending = target;
    log('→ step back, then push ' + target);
    window.history.go(-1);
    // if the step back never reports, fall back to a plain replace
    window.setTimeout(() => {
      if (pending === null) return;
      const href = pending;
      pending = null;
      router_?.replace(href);
    }, 600);
  } else {
    log('→ replace ' + target + ' (nothing below)');
    router_.replace(target);
  }
}
if (typeof window !== 'undefined') (window as unknown as { __bgPop?: typeof onPop }).__bgPop = onPop;

function DebugPanel() {
  const [, tick] = useState(0);
  useEffect(() => {
    const h = () => tick((n) => n + 1);
    window.addEventListener('bgdebug', h);
    window.addEventListener('popstate', h);
    return () => {
      window.removeEventListener('bgdebug', h);
      window.removeEventListener('popstate', h);
    };
  }, []);
  const n = navApi() as unknown as { entries?: () => { url: string }[]; currentEntry?: { index: number } } | undefined;
  const entries = n?.entries?.() ?? [];
  const cur = n?.currentEntry?.index ?? -1;
  return (
    <pre style={{ position: 'fixed', right: 8, bottom: 8, zIndex: 99999, maxWidth: 460, maxHeight: '55vh', overflow: 'auto', margin: 0, padding: 8, font: '11px/1.35 monospace', background: 'rgba(0,0,0,.85)', color: '#9f9', border: '1px solid #9f9', whiteSpace: 'pre-wrap' }}>
      {['HISTORY (* = here)', ...entries.map((e, i) => (i === cur ? '* ' : '  ') + i + ' ' + new URL(e.url).pathname + new URL(e.url).search), '', 'GUARD', ...dbg].join('\n')}
    </pre>
  );
}

export default function BackGuard() {
  const [debug, setDebug] = useState(false);
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).has('bgdebug')) sessionStorage.setItem('bgdebug', '1');
      setDebug(sessionStorage.getItem('bgdebug') === '1');
    } catch {}
  }, []);
  const pathname = norm(usePathname() ?? '/');
  const onMap = useSearchParams().get(MAP_VIEW_PARAM) === MAP_VIEW_VALUE;
  const key = pathname === '/' && onMap ? '/map' : isDetail(pathname) ? '/detail' : pathname;
  const router = useRouter();
  const seeded = useRef(false);

  useEffect(() => {
    shown = key;
  }, [key]);

  useEffect(() => {
    router_ = { push: (href) => router.push(href), replace: (href) => router.replace(href) };
  }, [router]);

  // Coming back into the site from outside by Back/Forward (the document is loaded afresh from the
  // history entry, or restored from the back-forward cache) always starts at the landing page,
  // whatever page that entry was.
  const reentry = useRef<boolean | null>(null);
  const redirected = useRef(false);
  if (reentry.current === null && typeof window !== 'undefined') {
    const nav0 = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    reentry.current = nav0?.type === 'back_forward' && key !== '/';
  }
  useEffect(() => {
    if (reentry.current) {
      reentry.current = false;
      redirected.current = true; // the seeding below waits for the landing page itself
      router.replace(LANDING_HREF);
    }
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted && shown !== '/') router.replace(LANDING_HREF);
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [router]);

  useEffect(() => {
    const beneath = BENEATH[key];
    if (redirected.current) {
      redirected.current = false;
      return;
    }
    if (seeded.current || !beneath || !isFirstEntry()) return;
    seeded.current = true;
    // `__NA` makes Next's patched history methods pass these straight through, so its router
    // state is untouched and the page on screen doesn't change
    const here = window.location.href;
    const state = { ...(window.history.state ?? {}), __NA: true };
    window.history.replaceState(state, '', beneath[0]);
    for (const href of beneath.slice(1)) window.history.pushState(state, '', href);
    window.history.pushState(state, '', here);
  }, [key]);

  return debug ? <DebugPanel /> : null;
}

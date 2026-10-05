'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import HeroMap from './HeroMap';
import StateSearch from './StateSearch';
import ComparePanel from './ComparePanel';
import { compareColor, MAP_STATUS_LABEL } from '@/lib/computations';
import { LANDING_HREF, MAP_HREF, MAP_VIEW_PARAM, MAP_VIEW_VALUE } from '@/lib/routes';
import type { Discom, IndiaGeoJSON, StateSpecificData } from '@/lib/types';

interface Props {
  discoms: Discom[];
  stateSpecific?: StateSpecificData | null;
  geojson: IndiaGeoJSON;
  compareSet: string[];
  onToggleState: (name: string) => void;
  onRemove: (name: string) => void;
  onViewFullReport: (name: string) => void;
  onCompare: () => void;
  onClearAll: () => void;
  compareMode: boolean;
  onCompareModeChange: (on: boolean) => void;
}

/** Below this width the home page is a plain stacked column (headline, then the compare panel
 * and map); the desktop layout's full-height screens and map centring are skipped. */
const MOBILE_QUERY = '(max-width: 980px)';
function isMobile() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;
}

type HeroView = 'landing' | 'map';
/** The animated hand-off in flight: landing → map, or map → landing (the mirror image) */
type HeroAnim = 'to-map' | 'to-hero';

/** Total length of either crossfade; matches the keyframe timings in hero.css (the last phase of
 * each ends at 650ms). */
const EXPLORE_ANIM_MS = 680;
/** Accumulated wheel/trackpad delta (px) in one direction needed to navigate, and the pause after
 * which a partial accumulation is forgotten. */
const WHEEL_TRIGGER_PX = 40;
const WHEEL_IDLE_RESET_MS = 300;
/** After a navigation (and after a scrollable list inside the map view has used up a gesture), the
 * wheel stays locked until the input goes quiet for this long, so a trackpad's momentum tail — or
 * the rest of a gesture that just scrolled a list to its top — can never start another navigation:
 * one gesture, at most one transition. */
const GESTURE_GAP_MS = 250;

/** Whether the wheel at `target` belongs to a scrollable element inside the stage (the state
 * search list, the compare chip list, any overflow panel) because that element can still scroll in
 * the wheel's direction. At its boundary in that direction it returns false, so the gesture is
 * free to navigate. */
function scrollableCanScroll(target: EventTarget | null, stop: Element, up: boolean) {
  for (let n = target instanceof Element ? target : null; n && n !== stop; n = n.parentElement) {
    if (n.scrollHeight <= n.clientHeight + 1) continue;
    const { overflowY } = getComputedStyle(n);
    if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') continue;
    if (up ? n.scrollTop > 0 : n.scrollTop + n.clientHeight < n.scrollHeight - 1) return true;
  }
  return false;
}

/** The home page: exactly two full-screen frames — the sunset landing view (headline + "Explore
 * dashboard") and the interactive map view. On desktop the page itself never scrolls (scrollY stays
 * 0): the Explore button or a scroll down on the landing view plays the landing → map transition
 * (triggerDashboardTransition), and a scroll up on the map view plays its mirror image back
 * (triggerLandingTransition). Below the mobile breakpoint the two stack in a normal scrolling column
 * instead (the map view is taller than a phone screen). */
export default function HeroSection({
  discoms,
  stateSpecific,
  geojson,
  compareSet,
  onToggleState,
  onRemove,
  onViewFullReport,
  onCompare,
  onClearAll,
  compareMode,
  onCompareModeChange,
}: Props) {
  const stageRef = useRef<HTMLElement>(null);
  const mapViewRef = useRef<HTMLDivElement>(null);
  // The URL says which frame is showing (/?view=map — see lib/routes.ts), so a refresh or a
  // direct link opens on the map with no landing-view flash. This component only ever renders on
  // the client (page.tsx shows a loading state until the data is in), so reading the URL in the
  // initial state can't mismatch a server render.
  const wantMap = useSearchParams().get(MAP_VIEW_PARAM) === MAP_VIEW_VALUE;
  const initialView: HeroView = wantMap && !isMobile() ? 'map' : 'landing';
  const [view, setView] = useState<HeroView>(initialView);
  const viewRef = useRef<HeroView>(initialView);
  // the animated hand-off in flight, if any (see the data-anim rules in hero.css): both frames stay
  // on screen and overlap for EXPLORE_ANIM_MS while the landing frame fades out over the map frame
  // (to-map) or back in over it (to-hero)
  const [anim, setAnim] = useState<HeroAnim | null>(null);
  const animRef = useRef<HeroAnim | null>(null);
  // called when a transition finishes, so the input handlers can reset their gesture state
  const onTransitionEndRef = useRef<(() => void) | null>(null);
  function showView(next: HeroView) {
    if (viewRef.current === next) return;
    viewRef.current = next;
    setView(next);
  }
  // keeps the URL on the frame the visitor has moved to (replace, not push: the two frames are one
  // page, not separate history entries)
  function syncUrl(next: HeroView) {
    const href = next === 'map' ? MAP_HREF : LANDING_HREF;
    if (window.location.pathname + window.location.search !== href) window.history.replaceState(null, '', href);
  }
  // the state search list's hovered / keyboard-active option, highlighted on the map
  const [searchHighlight, setSearchHighlight] = useState<string | null>(null);
  const regionNames = useMemo(() => geojson.features.map((f) => f.properties.st_nm), [geojson]);

  // The one transition runner both directions share: keeps both frames mounted and overlapping for
  // EXPLORE_ANIM_MS under data-anim, then settles on `next`. With reduced motion it switches
  // immediately. It only uses refs and state setters, so the input effect below can safely call the
  // first render's copy.
  function runTransition(next: HeroView, dir: HeroAnim) {
    if (viewRef.current === next || animRef.current) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) {
      animRef.current = dir;
      setAnim(dir);
      window.setTimeout(() => {
        animRef.current = null;
        setAnim(null);
        onTransitionEndRef.current?.();
      }, EXPLORE_ANIM_MS);
    }
    showView(next);
    syncUrl(next);
  }
  // Landing → map: the Explore button and every downward gesture on the landing view (on mobile,
  // the button scrolls down to the map instead).
  function triggerDashboardTransition() {
    if (isMobile()) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      mapViewRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      syncUrl('map');
      return;
    }
    runTransition('map', 'to-map');
  }
  // Map → landing: an upward gesture on the map view (desktop only)
  function triggerLandingTransition() {
    if (isMobile()) return;
    runTransition('landing', 'to-hero');
  }

  // outside compare mode, a click jumps straight to that state's full report — no intermediate
  // preview card. In compare mode it instead adds/removes the state from the comparison set.
  function handleStateClick(name: string) {
    if (!compareMode) {
      onViewFullReport(name);
      return;
    }
    onToggleState(name);
  }

  // a pick from the state search list does exactly what a map click does
  function handleSearchSelect(name: string) {
    if (!compareMode) onViewFullReport(name);
    else onToggleState(name);
  }

  // Arriving on /?view=map (a refresh, or any "back to the map" control — MAP_HREF) opens straight
  // on the map: on desktop through the initial state above; on mobile, where the frames stack, by
  // scrolling to it before the first paint. A later switch to /?view=map while this page is
  // already up (the sidebar's Home clicked on the landing view) plays the normal hand-off.
  const mountedRef = useRef(false);
  useLayoutEffect(() => {
    const first = !mountedRef.current;
    mountedRef.current = true;
    if (!wantMap) return;
    if (first) {
      if (isMobile()) mapViewRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
    } else {
      triggerDashboardTransition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- triggerDashboardTransition only uses refs and setters
  }, [wantMap]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // The input handlers only ever start a transition — never change the view themselves: a
    // deliberate downward gesture on the landing view calls triggerDashboardTransition(), and a
    // deliberate upward gesture on the map view calls triggerLandingTransition(). Upward on the
    // landing view and downward on the map view do nothing. They read the view and transition
    // state from refs, so they never act on a stale render.
    //
    // Wheel / trackpad: WHEEL_TRIGGER_PX of accumulated delta in the navigating direction (a pause
    // of WHEEL_IDLE_RESET_MS or a change of direction resets it). On the map view, a wheel over a
    // scrollable list that can still scroll up is left to the list. Every navigation, and every
    // gesture a list used up, locks the wheel until the input goes quiet for GESTURE_GAP_MS.
    let wheelAccum = 0;
    let lastWheel = 0;
    let gestureLocked = false;
    function lockGesture() {
      gestureLocked = true;
      wheelAccum = 0;
    }
    onTransitionEndRef.current = () => {
      wheelAccum = 0; // the lock itself stays until the wheel goes quiet
    };
    function onWheel(e: WheelEvent) {
      if (isMobile()) return;
      const now = performance.now();
      const sinceLast = now - lastWheel;
      lastWheel = now;
      if (animRef.current) return; // ignore everything while a transition plays
      if (gestureLocked) {
        if (sinceLast < GESTURE_GAP_MS) return; // still the same gesture (or its momentum)
        gestureLocked = false;
      }
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      if (dy === 0) return;
      const onLanding = viewRef.current === 'landing';
      const navigating = onLanding ? dy > 0 : dy < 0; // down on the landing view, up on the map
      if (!navigating) {
        wheelAccum = 0;
        return;
      }
      if (!onLanding && scrollableCanScroll(e.target, stage!, true)) {
        lockGesture(); // the list scrolls; the rest of this gesture can't navigate once it hits its top
        return;
      }
      if (sinceLast > WHEEL_IDLE_RESET_MS) wheelAccum = 0;
      wheelAccum += Math.abs(dy);
      if (wheelAccum < WHEEL_TRIGGER_PX) return;
      lockGesture();
      if (onLanding) triggerDashboardTransition();
      else triggerLandingTransition();
    }
    // Keyboard, outside text fields: the "scroll down" keys on the landing view, the "scroll up"
    // keys on the map view
    function onKey(e: KeyboardEvent) {
      if (isMobile() || animRef.current || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const onButton = t?.tagName === 'BUTTON';
      if (viewRef.current === 'landing') {
        if (['ArrowDown', 'PageDown', 'End'].includes(e.key) || (e.key === ' ' && !e.shiftKey && !onButton)) triggerDashboardTransition();
      } else if (['ArrowUp', 'PageUp', 'Home'].includes(e.key) || (e.key === ' ' && e.shiftKey && !onButton)) {
        triggerLandingTransition();
      }
    }
    // Touchscreen: a swipe of more than 40px — up on the landing view, down on the map view
    // (unless it was scrolling a list that can still scroll up)
    let touchY: number | null = null;
    function onTouchStart(e: TouchEvent) {
      touchY = e.touches[0]?.clientY ?? null;
    }
    function onTouchEnd(e: TouchEvent) {
      if (isMobile() || animRef.current || touchY == null) return;
      const dy = touchY - (e.changedTouches[0]?.clientY ?? touchY);
      touchY = null;
      if (viewRef.current === 'landing') {
        if (dy > 40) triggerDashboardTransition();
      } else if (dy < -40 && !scrollableCanScroll(e.target, stage!, true)) {
        triggerLandingTransition();
      }
    }

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKey);
    stage.addEventListener('touchstart', onTouchStart, { passive: true });
    stage.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      onTransitionEndRef.current = null;
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      stage.removeEventListener('touchstart', onTouchStart);
      stage.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // While the landing view is the frame on screen, the sidebar (outside this section) matches the
  // sunset and hides the theme toggle — see :root[data-hero-landing] in layout.css; while the map
  // view is, it takes that view's warm surface family instead (:root[data-hero-map]). Desktop only,
  // like the init script in app/layout.tsx that sets them before first paint.
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const on = view === 'landing' && !isMobile();
      const mapOn = view !== 'landing' && !isMobile();
      if (root.hasAttribute('data-hero-landing') === on && root.hasAttribute('data-hero-map') === mapOn) return;
      if (animRef.current) {
        // an animated hand-off: the sidebar crossfades in step with the frames (layout.css)
        root.setAttribute('data-hero-anim', animRef.current);
        root.toggleAttribute('data-hero-landing', on);
        root.toggleAttribute('data-hero-map', mapOn);
        window.setTimeout(() => root.removeAttribute('data-hero-anim'), EXPLORE_ANIM_MS);
        return;
      }
      root.setAttribute('data-hero-switching', '');
      root.toggleAttribute('data-hero-landing', on);
      root.toggleAttribute('data-hero-map', mapOn);
      requestAnimationFrame(() => requestAnimationFrame(() => root.removeAttribute('data-hero-switching')));
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [view]);
  useEffect(
    () => () => {
      // leaving the home page
      document.documentElement.removeAttribute('data-hero-landing');
      document.documentElement.removeAttribute('data-hero-map');
      document.documentElement.removeAttribute('data-hero-anim');
    },
    [],
  );

  return (
    <section className="hero-stage" ref={stageRef} data-view={view} data-anim={anim ?? undefined}>
      <div className="hero-landing hero-on-street">
        <div className="hero-bg-fabric">
          <div className="street-layer hero-photo-layer" aria-hidden="true" />
        </div>

        <div className="hero-coverage-badge">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export has no Image Optimization API */}
          <img src="/acpet-logo.png" alt="ACPET" width={208} height={69} className="hero-logo hero-logo-light" />
          {/* eslint-disable-next-line @next/next/no-img-element -- static export has no Image Optimization API */}
          <img src="/acpet-logo-white.png" alt="ACPET" width={208} height={69} className="hero-logo hero-logo-dark" />
        </div>

        <div className="hero-editorial">
          <h1>India Power Supply, Service Quality and Safety Dashboard</h1>
          <p className="lede">
            Bringing together Standards of Performance and reported data on electricity supply quality, reliability, service delivery and
            safety across India&rsquo;s states, union territories and DISCOMs.
            <br />
            A systematic, transparent resource to enable comparison, support improvements in
            electricity distribution services, and inform quality-linked tariff design.
          </p>
        </div>

        {/* the introduction's call to action, centred at the bottom of the landing view */}
        <button type="button" className="hero-explore" onClick={triggerDashboardTransition}>
          <span>Explore dashboard</span>
          <svg className="hero-explore-arrow" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 2.5v10M3.5 8.5 8 13l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="hero-sticky" ref={mapViewRef}>
        <div className="hero-logo-fade" aria-hidden="true" />
        <div className="hero-coverage-badge">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export has no Image Optimization API */}
          <img src="/acpet-logo.png" alt="ACPET" width={208} height={69} className="hero-logo hero-logo-light" />
          {/* eslint-disable-next-line @next/next/no-img-element -- static export has no Image Optimization API */}
          <img src="/acpet-logo-white.png" alt="ACPET" width={208} height={69} className="hero-logo hero-logo-dark" />
        </div>

        {/* before the map stage in the DOM so that on mobile (a static column) it sits above the map */}
        <div className="overlay-compare">
          <ComparePanel
            renderSearch={(hintId) => (
              <StateSearch
                names={regionNames}
                discoms={discoms}
                stateSpecific={stateSpecific}
                compareMode={compareMode}
                compareSet={compareSet}
                onSelect={handleSearchSelect}
                onHighlight={setSearchHighlight}
                describedBy={hintId}
              />
            )}
            colorOf={(name) => compareColor(compareSet, name)}
            compareSet={compareSet}
            onRemove={onRemove}
            onCompare={onCompare}
            onClearAll={onClearAll}
            compareMode={compareMode}
            onCompareModeChange={onCompareModeChange}
          />
        </div>

        <div className="hero-map-stage">
          <div className="hero-map-inner">
            <HeroMap
              discoms={discoms}
              stateSpecific={stateSpecific}
              geojson={geojson}
              compareColorOf={(name) => compareColor(compareSet, name)}
              onStateClick={handleStateClick}
              compareMode={compareMode}
              highlighted={searchHighlight}
            />
            <div className="hero-network-layer" />
          </div>
        </div>

        <div className="map-chrome">
          <div className="map-legend" aria-hidden="true">
            <div className="map-legend-row">
              <span className="map-legend-dot map-legend-dot--tracked" />
              {MAP_STATUS_LABEL.tracked}
            </div>
            <div className="map-legend-row">
              <span className="map-legend-dot map-legend-dot--no-data" />
              {MAP_STATUS_LABEL['no-data']}
            </div>
            <div className="map-legend-row">
              <span className="map-legend-dot map-legend-dot--none" />
              {MAP_STATUS_LABEL.idle}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

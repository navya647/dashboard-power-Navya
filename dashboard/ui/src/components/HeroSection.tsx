'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import HeroMap from './HeroMap';
import StateSearch from './StateSearch';
import ComparePanel from './ComparePanel';
import { compareColor, MAP_STATUS_LABEL } from '@/lib/computations';
import { LANDING_HREF, MAP_HREF, MAP_VIEW_PARAM, MAP_VIEW_VALUE } from '@/lib/routes';
import type { IndiaGeoJSON, MasterData } from '@/lib/types';

interface Props {
  master: MasterData | null;
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
/** The home page: exactly two full-screen frames, the sunset landing view (headline + "Explore
 * dashboard") and the interactive map view. On desktop the page itself never scrolls (scrollY stays
 * 0): only the Explore button leaves the landing view, for About (triggerAboutTransition; the map is
 * reached from there or from MAP_HREF, which plays the landing → map transition,
 * triggerDashboardTransition). No scroll, swipe or key moves between the two frames. Below the mobile
 * breakpoint the two stack in a normal scrolling column instead (the map view is taller than a phone
 * screen). */
export default function HeroSection({
  master,
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
  const router = useRouter();
  const stageRef = useRef<HTMLElement>(null);
  const mapViewRef = useRef<HTMLDivElement>(null);
  // The URL says which frame is showing (/?view=map, see lib/routes.ts), so a refresh or a
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
  // Landing → About: the Explore button and every downward gesture on the landing view (the map is
  // reached from the About page, the sidebar's Home, or any MAP_HREF control)
  function triggerAboutTransition() {
    if (animRef.current) return;
    router.push('/about'); // a push, so Back from About is the landing page's own history entry
  }
  // outside compare mode, a click jumps straight to that state's full report, no intermediate
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

  // Arriving on /?view=map (a refresh, or any "back to the map" control, MAP_HREF) opens straight
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

  // While the landing view is the frame on screen, the sidebar (outside this section) matches the
  // sunset and hides the theme toggle, see :root[data-hero-landing] in layout.css; while the map
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
  // The sunset photo is hidden behind the India Gate one until the visitor scrolls left on the
  // landing view (horizontal wheel / trackpad, ArrowLeft, or a swipe to the right); scrolling
  // right (or ArrowRight, a swipe left) hides it again.
  const [sunOn, setSunOn] = useState(false);
  useEffect(() => {
    if (view !== 'landing') return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 8) return;
      setSunOn(e.deltaX < 0);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setSunOn(true);
      else if (e.key === 'ArrowRight') setSunOn(false);
    };
    let startX = 0;
    let startY = 0;
    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) setSunOn(dx > 0);
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
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
          <div className={`street-layer hero-photo-layer hero-photo-sun${sunOn ? ' is-on' : ''}`} aria-hidden="true" />
        </div>

        <div className="hero-coverage-badge">
          <a href="https://acpet.ashoka.edu.in/" target="_blank" rel="noopener noreferrer" aria-label="ACPET website (opens in a new tab)" className="acpet-link">
            {/* eslint-disable-next-line @next/next/no-img-element -- static export has no Image Optimization API */}
            <img src="/acpet-logo.png" alt="ACPET" width={208} height={69} className="hero-logo hero-logo-light" />
            {/* eslint-disable-next-line @next/next/no-img-element -- static export has no Image Optimization API */}
            <img src="/acpet-logo-white.png" alt="ACPET" width={208} height={69} className="hero-logo hero-logo-dark" />
          </a>
        </div>

        <div className="hero-editorial">
          <h1>India Power Supply, Service Quality and Safety Dashboard</h1>
          <p className="lede">
            Bringing together Standards of Performance and reported data on electricity supply quality, reliability, service delivery and
            safety across India&rsquo;s states, union territories and DISCOMs.
          </p>
        </div>

        {/* the introduction's call to action, centred at the bottom of the landing view: opens the
            About page, with the same hand-off a scroll down plays */}
        <Link
          href="/about"
          className="hero-explore"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            triggerAboutTransition();
          }}
        >
          <span>Explore dashboard</span>
          <svg className="hero-explore-arrow" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 2.5v10M3.5 8.5 8 13l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      <div className="hero-sticky" ref={mapViewRef}>
        <div className="hero-logo-fade" aria-hidden="true" />
        <div className="hero-coverage-badge">
          <a href="https://acpet.ashoka.edu.in/" target="_blank" rel="noopener noreferrer" aria-label="ACPET website (opens in a new tab)" className="acpet-link">
            {/* eslint-disable-next-line @next/next/no-img-element -- static export has no Image Optimization API */}
            <img src="/acpet-logo.png" alt="ACPET" width={208} height={69} className="hero-logo hero-logo-light" />
            {/* eslint-disable-next-line @next/next/no-img-element -- static export has no Image Optimization API */}
            <img src="/acpet-logo-white.png" alt="ACPET" width={208} height={69} className="hero-logo hero-logo-dark" />
          </a>
        </div>

        {/* before the map stage in the DOM so that on mobile (a static column) it sits above the map */}
        <div className="overlay-compare">
          <ComparePanel
            renderSearch={(hintId) => (
              <StateSearch
                names={regionNames}
                master={master}
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
              master={master}
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

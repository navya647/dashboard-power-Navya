'use client';

import { useEffect, useRef } from 'react';
import HeroMap from './HeroMap';
import ComparePanel from './ComparePanel';
import { compareColor } from '@/lib/computations';
import type { Discom, IndiaGeoJSON, StateSpecificData } from '@/lib/types';

interface Props {
  discoms: Discom[];
  stateSpecific?: StateSpecificData | null;
  geojson: IndiaGeoJSON;
  stateHue: Record<string, string>;
  compareSet: string[];
  onToggleState: (name: string) => void;
  onRemove: (name: string) => void;
  onViewFullReport: (name: string) => void;
  onCompare: () => void;
  onClearAll: () => void;
  compareMode: boolean;
  onToggleCompareMode: () => void;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
/** Maps outer scroll progress `p` onto a phase's own local 0..1 range, e.g. remap(p, 0.2, 0.6)
 * is 0 before 20%, 1 after 60%, and ramps smoothly in between — how every phase in the brief's
 * 0-20/20-45/45-65/65-80/80-100 timeline is expressed here. */
function remap(p: number, a: number, b: number) {
  if (b <= a) return p >= b ? 1 : 0;
  return clamp01((p - a) / (b - a));
}
/** Slow-fast-slow — one consistent "camera move" character shared by every phase (editorial
 * recede, map centering, network reveal, chrome cascade), rather than a different curve per
 * element. Deliberately not a bounce/overshoot: the brief calls for calm and cinematic, not
 * playful. */
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
/** A restrained overshoot — used only for the map's own scale, so it settles into its final size
 * with a confident "snap" rather than a mechanical linear arrival, the way a premium product
 * page's hero visual tends to land. Position (translateX) stays on the plain in-out curve above
 * so the map never wobbles sideways — only its scale has this extra bit of life. */
function easeOutBack(t: number) {
  const c1 = 1.12;
  const c3 = c1 + 1;
  const p = t - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
}

/** Below this width the scroll-driven pin/transform is skipped entirely — a sticky, viewport-
 * height section is fragile on mobile (address-bar show/hide changes the actual viewport height
 * mid-scroll), so mobile just gets the fully-arrived static layout (map centered, chrome visible)
 * instead of trying to scrub the same cinematic transform through a much less predictable
 * viewport. */
const MOBILE_QUERY = '(max-width: 980px)';
function isMobile() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;
}

/** Interactivity turns on once the map has finished translating/scaling to its centered, final
 * position — before that it's still mid-camera-move, so hover/click wouldn't mean anything, and
 * (just as importantly) the map's own transform hasn't settled at the identity value the click-
 * position math below assumes. */
const MAP_SETTLE_END = 0.6;

/** A scroll-driven cinematic reveal, following the brief's five-phase timeline:
 *   0–20%  pure editorial cover — headline dominant, map already large but offset right
 *   20–60% the "camera" moves in — headline recedes (fades/lifts/shrinks left), the map
 *          translates from its offset position to dead center and reaches full scale, the
 *          transmission network becomes more visible
 *   60–97% control chrome (legend, compare panel) cascades in around the now-centered map
 *   97–100% settle room — everything is already in its final state
 * Kept short (previously 60–85%, with 85–100% dead) — the sticky pin held the fully-arrived view
 * static for a stretch of scroll with nothing left to animate, which read as a chunk of blank
 * scrollable space below the map before the section released.
 * Every phase reads off the same smoothed scroll progress via remap()+easeInOutCubic, so nothing
 * is a separate, disconnected animation — it's one continuous camera move through five stages. */
export default function HeroSection({
  discoms,
  stateSpecific,
  geojson,
  stateHue,
  compareSet,
  onToggleState,
  onRemove,
  onViewFullReport,
  onCompare,
  onClearAll,
  compareMode,
  onToggleCompareMode,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const mapInnerRef = useRef<HTMLDivElement>(null);
  const networkLayerRef = useRef<HTMLDivElement>(null);
  const editorialRef = useRef<HTMLDivElement>(null);
  const pylonImgRef = useRef<HTMLImageElement>(null);
  const towerFadeRef = useRef<HTMLDivElement>(null);
  // every one of these cascades in off the same chrome progress value — kept as individual named
  // refs (rather than an indexed array) so each attaches to its JSX element as a plain identifier.
  const controlCompareRef = useRef<HTMLDivElement>(null);
  const mapChromeRef = useRef<HTMLDivElement>(null);
  const revealedRef = useRef(false);

  // outside compare mode, a click jumps straight to that state's full report — no intermediate
  // preview card. In compare mode it instead adds/removes the state from the comparison set.
  function handleStateClick(name: string) {
    if (!revealedRef.current) return;
    if (!compareMode) {
      onViewFullReport(name);
      return;
    }
    onToggleState(name);
  }

  useEffect(() => {
    const stage = stageRef.current;
    const mapInner = mapInnerRef.current;
    const networkLayer = networkLayerRef.current;
    const editorial = editorialRef.current;
    const pylonImg = pylonImgRef.current;
    const towerFade = towerFadeRef.current;
    if (!stage || !mapInner || !networkLayer || !editorial || !pylonImg || !towerFade) return;
    const chromeEls = [controlCompareRef.current, mapChromeRef.current].filter((el): el is HTMLDivElement => el != null);
    // apple-design §14: a viewer who asked for reduced motion still gets the scroll-linked reveal
    // (it only ever moves in direct response to their own scroll input, which reduced-motion
    // guidance doesn't target), but loses the two effects that don't come from their input —
    // the map's restrained overshoot-snap on scale, and the auto "finish the scroll for you"
    // smooth-scroll snap, which for a reduced-motion viewer runs as a plain instant jump instead.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function measure() {
      const rect = stage!.getBoundingClientRect();
      const scrollRange = Math.max(1, rect.height - window.innerHeight);
      const scrolled = Math.max(0, -rect.top);
      const p = Math.max(0, Math.min(1, scrolled / scrollRange));
      return { rect, scrollRange, p };
    }

    function applyStyles(p: number) {
      // pylon texture: opacity stays fixed (set in CSS) so it reads the same everywhere on the
      // page. A slow, small parallax drift (opposite direction to the map's own rightward-to-
      // centered travel) gives the backdrop a sense of depth rather than reading as a flat
      // sticker behind the map.
      pylonImg!.style.transform = reduceMotion ? 'scale(1.5)' : `scale(1.5) translateX(${lerp(0, -22, easeInOutCubic(p))}px)`;

      // phase 1: editorial recedes — fades, lifts left, scales down slightly — over 12–45%.
      const editorialT = easeInOutCubic(remap(p, 0.12, 0.45));
      editorial!.style.opacity = String(1 - editorialT);
      editorial!.style.transform = `translate(${lerp(0, -48, editorialT)}px, -50%) scale(${lerp(1, 0.94, editorialT)})`;

      // the left pylon stays hidden behind the paper-color fade only while the editorial copy
      // sits on top of it — once that copy has receded there's nothing left to declutter for, so
      // the fade lifts in lockstep and the full tower art (including the left pylon) shows through.
      towerFade!.style.opacity = String(1 - editorialT);
      editorial!.style.pointerEvents = editorialT > 0.85 ? 'none' : 'auto';

      // phase 2: the map translates from offset-right to dead center and reaches full scale
      // over 18–60% — percentage-based translateX so the offset scales with the map's own box,
      // not a hardcoded pixel amount. Position eases in-out (no wobble); scale gets a restrained
      // overshoot so it settles into its final size with a confident snap instead of a flat,
      // mechanical arrival.
      const mapMoveT = easeInOutCubic(remap(p, 0.18, MAP_SETTLE_END));
      const mapScaleT = reduceMotion ? mapMoveT : easeOutBack(remap(p, 0.18, MAP_SETTLE_END));
      mapInner!.style.transform = `translateX(${lerp(19, 0, mapMoveT)}%) scale(${lerp(0.82, 1, mapScaleT)})`;

      // network becomes more visible across roughly the same span the camera is moving in.
      const networkT = easeInOutCubic(remap(p, 0.18, 0.55));
      networkLayer!.style.opacity = String(lerp(0.35, 1, networkT));

      // phase 3: chrome (stats, compass, legend, both panels) cascades in around the now-
      // centered map, 60–97%.
      const chromeT = easeInOutCubic(remap(p, MAP_SETTLE_END, 0.97));
      chromeEls.forEach((el) => {
        el.style.opacity = String(chromeT);
        el.style.transform = `translateY(${lerp(14, 0, chromeT)}px)`;
      });

      const revealed = p >= MAP_SETTLE_END;
      revealedRef.current = revealed;
      mapInner!.style.pointerEvents = revealed ? 'auto' : 'none';
    }

    // the raw scroll fraction is only ever used as a *target* — every visual property eases
    // toward it a little each frame instead of snapping straight to the scrollbar position, so
    // the whole transition reads as smooth/"scrubbed" rather than mechanically tied to scroll.
    let smoothP = measure().p;
    let rafId: number | null = null;

    function loop() {
      const { p: targetP } = measure();
      smoothP += (targetP - smoothP) * 0.14;
      const settled = Math.abs(targetP - smoothP) < 0.0008;
      if (settled) smoothP = targetP;
      applyStyles(smoothP);
      rafId = settled ? null : requestAnimationFrame(loop);
    }
    function ensureLoop() {
      if (rafId == null) rafId = requestAnimationFrame(loop);
    }

    let endTimer: ReturnType<typeof setTimeout>;
    function settle() {
      const { rect, scrollRange, p } = measure();
      if (p <= 0.02 || p >= 0.98) return; // already at an end state
      // biased toward completing the reveal, not a 50/50 split: any deliberate scroll down
      // should commit to the full transformation rather than requiring the user to cross the
      // exact halfway point before it "counts" — snapping back to landing only if they barely
      // moved.
      const targetP = p < 0.12 ? 0 : 1;
      const targetTop = window.scrollY + rect.top + targetP * scrollRange;
      window.scrollTo({ top: targetTop, behavior: reduceMotion ? 'instant' : 'smooth' });
    }

    function onScroll() {
      if (isMobile()) return;
      ensureLoop();
      clearTimeout(endTimer);
      endTimer = setTimeout(settle, 140);
    }
    function onResize() {
      // below the mobile breakpoint the CSS media query takes over completely (every animated
      // element gets its final opacity/transform via `!important`, overriding whatever inline
      // style JS last wrote) — so JS simply stops touching these elements rather than trying to
      // compute a "mobile" version of the same phase math, which would fight the stylesheet.
      revealedRef.current = isMobile() ? true : revealedRef.current;
      if (isMobile()) return;
      ensureLoop();
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    if (isMobile()) {
      revealedRef.current = true;
    } else {
      applyStyles(smoothP); // paint the initial state immediately, with no lag
    }
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      clearTimeout(endTimer);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section className="hero-stage" ref={stageRef}>
      <div className="hero-sticky">
        <div className="hero-bg-fabric" aria-hidden="true">
          <div className="tower-photo-layer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pylon-lineart.png" alt="" className="tower-photo-img" ref={pylonImgRef} />
          </div>
          <div className="tower-photo-fade" ref={towerFadeRef} />
        </div>
        <div className="hero-ambient-glow" aria-hidden="true" />

        <div className="hero-coverage-badge">
          <strong>--%</strong> of India&rsquo;s population covered
        </div>

        <div className="hero-editorial" ref={editorialRef}>
          <h1>India DISCOM Performance Dashboard</h1>
          <div className="hero-scope">
            <span className="scope-pill scope-pill--a">India&rsquo;s First Power Quality Dashboard</span>
          </div>
          <p className="lede">
            Understanding how electricity distribution companies (DISCOMs) across India perform against regulator-specified Standards of
            Performance, and enabling comparison across jurisdictions and utilities.
          </p>
          <div className="hero-cta">Scroll to expand the map ↓</div>
        </div>

        <div className="hero-map-stage">
          <div className="hero-map-inner" ref={mapInnerRef}>
            <HeroMap
              discoms={discoms}
              stateSpecific={stateSpecific}
              geojson={geojson}
              compareColorOf={(name) => compareColor(compareSet, name)}
              onStateClick={handleStateClick}
              compareMode={compareMode}
            />
            <div className="hero-network-layer" ref={networkLayerRef} />
          </div>

          <div className="map-chrome" ref={mapChromeRef}>
            <div className="map-legend" aria-hidden="true">
              <div className="map-legend-row">
                <span className="map-legend-dot map-legend-dot--tracked" />
                Tracked
              </div>
              <div className="map-legend-row">
                <span className="map-legend-dot map-legend-dot--no-data" />
                Tracked—Data Not Reported
              </div>
              <div className="map-legend-row">
                <span className="map-legend-dot map-legend-dot--none" />
                Coming soon
              </div>
            </div>
          </div>
        </div>

        <div className="overlay-compare" ref={controlCompareRef}>
          <ComparePanel
            stateHue={stateHue}
            compareSet={compareSet}
            onRemove={onRemove}
            onCompare={onCompare}
            onClearAll={onClearAll}
            compareMode={compareMode}
            onToggleCompareMode={onToggleCompareMode}
          />
        </div>
      </div>
    </section>
  );
}

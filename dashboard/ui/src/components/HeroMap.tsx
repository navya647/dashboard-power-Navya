'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { buildIndiaPaths } from '@/lib/geo2d';
import { stateFillColor, stateMapStatus } from '@/lib/computations';
import { lerpHex, MAP_BORDER, MAP_WASH } from '@/lib/colors';
import { formatPopulation } from '@/lib/population';
import type { Discom, IndiaGeoJSON, StateSpecificData } from '@/lib/types';

interface Props {
  discoms: Discom[];
  stateSpecific?: StateSpecificData | null;
  geojson: IndiaGeoJSON;
  compareColorOf: (name: string) => string | null;
  onStateClick: (name: string) => void;
  compareMode?: boolean;
  onCentroids?: (centroids: Record<string, [number, number]>, size: { width: number; height: number }) => void;
}

/** India as a flat, editorial SVG map — warm ivory/stone and muted terracotta/clay fills (not a
 * saturated choropleth) and a delicate hairline border, so it reads as one illustrated atlas, not
 * a GIS layer. Every state stays visible and clickable at all times: hovering lifts one state
 * forward with a soft gold outline and a small tooltip; selecting it (via the compare set) blends
 * that state's category color into its own fill rather than swapping to a foreign hue, so it
 * stays visually part of India.
 *
 * (An earlier pass added an SVG feTurbulence "paper grain" rect over the whole map — pulled after
 * it turned out to render as a visible rectangular tint rather than a subtle texture, since the
 * filter never composited back with the map beneath it; a plain <rect> with no explicit fill
 * defaults to opaque black in SVG, and the mix-blend-mode:multiply meant to soften it instead
 * produced a hard-edged box exactly the size of the map's own bounding box.) */
export default function HeroMap({ discoms, stateSpecific, geojson, compareColorOf, onStateClick, compareMode, onCentroids }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  // touch devices have no hover, so the first tap can't preview a state the way a mouse hover
  // does — it would otherwise jump straight to that state's report before the user ever saw the
  // tooltip. On such devices the first tap on a state just shows the tooltip (acts as "hover");
  // a second tap on the *same*, already-previewed state is what actually navigates.
  const [canHover, setCanHover] = useState(true);
  const uid = useId().replace(/:/g, '');

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover)');
    const sync = () => setCanHover(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setSize({ width: box.width, height: box.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const projection = useMemo(() => {
    if (!size.width || !size.height) return null;
    return buildIndiaPaths(geojson, size.width, size.height);
  }, [geojson, size.width, size.height]);

  // held in a ref rather than the effect's own dependency array: onCentroids is a fresh inline
  // closure on every parent render, and the parent's callback updates its own state — depending
  // on the callback's identity here would re-fire the effect every time that state updates,
  // which re-calls the callback again, forever. Synced via its own effect (not during render)
  // since writing a ref mid-render is itself not allowed.
  const onCentroidsRef = useRef(onCentroids);
  useEffect(() => {
    onCentroidsRef.current = onCentroids;
  });

  useEffect(() => {
    if (!projection) return;
    const centroids: Record<string, [number, number]> = {};
    projection.paths.forEach((p) => {
      centroids[p.name] = p.centroid;
    });
    onCentroidsRef.current?.(centroids, size);
  }, [projection, size]);

  const hoveredPath = hovered ? projection?.byName[hovered] : null;
  const hoveredStatus = hovered ? stateMapStatus(discoms, hovered, stateSpecific) : null;
  // In compare-selection mode, a jurisdiction with no captured evidence in either dataset
  // ('idle') can't be added to a comparison at all — there is nothing to compare — so its tooltip
  // says so explicitly rather than the ordinary "Coming soon" (which is about single-state lookup,
  // where an idle state is still clickable through to its own "coming soon" report).
  const hoveredDisabledForCompare = !!compareMode && hoveredStatus === 'idle';
  const hoveredTip = hoveredDisabledForCompare
    ? 'Not yet included in current dashboard coverage'
    : hoveredStatus === 'tracked' || hoveredStatus === 'no-data'
      ? 'Explore Performance →'
      : 'Coming soon →';
  const hoveredPopulation = hovered ? formatPopulation(hovered) : null;

  function handleClick(name: string, disabledForCompare: boolean) {
    if (disabledForCompare) return;
    // the preview/confirm gate exists only to stop a tap from jumping straight to a state's
    // full report before its been previewed. Compare mode never navigates — it just toggles the
    // state in/out of the comparison set, a reversible, in-place action — so it should always
    // take effect on the first tap, on touch devices too.
    if (canHover || compareMode) {
      onStateClick(name);
      return;
    }
    // first tap previews (same as hover would), second tap on the same state confirms
    if (hovered !== name) {
      setHovered(name);
      return;
    }
    onStateClick(name);
  }

  return (
    <div className="hero-map-2d" ref={wrapRef}>
      {projection && (
        <svg
          className="hero-map-svg"
          viewBox={`0 0 ${size.width} ${size.height}`}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          // tapping empty space inside the map (ocean, outside every state path) cancels
          // whatever's currently previewed — only relevant on touch (see handleClick), but
          // harmless to clear on desktop too since a mouseleave would already have done so.
          onClick={(e) => {
            if (e.target === e.currentTarget) setHovered(null);
          }}
        >
          <g className="hero-map-states">
            {projection.paths.map((p) => {
              const status = stateMapStatus(discoms, p.name, stateSpecific);
              const disabledForCompare = !!compareMode && status === 'idle';
              const selectColor = compareColorOf(p.name);
              const isHovered = hovered === p.name;
              const isDimmed = hovered != null && !isHovered;

              let fill = stateFillColor(status);
              if (selectColor) fill = lerpHex(fill, selectColor, 0.32);
              if (isDimmed) fill = lerpHex(fill, MAP_WASH, 0.22);
              if (disabledForCompare) fill = lerpHex(fill, '#9a9a9a', 0.55);

              const strokeColor = selectColor ?? MAP_BORDER;
              const strokeWidth = selectColor ? 1.6 : isHovered ? 1.4 : 1.25;
              const strokeOpacity = disabledForCompare ? 0.5 : selectColor ? 0.9 : isHovered ? 0.95 : 0.85;

              return (
                <path
                  key={p.name}
                  d={p.d}
                  fill={fill}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeOpacity={strokeOpacity}
                  strokeLinejoin="round"
                  className={`hero-state-path${disabledForCompare ? ' disabled-for-compare' : ' clickable'}${isHovered ? ' hovered' : ''}`}
                  onMouseEnter={canHover ? () => setHovered(p.name) : undefined}
                  onMouseLeave={canHover ? () => setHovered((h) => (h === p.name ? null : h)) : undefined}
                  onClick={() => handleClick(p.name, disabledForCompare)}
                />
              );
            })}
          </g>
          {/* landing-view "glass" skin: India as one borderless translucent shape with a glowing
              outline and a light dot circling the mainland coast/border. HeroSection fades it out
              (and the real state map in) via the --hero-glass CSS variable as the user scrolls. */}
          <defs>
            <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.52" />
              <stop offset="20%" stopColor="#ffffff" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.50" />
            </linearGradient>
          </defs>
          <g className="hero-map-glass" aria-hidden="true">
            <path d={projection.outlineAll} fill={`url(#${uid}-glass)`} className="hero-glass-fill" />
            <path d={projection.outlineAll} fill="none" className="hero-glass-edge" />
            <g className="hero-glass-motion">
              <path d={projection.outline} fill="none" pathLength={1000} className="hero-glass-trail">
                <animate attributeName="stroke-dashoffset" from="60" to="-940" dur="80s" repeatCount="indefinite" />
              </path>
            </g>
          </g>
        </svg>
      )}
      {hoveredPath && (
        <div className="hero-map-tip" style={{ left: hoveredPath.centroid[0], top: hoveredPath.centroid[1] }}>
          <strong>{hovered}</strong>
          {hoveredPopulation && <span className="hero-map-tip-population">Population: {hoveredPopulation}</span>}
          <span>{hoveredTip}</span>
        </div>
      )}
    </div>
  );
}

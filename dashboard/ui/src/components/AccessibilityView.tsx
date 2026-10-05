'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useData } from '@/lib/DataContext';
import { buildIndiaPaths } from '@/lib/geo2d';
import { machineReadableDisplayStatus } from '@/lib/computations';
import { REGULATORS } from '@/lib/regulators';
import type { DiscomAccessibility, StateAccessibility } from '@/lib/types';
import { Arrow, RegulationDocs, ReportedDataTable } from './SourceDocuments';

/** The Accessibility page: an India map coloured by whether each state's DISCOMs publish their
 * performance data (machine-readable / published but not / not published), and a card for the
 * clicked state with its year-wise reports and regulation documents — only parts every covered state has. Status is the same
 * for every DISCOM in a state, so it's shown once, per state. Nothing is scored — every figure is a
 * count of the source workbook's own Yes/No cells. */

type Bucket = 'readable' | 'pdf' | 'none';
const LABEL: Record<Bucket | 'out', string> = {
  readable: 'Machine-readable',
  pdf: 'Published, not machine-readable',
  none: 'Not published',
  out: 'Not yet covered',
};
const bucketOf = (d: DiscomAccessibility): Bucket =>
  d.available_on_serc !== true ? 'none' : machineReadableDisplayStatus(d) === true ? 'readable' : 'pdf';
/** a state's status: its DISCOMs' shared bucket, or the least accessible one if they ever differ */
const stateBucket = (ds: DiscomAccessibility[]): Bucket | null => {
  if (!ds.length) return null;
  const bs = ds.map(bucketOf);
  return bs.includes('none') ? 'none' : bs.includes('pdf') ? 'pdf' : 'readable';
};

const MAP_W = 600;
const MAP_H = 660;

function StateCard({ state, discoms, regulation, onClose }: { state: string; discoms: DiscomAccessibility[]; regulation: StateAccessibility | undefined; onClose: () => void }) {
  const bucket = stateBucket(discoms);
  // the state's commission: the page its DISCOM data was found on when the workbook records one,
  // otherwise the commission's homepage
  const regulator = REGULATORS[state];
  const regulatorUrl = discoms.find((d) => d.serc_link)?.serc_link ?? regulator?.url ?? null;

  return (
    <article className="acm-card" key={state} aria-labelledby="acm-card-title">
      <header className="acm-card-head">
        <h2 id="acm-card-title">{state}</h2>
        <button type="button" className="acm-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>
      {bucket && (
        <span className={`acm-status acm-tone-${bucket}`}>
          <span className="acm-swatch" aria-hidden="true" />
          {LABEL[bucket]}
        </span>
      )}

      <section className="acm-block">
        <h3>DISCOMs · reported data</h3>
        <ReportedDataTable state={state} discoms={discoms} />
      </section>

      <section className="acm-block">
        <h3>SoP regulation</h3>
        <RegulationDocs state={state} regulation={regulation} />
      </section>

      {regulator && regulatorUrl && (
        <a className="acm-regulator" href={regulatorUrl} target="_blank" rel="noopener noreferrer" title={regulator.name}>
          {regulator.abbr} website
          <Arrow />
          <span className="sr-only"> — {regulator.name} (opens in a new tab)</span>
        </a>
      )}
    </article>
  );
}

export default function AccessibilityView() {
  const { accessibility, geojson, loading, error } = useData();
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const dotsId = useId();
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const map = useMemo(() => (geojson ? buildIndiaPaths(geojson, MAP_W, MAP_H, 0.02) : null), [geojson]);

  // The map fills exactly the window height left below the title, legend included, so the page
  // never scrolls on desktop — measured (like the About page's glossary frame) rather than a fixed
  // calc, since the title's height and the legend's line count vary with width and zoom.
  const svgRef = useRef<SVGSVGElement>(null);
  const legendRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const legend = legendRef.current;
    if (!svg || !legend) return;
    const fit = () => {
      if (window.matchMedia('(max-width: 900px)').matches) {
        svg.style.maxHeight = '';
        return;
      }
      const top = svg.getBoundingClientRect().top + window.scrollY;
      const legendH = legend.getBoundingClientRect().height + parseFloat(getComputedStyle(legend).marginTop);
      let h = window.innerHeight - top - legendH - 16;
      svg.style.maxHeight = `${Math.max(320, h)}px`;
      // whatever still overflows (page padding below, etc.) comes off the map too
      const over = document.documentElement.scrollHeight - window.innerHeight;
      if (over > 0) {
        h -= over + 1;
        svg.style.maxHeight = `${Math.max(320, h)}px`;
      }
    };
    fit();
    document.fonts?.ready.then(fit);
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [map, accessibility]);

  // The selected state's card is taken out of the page flow (absolute, desktop only) so a card
  // taller than the map — Andhra Pradesh's — can't grow the page and bring back a scrollbar. It's
  // centred on the map, then nudged up into the free space beside the title if it would otherwise
  // run past the bottom of the window (never above the logo area).
  const sideRef = useRef<HTMLDivElement>(null);
  const cardWrapRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const side = sideRef.current;
    const wrap = cardWrapRef.current;
    if (!side || !wrap) return;
    const place = () => {
      if (window.matchMedia('(max-width: 900px)').matches) {
        wrap.style.top = '';
        return;
      }
      const sideTop = side.getBoundingClientRect().top + window.scrollY;
      const h = wrap.offsetHeight;
      let top = (side.clientHeight - h) / 2;
      const maxTop = window.innerHeight - 16 - sideTop - h; // bottom edge stays in the window
      const minTop = 120 - sideTop; // top edge stays clear of the logo
      if (top > maxTop) top = maxTop;
      if (top < minTop) top = minTop;
      wrap.style.top = `${top}px`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(wrap);
    ro.observe(side);
    window.addEventListener('resize', place);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [selected]);

  if (loading) return <p className="detail-placeholder">Loading dashboard data…</p>;
  if (error || !accessibility || !map) return <p className="detail-placeholder">Could not load dashboard data: {error}</p>;

  const { discoms, states, state_order, summary } = accessibility;
  const byState = (s: string) => discoms.filter((d) => d.state === s);
  const regByState = new Map(states.map((s) => [s.state, s]));
  const covered = new Set(state_order);
  const bucketByState = new Map(state_order.map((s) => [s, stateBucket(byState(s))]));
  const readable = discoms.filter((d) => bucketOf(d) === 'readable').length;
  const allRegs = summary.states_total > 0 && summary.states_regulation_available === summary.states_total;

  const toggle = (s: string) => setSelected((cur) => (cur === s ? null : s));
  const onKey = (e: KeyboardEvent, s: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle(s);
    }
  };
  const labelled = selected ?? hovered;
  const labelAt = labelled ? map.byName[labelled]?.centroid : null;

  return (
    <div className="methodology-page about-page acm">
      <div className="kicker" style={{ marginTop: 0 }}>
        <span className="bar" />
        <span className="label">Accessibility</span>
      </div>
      <h1 className="method-hero-title">Regulatory &amp; Data Transparency</h1>

      <div className="acm-stage">
        <figure className="acm-map">
          <svg ref={svgRef} viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="group" aria-label="States by whether their DISCOMs publish performance data">
            <defs>
              {/* "not yet covered": the home map's "Coming soon" look — greige with a fine dot grid */}
              <pattern id={dotsId} patternUnits="userSpaceOnUse" width="4" height="4">
                <circle cx="2" cy="2" r="0.85" className="acm-out-dot" />
              </pattern>
            </defs>
            <g className={`acm-states${selected ? ' has-selection' : ''}${shown ? ' is-shown' : ''}`}>
              {map.paths.map((p, i) => {
                if (!covered.has(p.name)) return <path key={p.name} d={p.d} className="acm-state acm-state--out" />;
                const b = bucketByState.get(p.name);
                const on = selected === p.name;
                return (
                  <path
                    key={p.name}
                    d={p.d}
                    className={`acm-state acm-tone-${b ?? 'none'}${on ? ' is-selected' : ''}`}
                    style={{ transitionDelay: shown ? `${(i % 12) * 30}ms` : undefined }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={on}
                    aria-label={`${p.name}: ${b ? LABEL[b] : 'N/A'}`}
                    onClick={() => toggle(p.name)}
                    onKeyDown={(e) => onKey(e, p.name)}
                    onMouseEnter={() => setHovered(p.name)}
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })}
            </g>
            <g className="acm-out-dots" aria-hidden="true">
              {map.paths
                .filter((p) => !covered.has(p.name))
                .map((p) => (
                  <path key={p.name} d={p.d} fill={`url(#${dotsId})`} />
                ))}
            </g>
            {selected && map.byName[selected] && <path d={map.byName[selected].d} className="acm-outline" />}
            {labelled && labelAt && (
              <text x={labelAt[0]} y={labelAt[1]} className="acm-label" textAnchor="middle" dominantBaseline="middle">
                {labelled}
              </text>
            )}
          </svg>
          <figcaption className="acm-legend" ref={legendRef}>
            {(['readable', 'pdf', 'none', 'out'] as const).map((k) => (
              <span key={k} className={`acm-tone-${k}`}>
                <span className="acm-swatch" aria-hidden="true" />
                {LABEL[k]}
              </span>
            ))}
          </figcaption>
        </figure>

        <div className={`acm-side${selected ? ' has-card' : ''}`} ref={sideRef}>
          {selected ? (
            <div className="acm-card-wrap" ref={cardWrapRef}>
              <StateCard state={selected} discoms={byState(selected)} regulation={regByState.get(selected)} onClose={() => setSelected(null)} />
            </div>
          ) : (
            <div className="acm-intro">
              <p className="acm-big">
                {readable}
                <span>/{discoms.length}</span>
              </p>
              <p className="acm-intro-text">DISCOMs publish their performance data in a machine-readable format.</p>
              <p className="acm-intro-reg">
                {allRegs
                  ? `All ${summary.states_total} states publish their SoP regulation online.`
                  : `${summary.states_regulation_available} of ${summary.states_total} states publish their SoP regulation online.`}
              </p>
              <p className="acm-hint">Select a state on the map.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

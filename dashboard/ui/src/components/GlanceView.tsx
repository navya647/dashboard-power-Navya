'use client';

import Link from 'next/link';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useData } from '@/lib/DataContext';
import { fyLabel } from '@/lib/format';
import { indicatorLabel } from '@/lib/glossary';
import { axisTitleForUnit, formatInUnit } from '@/lib/indicatorUnits';
import { slugify } from '@/lib/slug';
import { useNoScrollbar } from '@/lib/useNoScrollbar';
import { buildGlance, glanceIndicators, glanceYears, type GlanceGroup, type GlanceRow } from '@/lib/glance';

/** The At a glance page: one reliability indicator, one year, every DISCOM's reported figure.
 *
 * Each chart is one CSS grid — state | DISCOM | figure | plot — so every part lines up by
 * construction: the axis and its gridlines sit in the plot column, each state's benchmark is one
 * line spanning exactly its DISCOMs' rows in that same column, and figures sit in their own
 * right-aligned column where nothing can collide with them. A state's DISCOMs come together
 * (lib/glance.ts), the state written once. Bars are coloured only by the source's own verdict.
 * Figures share a chart only when they share a unit and direction; where an indicator is reported
 * in more than one such way, one chart is shown at a time, picked from a "Reported as" switcher.
 *
 * The chart's heading is its short unit (the source's full wording on hover); the legend is one
 * quiet line under it. Rows size themselves so the chart fits the window on desktop (no page
 * scroll). The selected DISCOM's card sits beside the chart. */

const DIRECTION_TEXT = { lower_is_better: 'Lower is better', higher_is_better: 'Higher is better', direction_unknown: null } as const;

const verdictOf = (r: GlanceRow) => (r.standardMet === true ? 'met' : r.standardMet === false ? 'missed' : 'none');
const rowKey = (r: GlanceRow) => r.discom.sheet;

interface Props {
  initialIndicator: string | null;
  initialYear: string | null;
}

export default function GlanceView({ initialIndicator, initialYear }: Props) {
  const { discoms, loading, error } = useData();
  const indicators = useMemo(() => (discoms ? glanceIndicators(discoms) : []), [discoms]);
  const [indicator, setIndicator] = useState<string | null>(initialIndicator);
  const [year, setYear] = useState<string | null>(initialYear);
  const [selected, setSelected] = useState<string | null>(null);
  const [rep, setRep] = useState<string | null>(null);
  useNoScrollbar();

  // the indicator/year actually shown: a requested one that has figures, else the first
  // indicator and its latest year with figures
  const ind = indicator && indicators.includes(indicator) ? indicator : (indicators[0] ?? null);
  const years = useMemo(() => (discoms && ind ? glanceYears(discoms, ind) : []), [discoms, ind]);
  const yr = year && years.includes(year) ? year : (years[0] ?? null);
  const glance = useMemo(() => (discoms && ind && yr ? buildGlance(discoms, ind, yr) : null), [discoms, ind, yr]);

  // shareable URL (?indicator=&year=), kept in sync without a navigation
  useEffect(() => {
    if (!ind || !yr) return;
    const qs = new URLSearchParams({ indicator: ind, year: yr }).toString();
    window.history.replaceState(null, '', `${window.location.pathname}?${qs}`);
  }, [ind, yr]);

  // a selection only means something on the chart it was made on
  useEffect(() => setSelected(null), [ind, yr, rep]);
  // a picked representation carries across years of the same indicator, not to another indicator
  useEffect(() => setRep(null), [ind]);

  if (loading) return <p className="detail-placeholder">Loading dashboard data…</p>;
  if (error || !discoms || !glance || !ind || !yr) return <p className="detail-placeholder">Could not load dashboard data: {error}</p>;

  // one way of reporting the indicator on screen at a time: the one most DISCOMs use, unless
  // another was picked
  const group = glance.groups.find((g) => g.key === rep) ?? glance.groups[0];
  const sel = group.rows.find((r) => rowKey(r) === selected) ?? null;
  const label = indicatorLabel(ind);
  const toggle = (k: string) => setSelected((cur) => (cur === k ? null : k));

  return (
    <div className="methodology-page about-page glc">
      <div className="kicker" style={{ marginTop: 0 }}>
        <span className="bar" />
        <span className="label">At a glance</span>
      </div>
      <h1 className="method-hero-title">Quick Comparison Across DISCOMs</h1>

      <div className="glc-bar">
        <div className="glc-tabs" role="tablist" aria-label="Indicator">
          {indicators.map((i) => (
            <button key={i} type="button" role="tab" aria-selected={i === ind} className={`glc-tab${i === ind ? ' is-active' : ''}`} onClick={() => setIndicator(i)}>
              {indicatorLabel(i)}
            </button>
          ))}
        </div>
        <div className="glc-years" role="radiogroup" aria-label="Financial year">
          {[...discoms.years].reverse().map((y) => {
            const has = years.includes(y);
            return (
              <button
                key={y}
                type="button"
                role="radio"
                aria-checked={y === yr}
                disabled={!has}
                className={`glc-year${y === yr ? ' is-active' : ''}`}
                onClick={() => setYear(y)}
                title={has ? undefined : `No ${label} figures for ${fyLabel(y)}`}
              >
                {fyLabel(y)}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`glc-body${sel ? ' has-card' : ''}`}>
        <div className="glc-main" key={`${ind}|${yr}|${group.key}`}>
          <Chart group={group} groups={glance.groups} onPickGroup={setRep} selected={selected} onSelect={toggle} />
        </div>
        {sel && (
          <aside className="glc-aside">
            <DetailCard key={rowKey(sel)} row={sel} group={group} year={yr} onClose={() => setSelected(null)} />
          </aside>
        )}
      </div>
    </div>
  );
}

/** A state's DISCOMs, consecutive on the chart, sharing the state's one benchmark. */
interface Block {
  state: string;
  benchmark: number | null;
  rows: GlanceRow[];
}

function blocksOf(rows: GlanceRow[]): Block[] {
  const out: Block[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.state === r.discom.state) last.rows.push(r);
    else out.push({ state: r.discom.state, benchmark: r.benchmark, rows: [r] });
  }
  return out;
}

/** A representation's short name: its display unit, plus its direction where two share a unit. */
function groupLabel(g: GlanceGroup, all: GlanceGroup[]): string {
  const unit = axisTitleForUnit(g.unit);
  const dir = DIRECTION_TEXT[g.direction];
  return dir && all.some((o) => o !== g && axisTitleForUnit(o.unit) === unit) ? `${unit} (${dir.toLowerCase()})` : unit;
}

/** Row height that lets the whole chart fit the window below where it starts (desktop only),
 * kept between a compact floor and the usual 28px. */
const ROW_MIN = 20;
const ROW_MAX = 28;
function useFitRowHeight(chart: RefObject<HTMLElement | null>, grid: RefObject<HTMLElement | null>, rows: number, gaps: number) {
  const [rowH, setRowH] = useState<number | null>(null);
  useLayoutEffect(() => {
    const fit = () => {
      const c = chart.current;
      const g = grid.current;
      if (!c || !g || window.innerWidth <= 900) return setRowH(null);
      const css = getComputedStyle(c);
      const axisH = parseFloat(css.getPropertyValue('--glc-axis-h')) || 26;
      const gapH = parseFloat(css.getPropertyValue('--glc-gap-h')) || 12;
      const gridTop = g.getBoundingClientRect().top + window.scrollY;
      const below = c.getBoundingClientRect().bottom - g.getBoundingClientRect().bottom; // the legend line
      const avail = window.innerHeight - gridTop - below - 28 - axisH - gaps * gapH;
      setRowH(Math.max(ROW_MIN, Math.min(ROW_MAX, Math.floor(avail / rows))));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [chart, grid, rows, gaps]);
  return rowH;
}

function Chart({
  group,
  groups,
  onPickGroup,
  selected,
  onSelect,
}: {
  group: GlanceGroup;
  groups: GlanceGroup[];
  onPickGroup: (key: string) => void;
  selected: string | null;
  onSelect: (k: string) => void;
}) {
  const dir = DIRECTION_TEXT[group.direction];
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / group.scaleMax) * 100))}%`;
  const blocks = blocksOf(group.rows);
  const title = groupLabel(group, groups);
  const chartRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const rowH = useFitRowHeight(chartRef, gridRef, group.rows.length, blocks.length - 1);
  const hasNote = group.rows.some((r) => r.note);
  // grid rows: the axis, then each DISCOM's row, with a spacer row between states (the rule
  // between them sits in it), so state blocks get air without the rows themselves changing size
  const tracks = ['var(--glc-axis-h)'];
  blocks.forEach((b, bi) => {
    if (bi > 0) tracks.push('var(--glc-gap-h)');
    for (let i = 0; i < b.rows.length; i++) tracks.push('var(--glc-row-h)');
  });
  let line = 2; // grid line the next row starts on (line 1 is the axis)

  return (
    <section className="glc-chart" aria-label={title} ref={chartRef} style={rowH ? ({ '--glc-row-h': `${rowH}px` } as CSSProperties) : undefined}>
      <header className="glc-chart-head">
        {/* the unit, short; the source's own full wording on hover. Where DISCOMs report the
            indicator in more than one way, one at a time, picked here */}
        {groups.length > 1 ? (
          <div className="glc-reps" role="tablist" aria-label="Reported as">
            <span className="glc-reps-label">Reported as</span>
            {groups.map((g) => (
              <button
                key={g.key}
                type="button"
                role="tab"
                aria-selected={g === group}
                className={`glc-rep${g === group ? ' is-active' : ''}`}
                title={g.wording ?? undefined}
                onClick={() => onPickGroup(g.key)}
              >
                {groupLabel(g, groups)}
                <span className="glc-rep-n">{g.rows.length}</span>
              </button>
            ))}
          </div>
        ) : (
          <h2 title={group.wording ?? undefined}>{title}</h2>
        )}
        {dir && <span className="glc-dir">{dir}</span>}
      </header>

      <div className="glc-grid" ref={gridRef} style={{ gridTemplateRows: tracks.join(' ') }}>
        {/* the axis: tick labels over the plot column, gridlines down through every row */}
        <div className="glc-axis" aria-hidden="true">
          {group.ticks.map((t, i) => (
            <span key={t} className={i === 0 ? 'is-first' : i === group.ticks.length - 1 ? 'is-last' : undefined} style={{ left: pct(t) }}>
              {formatInUnit(t, group.unit)}
            </span>
          ))}
        </div>
        <div className="glc-gridlines" aria-hidden="true">
          {group.ticks.map((t) => (
            <i key={t} style={{ left: pct(t) }} />
          ))}
        </div>

        {blocks.map((b, bi) => {
          if (bi > 0) line++; // the spacer row
          const start = line;
          line += b.rows.length;
          const span = `${start} / span ${b.rows.length}`;
          return (
            <Fragment key={b.state}>
              {bi > 0 && <div className="glc-sep" style={{ gridRow: start - 1 }} aria-hidden="true" />}
              <div className="glc-state" style={{ gridRow: span }}>
                {b.state}
              </div>
              {b.rows.map((r, i) => {
                const k = rowKey(r);
                const on = k === selected;
                return (
                  <button
                    key={k}
                    type="button"
                    className={`glc-row glc-v-${verdictOf(r)}${on ? ' is-selected' : ''}`}
                    style={{ gridRow: start + i }}
                    aria-pressed={on}
                    aria-label={`${r.discom.short_name}, ${r.discom.state}: ${formatInUnit(r.value, group.unit)}`}
                    title={r.discom.full_name}
                    onClick={() => onSelect(k)}
                  >
                    <span className="glc-name">{r.discom.short_name}</span>
                    <span className="glc-fig">
                      {formatInUnit(r.value, group.unit)}
                      {r.note && <sup aria-label="has a note">*</sup>}
                    </span>
                    <span className="glc-plot">
                      <span className="glc-fill" style={{ width: pct(r.value), animationDelay: `${(start - 2 + i) * 30}ms` }} />
                    </span>
                  </button>
                );
              })}
              {/* the state's benchmark: one line through exactly its rows; value on hover/focus */}
              {b.benchmark != null && (
                <span
                  className="glc-bench"
                  style={{ gridRow: span, '--at': pct(b.benchmark) } as CSSProperties}
                  tabIndex={0}
                  aria-label={`${b.state} benchmark: ${formatInUnit(b.benchmark, group.unit)}`}
                >
                  <span className="glc-bench-hit">
                    <span className="glc-bench-tip" role="tooltip">
                      {b.state} benchmark <b>{formatInUnit(b.benchmark, group.unit)}</b>
                    </span>
                  </span>
                </span>
              )}
            </Fragment>
          );
        })}
      </div>

      {/* the key, once, quietly under the chart */}
      <Legend note={hasNote} />
    </section>
  );
}

/** The same key on every indicator. */
function Legend({ note }: { note: boolean }) {
  return (
    <p className="glc-legend">
      <span className="glc-v-met">
        <i className="glc-swatch" aria-hidden="true" />
        Met
      </span>
      <span className="glc-v-missed">
        <i className="glc-swatch" aria-hidden="true" />
        Not met
      </span>
      <span className="glc-v-none">
        <i className="glc-swatch" aria-hidden="true" />
        No verdict
      </span>
      <span>
        <i className="glc-bench-glyph" aria-hidden="true" />
        Benchmark
      </span>
      {note && (
        <span>
          <b className="glc-legend-star" aria-hidden="true">*</b>
          Has a note (click the DISCOM)
        </span>
      )}
    </p>
  );
}

function DetailCard({ row, group, year, onClose }: { row: GlanceRow; group: GlanceGroup; year: string; onClose: () => void }) {
  const d = row.discom;
  const verdict = verdictOf(row);
  const reason = row.reasonNotComparable && row.reasonNotComparable !== 'N/A' ? row.reasonNotComparable : null;
  const notes = [verdict === 'none' ? reason : null, row.benchmarkNote, row.note].filter(
    Boolean,
  ) as string[];

  // a card with several notes (Rajasthan's: own wording, restated benchmark, unit conversion) can
  // run past the window's bottom. It then tightens itself (is-tight-1, then is-tight-2), measured
  // synchronously on the DOM; if even that doesn't fit, it scales down just enough to (zoom ≥ 0.75)
  const cardRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = cardRef.current;
    const aside = el?.parentElement;
    if (!el || !aside) return;
    const fit = () => {
      el.classList.remove('is-tight-1', 'is-tight-2');
      el.style.zoom = '';
      if (window.innerWidth <= 900) return;
      const room = window.innerHeight - 16 - aside.getBoundingClientRect().top;
      for (const step of ['is-tight-1', 'is-tight-2']) {
        if (el.offsetHeight <= room) return;
        el.classList.remove('is-tight-1');
        el.classList.add(step);
      }
      if (el.offsetHeight > room) el.style.zoom = String(Math.max(0.75, room / el.offsetHeight));
    };
    fit();
    document.fonts?.ready.then(fit);
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <article ref={cardRef} className="glc-card" key={d.sheet} aria-labelledby="glc-card-title">
      <header className="glc-card-head">
        <div>
          <h2 id="glc-card-title">{d.short_name}</h2>
          <p>
            {d.full_name} · {d.state}
          </p>
        </div>
        <button type="button" className="acm-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      <p className="glc-card-value">
        <b>{formatInUnit(row.value, group.unit)}</b>
        <span>
          {axisTitleForUnit(group.unit)} · {fyLabel(year)}
        </span>
      </p>

      <dl className="glc-facts">
        <div>
          <dt>Benchmark</dt>
          <dd>{row.benchmark != null ? formatInUnit(row.benchmark, group.unit) : 'N/A'}</dd>
        </div>
        <div>
          <dt>Verdict</dt>
          <dd>{verdict === 'none' ? 'N/A' : <span className={`mj-chip mj-chip--${verdict}`}>{verdict === 'met' ? 'Met' : 'Not met'}</span>}</dd>
        </div>
      </dl>

      {notes.length > 0 && (
        <ul className="glc-notes">
          {notes.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}

      <Link className="glc-card-link" href={`/state/${slugify(d.state)}`}>
        Open {d.state}
        <svg className="acm-arrow" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M4.5 2.5h5v5M9.5 2.5 3 9" />
        </svg>
      </Link>
    </article>
  );
}

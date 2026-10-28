'use client';

import { useState } from 'react';
import AboutKicker from './AboutKicker';
import {
  COMPARATOR_GROUPS,
  CONTEXT,
  GEOGRAPHIES,
  INDIA_STATES_COVERED,
  INDIA_WEIGHTED,
  LEDE,
  NOTES,
  SAIDI_UNIT,
  SAIFI_UNIT,
  type Geography,
} from '@/lib/international';

/** The International Comparison page (/about/international, reached from the About page): a one-line
 * lede beside India's weighted benchmark, then the working note's SAIDI/SAIFI table drawn as two dot
 * plots sharing one row per geography (one CSS grid, so rows line up by construction), each row tagged
 * with why that comparator was chosen, beside a card with the selected geography's full entry. India
 * is a range of state regulatory benchmarks (an open bar, with its weighted benchmark as a tick);
 * every other row is observed performance (a dot), drawn differently because the note is explicit
 * that they are not like-for-like. Values span six orders of magnitude, so both axes are log scale.
 * Long text (context, notes) sits behind hover, keeping the page to one glance. */

interface Axis {
  min: number;
  max: number;
}
const SAIDI_AXIS: Axis = { min: 0.1, max: 100000 };
const SAIFI_AXIS: Axis = { min: 0.01, max: 1000 };

const pct = (v: number, a: Axis) => ((Math.log10(v) - Math.log10(a.min)) / (Math.log10(a.max) - Math.log10(a.min))) * 100;
const ticks = (a: Axis) => {
  const out: number[] = [];
  for (let e = Math.round(Math.log10(a.min)); e <= Math.round(Math.log10(a.max)); e++) out.push(10 ** e);
  return out;
};
const fmt = (v: number) => v.toLocaleString('en-IN', { maximumFractionDigits: 3 });
// log-axis decades (0.01, 0.1, 1 …) are exact grid values, not reported figures; big ones abbreviated
const fmtTick = (v: number) => (v >= 1000 ? `${v / 1000}k` : v.toLocaleString('en-IN', { maximumFractionDigits: 3 }));

const tagOf = (name: string) => COMPARATOR_GROUPS.find((c) => c.countries.includes(name));

function Plot({ value, axis, kind, mark }: { value: Geography['saidi']; axis: Axis; kind: Geography['kind']; mark?: number }) {
  const grid = ticks(axis).map((t) => <span key={t} className="ic-gridline" style={{ left: `${pct(t, axis)}%` }} />);
  if (value == null) {
    return (
      <span className="ic-plot">
        {grid}
        <span className="ic-na">N/A</span>
      </span>
    );
  }
  if (Array.isArray(value)) {
    const [lo, hi] = value;
    const l = pct(lo, axis);
    const r = pct(hi, axis);
    return (
      <span className="ic-plot">
        {grid}
        <span className="ic-range" style={{ left: `${l}%`, width: `${r - l}%` }} />
        {mark != null && <span className="ic-mark" style={{ left: `${pct(mark, axis)}%` }} />}
        <span className="ic-val ic-val--left" style={{ left: `${l}%` }}>
          {fmt(lo)}–{fmt(hi)}
        </span>
      </span>
    );
  }
  const p = pct(value, axis);
  return (
    <span className="ic-plot">
      {grid}
      <span className={`ic-dot ic-dot--${kind}`} style={{ left: `${p}%` }} />
      <span className={`ic-val${p > 72 ? ' ic-val--left' : ''}`} style={{ left: `${p}%` }}>
        {fmt(value)}
      </span>
    </span>
  );
}

function AxisRow({ axis }: { axis: Axis }) {
  return (
    <span className="ic-axis">
      {ticks(axis).map((t) => (
        <span key={t} style={{ left: `${pct(t, axis)}%` }}>
          {fmtTick(t)}
        </span>
      ))}
    </span>
  );
}

function DetailCard({ g }: { g: Geography }) {
  const why = tagOf(g.name)?.why;
  return (
    <article className="ic-card" key={g.name}>
      <p className="ic-card-status">{g.kind === 'benchmark-range' ? 'Regulatory benchmarks' : 'Observed performance'}</p>
      <h2 className="ic-card-name">{g.name}</h2>
      <dl className="ic-card-figs">
        <div>
          <dt>SAIDI</dt>
          <dd>{g.saidiText}</dd>
        </div>
        <div>
          <dt>SAIFI</dt>
          <dd>{g.saifiText}</dd>
        </div>
      </dl>
      {why && <p className="ic-card-why">{why}</p>}
      <dl className="ic-card-text">
        <dt>Scope</dt>
        <dd>{g.scope}</dd>
        {g.qualifications && (
          <>
            <dt>Caveat</dt>
            <dd>{g.qualifications}</dd>
          </>
        )}
      </dl>
      <p className="ic-card-src">
        {g.source?.href ? (
          <a href={g.source.href} target="_blank" rel="noopener noreferrer">
            {g.source.label}
          </a>
        ) : (
          (g.source?.label ?? 'State regulations and orders')
        )}
        {g.year && <span> · {g.year}</span>}
      </p>
    </article>
  );
}

export default function InternationalView() {
  const [selected, setSelected] = useState(GEOGRAPHIES[0].name);
  const sel = GEOGRAPHIES.find((g) => g.name === selected) ?? GEOGRAPHIES[0];

  return (
    <div className="methodology-page about-page ic">
      <header className="ic-hero">
        <div>
          <AboutKicker here="International comparison" />
          <h1 className="method-hero-title">International Comparison</h1>
          <p className="ic-lede" title={CONTEXT.join('\n\n')}>
            {LEDE}
          </p>
        </div>
        <div className="ic-hero-stat" title={INDIA_WEIGHTED.text}>
          <span className="ic-hero-label">India · weighted benchmark</span>
          <span className="ic-hero-figs">
            <span>
              <b>{INDIA_WEIGHTED.saidi.toLocaleString('en-IN')}</b>
              <small>SAIDI</small>
              <span>min</span>
            </span>
            <span>
              <b>{INDIA_WEIGHTED.saifi}</b>
              <small>SAIFI</small>
              <span>interruptions</span>
            </span>
          </span>
        </div>
      </header>

      <div className="ic-body">
        <div className="ic-chart-wrap">
          <div className="ic-chart">
            <span className="ic-head ic-head--geo" aria-hidden="true" />
            <span className="ic-head">
              <b>SAIDI</b>
              <span>Duration · {SAIDI_UNIT}</span>
            </span>
            <span className="ic-head">
              <b>SAIFI</b>
              <span>Frequency · {SAIFI_UNIT}</span>
            </span>

            {GEOGRAPHIES.map((g) => (
              <button
                key={g.name}
                type="button"
                className={`ic-row${g.name === selected ? ' is-active' : ''}${g.kind === 'benchmark-range' ? ' ic-row--india' : ''}`}
                aria-pressed={g.name === selected}
                aria-label={`${g.name}: SAIDI ${g.saidiText}; SAIFI ${g.saifiText}`}
                onClick={() => setSelected(g.name)}
              >
                <span className="ic-geo">
                  {g.name}
                  <small>{tagOf(g.name)?.tag ?? 'State regulatory benchmarks'}</small>
                </span>
                <Plot value={g.saidi} axis={SAIDI_AXIS} kind={g.kind} mark={g.kind === 'benchmark-range' ? INDIA_WEIGHTED.saidi : undefined} />
                <Plot value={g.saifi} axis={SAIFI_AXIS} kind={g.kind} mark={g.kind === 'benchmark-range' ? INDIA_WEIGHTED.saifi : undefined} />
              </button>
            ))}

            <span aria-hidden="true" />
            <AxisRow axis={SAIDI_AXIS} />
            <AxisRow axis={SAIFI_AXIS} />
          </div>

          <p className="ic-legend">
            <span>
              <i className="ic-key-range" /> India: range of state benchmarks
            </span>
            <span>
              <i className="ic-key-mark" /> Weighted benchmark
            </span>
            <span>
              <i className="ic-key-dot" /> Observed performance
            </span>
            <span>Log scale · lower is better</span>
          </p>
        </div>

        <aside className="ic-aside">
          <DetailCard g={sel} />
        </aside>
      </div>

      <footer className="ic-notes" aria-label="Methodological notes">
        {NOTES.map((n) => (
          <p key={n.head} title={n.body}>
            <b>{n.head}</b>
            {n.short}
          </p>
        ))}
        <p title={INDIA_STATES_COVERED}>
          <b>Coverage</b>
          India&rsquo;s 12 most populous states; the range comes from the seven DISCOMs with numeric benchmarks.
        </p>
      </footer>
    </div>
  );
}

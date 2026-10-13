'use client';

import { useState } from 'react';
import AboutKicker from './AboutKicker';
import { GEOGRAPHIES, INDIA_STATES, NOTES, PURPOSE, SAIDI_UNIT, SAIFI_UNIT, type Geography } from '@/lib/international';

/** The International Comparison page (/about/international, reached from the About page): the
 * working note's SAIDI/SAIFI table drawn as two dot plots sharing one row per geography (one CSS
 * grid, so rows line up by construction), beside a card with the selected geography's full entry.
 * India is a range of state regulatory benchmarks (an open bar); every other row is observed
 * performance (a dot), drawn differently because the note is explicit that they are not
 * like-for-like. The values span four orders of magnitude, so both axes are log scale, and say so. */

interface Axis {
  min: number;
  max: number;
}
const SAIDI_AXIS: Axis = { min: 0.1, max: 10000 };
const SAIFI_AXIS: Axis = { min: 0.01, max: 1000 };

const pct = (v: number, a: Axis) => ((Math.log10(v) - Math.log10(a.min)) / (Math.log10(a.max) - Math.log10(a.min))) * 100;
const ticks = (a: Axis) => {
  const out: number[] = [];
  for (let e = Math.round(Math.log10(a.min)); e <= Math.round(Math.log10(a.max)); e++) out.push(10 ** e);
  return out;
};
const fmt = (v: number) => v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
// log-axis decades (0.01, 0.1, 1 …) are exact grid values, not reported figures, so stay exact
const fmtTick = (v: number) => v.toLocaleString('en-IN', { maximumFractionDigits: 3 });

function Plot({ value, axis, kind }: { value: Geography['saidi']; axis: Axis; kind: Geography['kind'] }) {
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
  return (
    <article className="ic-card" key={g.name}>
      <p className="ic-card-status">{g.status}</p>
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
      <dl className="ic-card-text">
        <dt>Scope / coverage</dt>
        <dd>{g.scope}</dd>
        <dt>Key methodological qualifications</dt>
        <dd>{g.qualifications}</dd>
        <dt>Source</dt>
        <dd>
          {g.source ? (
            <a href={g.source.href} target="_blank" rel="noopener noreferrer">
              {g.source.label}
            </a>
          ) : (
            <a href="#ic-states">State-wise references, below</a>
          )}
        </dd>
      </dl>
    </article>
  );
}

export default function InternationalView() {
  const [selected, setSelected] = useState(GEOGRAPHIES[0].name);
  const sel = GEOGRAPHIES.find((g) => g.name === selected) ?? GEOGRAPHIES[0];

  return (
    <div className="methodology-page about-page ic">
      <AboutKicker here="International comparison" />
      <h1 className="method-hero-title">International Comparison</h1>
      <p className="ic-purpose">{PURPOSE}</p>

      <div className="ic-body">
        <div className="ic-chart-wrap">
          <div className="ic-chart">
            <span className="ic-head ic-head--geo" aria-hidden="true" />
            <span className="ic-head">
              <b>SAIDI</b>
              <span>Average interruption duration · {SAIDI_UNIT}</span>
            </span>
            <span className="ic-head">
              <b>SAIFI</b>
              <span>Average interruption frequency · {SAIFI_UNIT}</span>
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
                <span className="ic-geo">{g.name}</span>
                <Plot value={g.saidi} axis={SAIDI_AXIS} kind={g.kind} />
                <Plot value={g.saifi} axis={SAIFI_AXIS} kind={g.kind} />
              </button>
            ))}

            <span aria-hidden="true" />
            <AxisRow axis={SAIDI_AXIS} />
            <AxisRow axis={SAIFI_AXIS} />
          </div>

          <p className="ic-legend">
            <span>
              <i className="ic-key-range" /> Indian state regulatory benchmarks (range)
            </span>
            <span>
              <i className="ic-key-dot" /> Observed national performance
            </span>
            <span>Log scale · lower is better</span>
          </p>
        </div>

        <aside className="ic-aside">
          <DetailCard g={sel} />
        </aside>
      </div>

      <section className="ic-notes" aria-label="Methodological notes">
        {NOTES.map((n) => (
          <div key={n.head}>
            <h3>{n.head}</h3>
            <p>{n.body}</p>
          </div>
        ))}
      </section>

      <section className="ic-states" id="ic-states" aria-labelledby="ic-states-title">
        <h2 className="ic-states-title" id="ic-states-title">
          India, state by state
        </h2>
        <ul>
          {INDIA_STATES.map((s) => (
            <li key={s.state} className={s.benchmark ? 'has-benchmark' : undefined}>
              <span className="ic-state-name">{s.state}</span>
              {s.href ? (
                <a href={s.href} target="_blank" rel="noopener noreferrer">
                  {s.framework}
                </a>
              ) : (
                <span className="ic-state-fw">{s.framework}</span>
              )}
              <span className="ic-state-bm">{s.benchmark ?? 'No verified numeric benchmark'}</span>
              {s.note && <span className="ic-state-note">{s.note}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

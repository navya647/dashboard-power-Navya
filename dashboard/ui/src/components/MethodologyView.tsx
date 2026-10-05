'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useData } from '@/lib/DataContext';
import { fyLabel } from '@/lib/format';
import { animateScrollTo } from '@/lib/scroll';
import { assessYearOverYear, YOY_META } from '@/lib/trend';
import type { SopIndicator, StateSpecificData } from '@/lib/types';

/** The worked example: one real indicator for one DISCOM, read live off the data so every number
 * on the page is the one the dashboard itself shows. Chosen because its run of years shows the
 * whole method at once — a met year, a missed year (a decline), then a year with no usable figure. */
const EXAMPLE = { discom: 'TGSPDCL', indicator: 'Line Breakdowns' };

const STEPS = [
  { title: 'The standard', body: 'Each state regulator sets Standards of Performance. We record every standard and its benchmark exactly as worded.' },
  { title: 'The reported figure', body: 'What the DISCOM reports for the same indicator, as published — a missing figure is never filled in.' },
  { title: 'The comparability check', body: 'A verdict is given only when the figure and the standard measure the same thing, the same way.' },
  { title: 'The verdict', body: 'Met or Not met against the benchmark — and, separately, how it moved since the year before.' },
];

const COMMITMENTS = [
  { head: 'Never filled in.', body: 'Missing stays N/A — no zeros, no estimates, no bridged gaps.' },
  { head: 'Never inferred.', body: 'No verdict where the figure and the standard measure different things.' },
  { head: 'Always traceable.', body: 'Every standard and figure links back to the document it came from.' },
];

const LIMITS = [
  { head: 'Coverage', body: 'Reported data isn’t yet available for every state, DISCOM or year.' },
  { head: 'Benchmarks', body: 'Not every indicator has a benchmark to assess against.' },
  { head: 'Comparability', body: 'Similar indicator names can differ in definition, unit or period between states.' },
];

const AUTOPLAY_MS = 5000;
/** keys that scroll the page — pressing one hands control back to the reader */
const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ']);

/** Glide so `el` sits comfortably in view — only if it isn't already. */
function reveal(el: HTMLElement | null | undefined) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  if (r.bottom > vh - 32) animateScrollTo(window.scrollY + r.bottom - vh + Math.min(96, vh * 0.12), 800);
  else if (r.top < 72) animateScrollTo(window.scrollY + r.top - 96, 800);
}

interface YearPoint {
  year: string;
  rec: SopIndicator;
}

interface Example {
  state: string;
  discom: string;
  year: string;
  rec: SopIndicator;
  series: YearPoint[];
  contrast: SopIndicator | null;
}

/** The example's focus year is its first assessed-and-missed year; the series is every year of the
 * same indicator, oldest first. null if the record isn't in the data (the walkthrough then hides). */
function findExample(data: StateSpecificData | null): Example | null {
  const d = data?.discoms.find((x) => x.short_name === EXAMPLE.discom);
  if (!d) return null;
  const series: YearPoint[] = Object.keys(d.years)
    .sort()
    .flatMap((year) => {
      const rec = d.years[year].indicators.find((i) => i.indicator === EXAMPLE.indicator);
      return rec ? [{ year, rec }] : [];
    });
  const focus = series.find((p) => p.rec.comparison_possible && p.rec.standard_met === false);
  if (!focus) return null;
  const contrast =
    d.years[focus.year].indicators.find((i) => i.comparison_possible === false && i.reported != null && i.reason_not_comparable) ?? null;
  return { state: d.state, discom: d.short_name, year: focus.year, rec: focus.rec, series, contrast };
}

const show = (v: number | null) => (v == null ? 'N/A' : String(v));

/** The Methodology page: one real figure followed from regulation to verdict (an auto-advancing,
 * clickable walkthrough whose card builds up step by step), then the commitments behind every
 * view, then the limits. */
export default function MethodologyView() {
  const { discoms, stateSpecific } = useData();
  const example = useMemo(() => findExample(stateSpecific), [stateSpecific]);
  const [step, setStep] = useState(0);
  // no auto-advance for reduced motion. Safe to read on first render: the walkthrough (and its
  // timer) only renders once the data has loaded client-side, so there's no server markup to match.
  const [auto, setAuto] = useState(() => typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const layersRef = useRef<(HTMLDivElement | null)[]>([]);
  const stepsRef = useRef<HTMLOListElement>(null);
  const moved = useRef(false); // false until the first step change, so loading the page never scrolls it
  const playing = auto && inView && !!example;

  // autoplay only runs while the walkthrough is on screen
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [example]);

  // the reader scrolling themselves takes over from autoplay — it never fights them
  useEffect(() => {
    if (!auto) return;
    const stop = () => setAuto(false);
    const onKey = (e: KeyboardEvent) => SCROLL_KEYS.has(e.key) && stop();
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchmove', stop, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchmove', stop);
      window.removeEventListener('keydown', onKey);
    };
  }, [auto]);

  // advance one step at a time; after the verdict, carry on to the end of the page (limits) and stop
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => {
      if (step < STEPS.length - 1) {
        moved.current = true;
        setStep(step + 1);
      } else {
        setAuto(false);
        animateScrollTo(document.documentElement.scrollHeight - window.innerHeight, 1600);
      }
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [playing, step]);

  // the page follows the flow: each new layer of the card is brought into view as it lights up
  useEffect(() => {
    if (moved.current) reveal(layersRef.current[step]);
  }, [step]);

  // side by side (desktop), each step starts level with its own layer of the card, so the two
  // columns scroll together: step 1 drops to the first layer, each step is at least as tall as its
  // layer. Measured with offsetTop (layers are translated while ghosted), redone on resize.
  useLayoutEffect(() => {
    const ol = stepsRef.current;
    const card = layersRef.current[0]?.offsetParent as HTMLElement | null;
    if (!ol || !card) return;
    const align = () => {
      const items = [...ol.children] as HTMLElement[];
      const layers = layersRef.current;
      for (const li of items) {
        li.style.marginTop = '';
        li.style.minHeight = '';
      }
      if (window.innerWidth <= 1100 || layers.length < items.length || layers.some((l) => !l)) return;
      const layerTop = (i: number) => card.getBoundingClientRect().top + layers[i]!.offsetTop;
      const lift = layerTop(0) - (ol.getBoundingClientRect().top + items[0].offsetTop);
      if (lift > 0) items[0].style.marginTop = `${lift}px`;
      for (let i = 0; i < items.length - 1; i++) items[i].style.minHeight = `${layerTop(i + 1) - layerTop(i)}px`;
    };
    align();
    document.fonts?.ready.then(align);
    const ro = new ResizeObserver(align);
    ro.observe(card);
    window.addEventListener('resize', align);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', align);
    };
  }, [example]);

  const pick = (i: number) => {
    setAuto(false);
    moved.current = true;
    setStep(i);
  };

  const togglePlay = () => {
    if (auto) return setAuto(false);
    moved.current = true;
    setAuto(true);
    // play from the top if the walkthrough already finished; the step effect brings it into view
    if (step === STEPS.length - 1) setStep(0);
    else reveal(layersRef.current[step]);
  };

  const yearsAsc = discoms ? [...discoms.years].reverse() : [];

  return (
    <div className="methodology-page about-page mth">
      <div className="kicker" style={{ marginTop: 0 }}>
        <span className="bar" />
        <span className="label">Methodology</span>
      </div>
      <h1 className="method-hero-title">How the Evidence Base Was Built</h1>
      {discoms && (
        <p className="mth-meta">
          {discoms.state_order.length} states · {discoms.discoms.length} DISCOMs · {fyLabel(yearsAsc[0])}–{fyLabel(yearsAsc[yearsAsc.length - 1])}
        </p>
      )}

      {example && (
        <section className="mj" ref={sectionRef} aria-label="Follow one figure from regulation to verdict">
          <div className="mj-rail">
            <div className="mj-rail-top">
              <p className="mj-eyebrow">Follow one figure</p>
              <button type="button" className="mj-play" onClick={togglePlay} aria-pressed={auto}>
                {auto ? (
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M5 3.5v9M11 3.5v9" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M5 3.2v9.6L12.5 8z" className="is-fill" />
                  </svg>
                )}
                {auto ? 'Pause' : step === STEPS.length - 1 ? 'Replay' : 'Play'}
              </button>
            </div>
            <h2 className="mj-title">From regulation to verdict</h2>
            <ol className="mj-steps" ref={stepsRef}>
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <button
                    type="button"
                    className={`mj-step${i === step ? ' is-active' : ''}${i < step ? ' is-done' : ''}`}
                    aria-current={i === step ? 'step' : undefined}
                    onClick={() => pick(i)}
                  >
                    <span className="mj-step-num">{i + 1}</span>
                    <span className="mj-step-text">
                      <b>{s.title}</b>
                      <span className="mj-step-body">
                        <span>{s.body}</span>
                      </span>
                    </span>
                    {i === step && playing && <span key={step} className="mj-step-timer" style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />}
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <ExampleCard example={example} step={step} layerRef={(i, el) => (layersRef.current[i] = el)} />
        </section>
      )}

      <section className="mth-commit" aria-label="Commitments">
        {COMMITMENTS.map((c) => (
          <div key={c.head}>
            <p className="mth-commit-head">{c.head}</p>
            <p className="mth-commit-body">{c.body}</p>
          </div>
        ))}
      </section>

      <section className="mth-limits" aria-label="Limits">
        <h2 className="mth-limits-title">Limits</h2>
        <ul className="mth-limits-grid">
          {LIMITS.map((l) => (
            <li key={l.head}>
              <span className="mth-limit-head">{l.head}</span>
              <span className="mth-limit-body">{l.body}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** The evidence card: all four layers are always laid out (so the card never changes height);
 * layers past the current step are ghosted, the current one is lit, earlier ones settle. */
function ExampleCard({ example, step, layerRef }: { example: Example; step: number; layerRef: (i: number, el: HTMLDivElement | null) => void }) {
  const { rec } = example;
  const layer = (i: number) => `mj-layer${i === step ? ' is-active' : i < step ? ' is-done' : ''}`;
  const pct = (v: number | null) => (v == null ? 0 : Math.max(0, Math.min(100, v)));
  const isPercent = (rec.reported_meaning ?? '').trim().startsWith('%');

  const at = example.series.findIndex((p) => p.year === example.year);
  const strip = example.series.slice(Math.max(0, at - 1), at + 2);

  return (
    <div className="mj-card" data-step={step}>
      <header className="mj-card-head">
        <span className="mj-card-where">
          {example.state} · {example.discom} · {fyLabel(example.year)}
        </span>
        <span className="mj-card-name">{rec.indicator}</span>
      </header>

      <div className={layer(0)} ref={(el) => layerRef(0, el)}>
        <span className="mj-k">Standard</span>
        <p className="mj-v">{rec.standard_specified}</p>
        <span className="mj-k">Benchmark</span>
        <p className="mj-v">
          <b>{show(rec.benchmark)}</b> {rec.benchmark_meaning}
        </p>
      </div>

      <div className={layer(1)} ref={(el) => layerRef(1, el)}>
        <span className="mj-k">Reported</span>
        <p className="mj-reported">
          <b>{show(rec.reported)}</b>
          <span>{rec.reported_meaning}</span>
        </p>
      </div>

      <div className={layer(2)} ref={(el) => layerRef(2, el)}>
        <span className="mj-k">Same basis?</span>
        <p className="mj-v">
          <span className={`mj-chip ${rec.comparison_possible ? 'mj-chip--ok' : ''}`}>{rec.comparison_possible ? 'Comparable' : 'Not comparable'}</span>
          Both measure the share of cases resolved within the time limit.
        </p>
        {example.contrast && (
          <p className="mj-aside">
            Elsewhere, same year: <b>{example.contrast.indicator}</b> — not comparable ({example.contrast.reason_not_comparable?.toLowerCase()}), so no
            verdict is given.
          </p>
        )}
      </div>

      <div className={layer(3)} ref={(el) => layerRef(3, el)}>
        <div className="mj-verdict">
          {isPercent && (
            <div className="mj-gauge" aria-hidden="true">
              <span className="mj-gauge-fill" style={{ width: `${pct(rec.reported)}%` }} />
              <span className="mj-gauge-mark" style={{ left: `${pct(rec.benchmark)}%` }}>
                <i>{show(rec.benchmark)}</i>
              </span>
            </div>
          )}
          <span className={`mj-chip mj-chip--${rec.standard_met ? 'met' : 'missed'}`}>{rec.standard_met ? 'Met' : 'Not met'}</span>
        </div>
        <ol className="mj-years">
          {strip.map((p, i) => {
            const prev = example.series[example.series.indexOf(p) - 1];
            const yoy = prev
              ? assessYearOverYear({ value: prev.rec.reported, reportedMeaning: prev.rec.reported_meaning }, { value: p.rec.reported, reportedMeaning: p.rec.reported_meaning })
              : null;
            return (
              <li key={p.year} className={p.year === example.year ? 'is-focus' : undefined}>
                <span className="mj-year">{fyLabel(p.year)}</span>
                <b>{show(p.rec.reported)}</b>
                {yoy ? (
                  <span className={`mj-yoy ${YOY_META[yoy.status].cls}`}>
                    {yoy.arrow !== '○' && <span aria-hidden="true">{yoy.arrow} </span>}
                    {YOY_META[yoy.status].text}
                  </span>
                ) : (
                  <span className="mj-yoy mj-yoy--first">{i === 0 ? 'Starting year' : ''}</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

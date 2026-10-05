'use client';

import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { hexToRgba } from '@/lib/colors';
import { fyLabel } from '@/lib/format';
import { allSame } from '@/lib/evidenceStatus';
import EvidenceRail from './EvidenceRail';
import RegulationBadge from './RegulationBadge';

export interface CardPoint {
  year: string;
  value: number | null;
  benchmark: number | null;
  benchmarkMeaning: string | null;
  reportedMeaning: string | null;
  standardSpecified: string | null;
  comparisonPossible: boolean | null;
  standardMet: boolean | null;
  reasonNotComparable: string | null;
  regulation: string | null;
  /** extraction-time standardisation note (e.g. a figure converted onto its series' annual basis) */
  note?: string | null;
}

export interface CardSeries {
  label: string;
  color: string;
  points: CardPoint[];
}

interface Props {
  title: string;
  typeLabel?: string | null;
  meaning?: string | null;
  measuredAsLabel?: string | null;
  unitSuffix: (v: number) => string;
  yAxisLabel?: string;
  yearsAsc: string[];
  activeYear: string;
  series: CardSeries[];
  animationDelay?: number;
  /** Which half of the card to render — the page renders every indicator twice, once per
   * page-level section ("Regulatory Compliance" then "Year-wise Trends"), rather than once as a
   * single combined card; both halves share every value this component derives below, so the only
   * difference between the two calls is which JSX comes out. 'compliance' = identity, the
   * benchmark/measured-as/standard metadata, and every comparability/regulation advisory. 'trends'
   * = the chart and the year-wise value matrix. */
  section: 'compliance' | 'trends';
}

export interface SeriesBenchmark {
  label: string;
  color: string;
  value: number | null;
  regulator: string | null;
}

/** State Electricity Regulatory Commission short names, keyed by the exact state name used
 * throughout this codebase (discoms2.json's state_order) — the standard abbreviation each
 * commission itself uses, cross-checked against the actual `regulation` citation text each state's
 * source rows carry (e.g. Rajasthan's own citations already read "RERC ("). Not a derived/invented
 * value: every entry names a real, public regulatory body, used only to label an existing
 * benchmark line more specifically than a generic "Benchmark". */
const STATE_REGULATOR_ABBR: Record<string, string> = {
  Maharashtra: 'MERC',
  Gujarat: 'GERC',
  Rajasthan: 'RERC',
  'Madhya Pradesh': 'MPERC',
  Odisha: 'OERC',
  Telangana: 'TSERC',
  Karnataka: 'KERC',
  'Tamil Nadu': 'TNERC',
  Bihar: 'BERC',
  'West Bengal': 'WBERC',
  'Uttar Pradesh': 'UPERC',
  'Andhra Pradesh': 'APERC',
};

/** Matches a state's name (or, for Odisha, its source data's older spelling "Orissa") against a
 * point's own regulation citation text — never guesses a regulator for a row that doesn't
 * literally name one. */
function regulatorFromRegulationText(text: string | null): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [state, abbr] of Object.entries(STATE_REGULATOR_ABBR)) {
    if (lower.includes(state.toLowerCase())) return abbr;
  }
  if (lower.includes('orissa')) return STATE_REGULATOR_ABBR.Odisha;
  if (lower.includes('rerc')) return STATE_REGULATOR_ABBR.Rajasthan;
  return null;
}

/** Most-frequent numeric benchmark among a single series' points that are actually marked
 * comparable — never draws a reference line from a benchmark the sheet itself said couldn't be
 * compared to what's plotted. Scoped to one series (one DISCOM, or on the Compare page one
 * jurisdiction) so a card spanning several can tell whether they genuinely share one benchmark or
 * not, rather than silently pooling every series' benchmarks into one popular-vote number. Exported
 * for the Compare page's single-FY bar card, which needs the exact same per-jurisdiction benchmark
 * logic as this trend card. */
export function perSeriesComparableBenchmarks(series: CardSeries[]): SeriesBenchmark[] {
  return series.map((s) => {
    const counts = new Map<number, number>();
    for (const p of s.points) {
      if (p.comparisonPossible === true && p.benchmark != null && !Number.isNaN(p.benchmark)) {
        counts.set(p.benchmark, (counts.get(p.benchmark) || 0) + 1);
      }
    }
    let best: number | null = null;
    let bestN = -1;
    for (const [v, n] of counts) {
      if (n > bestN) {
        best = v;
        bestN = n;
      }
    }
    const regulator = regulatorFromRegulationText(perSeriesValue(s, (p) => p.regulation));
    return { label: s.label, color: s.color, value: best, regulator };
  });
}

function perSeriesValue<T>(s: CardSeries, pick: (p: CardPoint) => T | null | undefined): T | null {
  for (const p of s.points) {
    const v = pick(p);
    if (v != null && v !== '') return v;
  }
  return null;
}

function firstNonNull<T>(series: CardSeries[], pick: (p: CardPoint) => T | null | undefined): T | null {
  for (const s of series) {
    const v = perSeriesValue(s, pick);
    if (v != null) return v;
  }
  return null;
}

/** Groups per-series values that read identically (e.g. every DISCOM of one state sharing the
 * same regulator-specified standard text) into one entry — so a divergent-standard card shows one
 * lens per distinct standard actually in play, not one per series repeating the same text. */
function groupByText(items: { label: string; value: string | null }[]): { text: string; labels: string[] }[] {
  const order: string[] = [];
  const byText = new Map<string, string[]>();
  for (const { label, value } of items) {
    if (value == null) continue;
    if (!byText.has(value)) {
      byText.set(value, []);
      order.push(value);
    }
    byText.get(value)!.push(label);
  }
  return order.map((text) => ({ text, labels: byText.get(text)! }));
}

/** Compare page series labels read `DISCOM — State` (see `buildMultiDiscomAtoms`) — this collapses
 * a list of them sharing one lens down to `DISCOM1, DISCOM2 — State` instead of repeating the same
 * state name after every DISCOM, only splitting into several `— State` groups when the labels
 * genuinely span more than one state. */
function formatGroupedLabel(labels: string[]): string {
  const order: string[] = [];
  const byState = new Map<string, string[]>();
  for (const l of labels) {
    const sep = l.lastIndexOf(' — ');
    const discom = sep === -1 ? l : l.slice(0, sep);
    const state = sep === -1 ? '' : l.slice(sep + 3);
    if (!byState.has(state)) {
      byState.set(state, []);
      order.push(state);
    }
    byState.get(state)!.push(discom);
  }
  return order.map((state) => (state ? `${byState.get(state)!.join(', ')} — ${state}` : byState.get(state)!.join(', '))).join('; ');
}

interface ComparabilityMessage {
  head: string;
  constantReason: string | null;
  distinctReasons: { years: string; reason: string }[];
}

/** Exactly the same "which years, which reason(s)" computation the not-comparable callout always
 * used — factored out so it can run once (for a shared advisory, when every series happens to
 * agree) or once per series (when they don't), without duplicating the logic itself. Never changes
 * what counts as not-comparable or what reason is shown — purely a presentation-layer reuse. */
function comparabilityMessage(s: CardSeries): ComparabilityMessage | null {
  const notComparablePts = s.points.filter((p) => p.comparisonPossible === false);
  if (!notComparablePts.length) return null;
  const constantReason = allSame(notComparablePts.map((p) => p.reasonNotComparable));
  const distinctReasonTexts = Array.from(new Set(notComparablePts.map((p) => p.reasonNotComparable).filter((r): r is string => !!r && r !== 'N/A')));
  return {
    head:
      notComparablePts.length === s.points.length
        ? 'Not comparable across all years shown'
        : `Not comparable in ${notComparablePts.length} of ${s.points.length} years`,
    constantReason: constantReason && constantReason !== 'N/A' ? constantReason : null,
    distinctReasons:
      constantReason && constantReason !== 'N/A'
        ? []
        : distinctReasonTexts.map((r) => ({
            years: notComparablePts
              .filter((p) => p.reasonNotComparable === r)
              .map((p) => fyLabel(p.year))
              .join(', '),
            reason: r,
          })),
  };
}

/** A signature that's identical for two series only when they're not-comparable in exactly the
 * same years for exactly the same reason(s) — used to detect whether every DISCOM on this card
 * shares one comparability situation (worth saying once) or genuinely differs (worth keeping
 * distinct, per-DISCOM). Never itself changes the comparability classification. */
function comparabilitySignature(s: CardSeries): string {
  const notComparablePts = s.points.filter((p) => p.comparisonPossible === false);
  if (!notComparablePts.length) return '';
  const years = notComparablePts.length === s.points.length ? 'all' : notComparablePts.map((p) => p.year).sort().join(',');
  const reasons = Array.from(new Set(notComparablePts.map((p) => p.reasonNotComparable ?? 'N/A'))).sort().join('|');
  return `${years}::${reasons}`;
}

type ComparabilityVerdict = 'comparable' | 'not-comparable' | 'unavailable';

/** The coarse, card-level comparability verdict the "Regulatory Standards & Compliance" strip
 * shows — distinct from `comparabilityMessage`'s per-year detail (which years, which reason) and
 * from `standardMet` (an actual compliance result, shown separately in the year-wise matrix, never
 * here). Derived strictly from `comparisonPossible`: 'unavailable' when the source never recorded
 * an assessment either way for this series (every point's `comparisonPossible` is null — nothing
 * to report, not the same as a recorded "no"); 'not-comparable' when at least one year was
 * explicitly marked not comparable; 'comparable' only when every recorded assessment says so. */
function seriesComparabilityVerdict(s: CardSeries): ComparabilityVerdict {
  const assessed = s.points.filter((p) => p.comparisonPossible != null);
  if (!assessed.length) return 'unavailable';
  if (assessed.some((p) => p.comparisonPossible === false)) return 'not-comparable';
  return 'comparable';
}

/** Chart.js options are a plain JS object baked in at render time — unlike CSS, they can't pick up
 * a `var(--chart-grid)` change live, so a hardcoded hex here would go stale the moment the theme
 * toggles (ThemeToggle.tsx flips `data-theme` without a page reload). Reading the token via
 * `getComputedStyle` at render time, combined with `useThemeTick` forcing a re-render whenever
 * `data-theme` changes, keeps the chart's grid/axis-title/tooltip colors in sync with the shared
 * dark-theme tokens in tokens.css instead of duplicating light/dark literals here. */
function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function useThemeTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setTick((t) => t + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return tick;
}

function truncated(text: string, max = 130): { short: string; needsMore: boolean } {
  if (text.length <= max) return { short: text, needsMore: false };
  return { short: text.slice(0, max).trimEnd() + '…', needsMore: true };
}

/** The Regulatory Standard column's own qualitative-text presentation — truncated with a
 * view-more toggle for a long, multi-condition standard. No separate label/"·" separator (unlike
 * the metadata lenses this replaced), since the column already carries a "Regulatory Standard"
 * heading of its own; repeating a label here would say the same
 * thing twice. `groupLabel`, when given (a DISCOM/jurisdiction name or group), reads as its own
 * small heading above the text — used only when different DISCOMs on one card have genuinely
 * different standards specified and each needs attributing to whom it applies. */
function StandardText({ text, groupLabel, size = 'lg' }: { text: string; groupLabel?: string; size?: 'lg' | 'sm' }) {
  const [expanded, setExpanded] = useState(false);
  const { short, needsMore } = truncated(text, size === 'lg' ? 200 : 130);
  return (
    <div className={`reg-standard-text reg-standard-text--${size}`}>
      {groupLabel && <span className="reg-standard-text-group">{groupLabel}</span>}
      <span>{expanded ? text : short}</span>
      {needsMore && (
        <button type="button" className="lens-more-btn" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : 'View full standard'}
        </button>
      )}
    </div>
  );
}

/** The core reusable visual unit: compact indicator identity, a dominant time-series chart,
 * inline context lenses, and — per DISCOM/series — a fiscal-year evidence rail with any
 * not-comparable exception and regulatory citation deduplicated across years that share the same
 * value. Hovering/focusing an evidence cell drives the chart's enlarged point and a vertical
 * guide line, connecting "this year" to "this point" without a separate control. */
export default function IndicatorVisualCard({ title, typeLabel, meaning, measuredAsLabel, unitSuffix, yAxisLabel, yearsAsc, activeYear, series, animationDelay, section }: Props) {
  const [hoverYear, setHoverYear] = useState<string | null>(null);
  useThemeTick();
  const gridColor = cssVar('--chart-grid', 'rgba(18,23,42,0.05)');
  const axisTitleColor = cssVar('--chart-axis-title', '#666662');
  const tooltipBg = cssVar('--chart-tooltip-bg', '#1c2127');
  const accent = cssVar('--accent', '#28546f');

  const hasNumeric = series.some((s) => s.points.some((p) => p.value != null));
  // the same fallback EvidenceRail uses per row (hoverYear, else the page's Focus Year) — lifted
  // here too so the matrix's shared year header can highlight the whole active column, not just
  // whichever cell happens to be hovered within one row.
  const displayYear = hoverYear ?? activeYear;

  // A card can span several series that are NOT the same DISCOM (the Compare page merges one
  // series per jurisdiction onto the same card) — never silently pool their benchmarks/standards
  // into one popular-vote value the way a single-jurisdiction card safely can. Only collapse to
  // one shared lens when every series that has a value agrees; otherwise attribute each series'
  // own value to it explicitly, never implying one benchmark/standard applies to all of them.
  const perSeriesBench = perSeriesComparableBenchmarks(series);
  const distinctBenchValues = Array.from(new Set(perSeriesBench.filter((x) => x.value != null).map((x) => x.value)));
  const benchDiverges = series.length > 1 && distinctBenchValues.length > 1;
  const bench = distinctBenchValues.length === 1 ? distinctBenchValues[0] : null;
  const benchmarkMeaning = firstNonNull(series, (p) => p.benchmarkMeaning);
  // A raw benchmark number can exist in the source even when it was never counted as `bench`
  // above (comparisonPossible false/null on every point that has one) — the Regulatory Standard
  // column still shows that recorded number (benchmark *availability* is its own fact), while
  // whether it's usable for comparison is the compliance strip's separate concern below, never
  // conflated here.
  const rawBenchmark = bench ?? (!benchDiverges ? firstNonNull(series, (p) => p.benchmark) : null);
  // when every series agrees on one benchmark value, they're only ever the same regulator too
  // (states never share a commission) — so any series' own regulation citation names it.
  const sharedRegulator = bench != null ? regulatorFromRegulationText(firstNonNull(series, (p) => p.regulation)) : null;

  const perSeriesStandard = series.map((s) => ({ label: s.label, value: perSeriesValue(s, (p) => p.standardSpecified) }));
  const standardShared = allSame(perSeriesStandard.map((x) => x.value));
  const standardDiverges = series.length > 1 && !standardShared && perSeriesStandard.some((x) => x.value != null);

  const reportedMeaning = measuredAsLabel ?? firstNonNull(series, (p) => p.reportedMeaning);

  // one entry per distinct regulation text shared by every series (DISCOM) citing it — grouped
  // once here rather than repeated per series, since the citation doesn't change DISCOM to DISCOM
  // within a state. Per-year variation *within* one DISCOM's own series is a separate, unrelated
  // case handled inline where each series renders (see `distinctRegulations` there).
  const constantRegulations = groupByText(series.map((s) => ({ label: s.label, value: allSame(s.points.map((p) => p.regulation)) })));

  // Whether every series that has ANY not-comparable years shares the exact same situation (same
  // years, same reason) — if so, one shared advisory says it once instead of repeating an
  // identical callout per DISCOM (see CLAUDE.md/spec: consolidate only when genuinely identical,
  // never suppress a real divergence). `allSame` returns null both when there's no shared value
  // and when every series has nothing to report — the emptiness check below tells those apart.
  const comparabilitySignatures = series.map(comparabilitySignature);
  const anyNotComparable = comparabilitySignatures.some((sig) => sig !== '');
  const sharedComparabilitySignature = allSame(comparabilitySignatures);
  const hasSharedAdvisory = anyNotComparable && sharedComparabilitySignature != null && sharedComparabilitySignature !== '';
  const sharedAdvisory = hasSharedAdvisory ? comparabilityMessage(series[0]) : null;

  // The card-level verdict the compliance strip shows — 'null' when series genuinely disagree
  // (one DISCOM comparable, another not), in which case the strip says so plainly instead of
  // picking a side, and the existing per-series exception callouts below it (unaffected by this)
  // carry the real, DISCOM-specific detail.
  const seriesVerdicts = series.map(seriesComparabilityVerdict);
  const sharedVerdict = allSame(seriesVerdicts);

  // point/line color sits on the card's own panel background — matching the ring to it (instead of
  // a fixed cream) keeps the "cutout" look correct in both themes rather than a stray light halo.
  const pointBorder = cssVar('--panel', '#fafaf8');
  const datasets = series.map((s) => ({
    label: s.label,
    data: s.points.map((p) => p.value),
    borderColor: s.color,
    borderWidth: 2.5,
    fill: series.length === 1,
    spanGaps: false,
    tension: 0,
    backgroundColor: hexToRgba(s.color, 0.07),
    pointRadius: s.points.map((p) => (hoverYear && p.year === hoverYear ? 7 : 4)),
    pointHoverRadius: 8,
    pointBackgroundColor: s.color,
    pointBorderColor: pointBorder,
    pointBorderWidth: 2,
  }));

  if (section === 'compliance') {
    return (
      <div className="chart-card visual-card animate-in" style={animationDelay ? { animationDelay: `${animationDelay}ms` } : undefined}>
        <div className="visual-card-identity">
          <div className="visual-card-title-row">
            <h4>{title}</h4>
            {typeLabel && <span className="visual-card-type">{typeLabel}</span>}
          </div>
          {meaning && <div className="visual-card-meaning">{meaning}</div>}
        </div>

        <div className="compliance-columns">
          <div className="compliance-col compliance-col--standard">
            <span className="compliance-col-label">Regulatory Standard</span>
            {benchDiverges ? (
              <div className="reg-standard-list">
                {perSeriesBench
                  .filter((b) => b.value != null)
                  .map((b) => (
                    <div key={b.label} className="reg-standard-item">
                      <span className="reg-standard-item-label">{b.label}</span>
                      <span className="reg-standard-value reg-standard-value--sm">{unitSuffix(b.value as number)}</span>
                    </div>
                  ))}
              </div>
            ) : rawBenchmark != null ? (
              <>
                <span className="reg-standard-value">{unitSuffix(rawBenchmark)}</span>
                {benchmarkMeaning && <span className="reg-standard-sub">{benchmarkMeaning}</span>}
                {standardShared && standardShared !== benchmarkMeaning && <StandardText text={standardShared} size="sm" />}
              </>
            ) : standardDiverges ? (
              <div className="reg-standard-list">
                {groupByText(perSeriesStandard).map((g) => (
                  <StandardText key={g.text} text={g.text} groupLabel={formatGroupedLabel(g.labels)} size="sm" />
                ))}
              </div>
            ) : standardShared ? (
              <StandardText text={standardShared} />
            ) : (
              <span className="reg-standard-empty">No regulatory standard specified for this indicator.</span>
            )}
          </div>

          <div className="compliance-col compliance-col--measure">
            <span className="compliance-col-label">Reported Measure</span>
            {reportedMeaning ? (
              <>
                <span className="reported-measure-text">{reportedMeaning}</span>
                {yAxisLabel && <span className="reg-standard-sub">Unit: {yAxisLabel}</span>}
              </>
            ) : (
              <span className="reg-standard-empty">No reporting definition specified.</span>
            )}
          </div>
        </div>

        {sharedVerdict === 'comparable' && (
          <div className="compliance-strip compliance-strip--comparable">
            <div className="compliance-strip-head">Comparable</div>
            <div className="compliance-strip-text">The reported figures for every year shown can be assessed directly against the regulatory standard above.</div>
          </div>
        )}

        {sharedVerdict === 'not-comparable' && (
          <div className="compliance-strip compliance-strip--not-comparable">
            <div className="compliance-strip-head">
              {sharedAdvisory && sharedAdvisory.head === 'Not comparable across all years shown' ? 'Direct comparison unavailable' : (sharedAdvisory?.head ?? 'Direct comparison unavailable')}
            </div>
            {sharedAdvisory ? (
              sharedAdvisory.constantReason ? (
                <div className="compliance-strip-text">{sharedAdvisory.constantReason}</div>
              ) : (
                sharedAdvisory.distinctReasons.map((r) => (
                  <div key={r.reason} className="compliance-strip-text">
                    <b>{r.years}: </b>
                    {r.reason}
                  </div>
                ))
              )
            ) : (
              // every series agrees on the coarse verdict but disagrees on which years/why — the
              // per-series detail below (never suppressed when `hasSharedAdvisory` is false) says
              // it precisely per DISCOM instead of one, possibly-wrong, shared reason.
              <div className="compliance-strip-text">See per-DISCOM detail below.</div>
            )}
          </div>
        )}

        {sharedVerdict === 'unavailable' && (
          <div className="compliance-strip compliance-strip--unavailable">
            <div className="compliance-strip-head">Assessment unavailable</div>
            <div className="compliance-strip-text">The source data does not record whether the reported figures can be compared against the regulatory standard.</div>
          </div>
        )}

        {sharedVerdict == null && series.length > 1 && (
          <div className="compliance-strip compliance-strip--varies">
            <div className="compliance-strip-head">Comparability varies by DISCOM</div>
            {groupByText(series.map((s, i) => ({ label: s.label, value: seriesVerdicts[i] as string }))).map((g) => (
              <div key={g.text} className="compliance-strip-text">
                <b>{formatGroupedLabel(g.labels)}: </b>
                {g.text === 'comparable' ? 'Comparable' : g.text === 'not-comparable' ? 'Not directly comparable — see below' : 'Assessment unavailable'}
              </div>
            ))}
          </div>
        )}

        {series.map((s) => {
          // only rendered per-series when the comparability situation genuinely diverges between
          // DISCOMs — when it's identical everywhere, `sharedAdvisory` above already said it once.
          // Independent of that: per-year regulation-citation variation within this one DISCOM's
          // own series always renders regardless, since it's an unrelated concern (item 8, not the
          // comparability-warning consolidation in item 5).
          const msg = hasSharedAdvisory ? null : comparabilityMessage(s);
          const seriesRegulation = allSame(s.points.map((p) => p.regulation));
          const distinctRegulations = seriesRegulation ? [] : Array.from(new Set(s.points.map((p) => p.regulation).filter((r): r is string => !!r)));
          if (!msg && distinctRegulations.length === 0) return null;

          return (
            <div key={s.label} className="series-exception">
              {msg && (
                <div className="exception-callout">
                  <div className="exception-callout-head">
                    {series.length > 1 && <span className="exception-callout-label">{s.label}</span>}⚠ {msg.head}
                  </div>
                  {msg.constantReason ? (
                    <div className="exception-callout-text">{msg.constantReason}</div>
                  ) : (
                    msg.distinctReasons.map((r) => (
                      <div key={r.reason} className="exception-callout-text">
                        <b>{r.years}: </b>
                        {r.reason}
                      </div>
                    ))
                  )}
                </div>
              )}
              {distinctRegulations.length > 0 && (
                <div className="regulation-badge-group">
                  {distinctRegulations.map((r, i) => (
                    <RegulationBadge key={i} text={r} label={`${s.label} — regulation variant ${i + 1}`} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {constantRegulations.length > 0 && (
          <div className="visual-card-sources">
            {constantRegulations.map((g) => (
              <RegulationBadge key={g.text} text={g.text} label={series.length > 1 ? `${formatGroupedLabel(g.labels)} — source regulation` : 'Source regulation'} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="chart-card visual-card animate-in" style={animationDelay ? { animationDelay: `${animationDelay}ms` } : undefined}>
      <div className="visual-card-identity">
        <div className="visual-card-title-row">
          <h4>{title}</h4>
          {typeLabel && <span className="visual-card-type">{typeLabel}</span>}
        </div>
        {meaning && <div className="visual-card-meaning">{meaning}</div>}
      </div>

      {!hasNumeric && <div className="no-data-box" style={{ marginTop: 10 }}>No reported performance data available.</div>}
      <div className="visual-card-chart">
        <Line
            data={{ labels: yearsAsc.map((y) => fyLabel(y)), datasets }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: { duration: 700, easing: 'easeOutQuart' },
              interaction: { mode: 'nearest', intersect: false, axis: 'x' },
              plugins: {
                legend: { display: series.length > 1, position: 'bottom', labels: { boxWidth: 9, usePointStyle: true, padding: 14, font: { size: 11.5, weight: 600 } } },
                tooltip: {
                  backgroundColor: tooltipBg,
                  padding: 9,
                  cornerRadius: 7,
                  displayColors: true,
                  callbacks: {
                    label: (c) => c.dataset.label + ': ' + (c.raw == null ? 'no data' : unitSuffix(c.raw as number)) + (series[c.datasetIndex]?.points[c.dataIndex]?.note ? ' *' : ''),
                    afterBody: (items) =>
                      items.map((c) => series[c.datasetIndex]?.points[c.dataIndex]?.note).filter((n): n is string => !!n).map((n) => `* ${n}`),
                  },
                },
                annotation: {
                  annotations: {
                    ...(benchDiverges
                      ? Object.fromEntries(
                          perSeriesBench
                            .filter((b) => b.value != null)
                            .map((b, i) => [
                              `standard-${i}`,
                              {
                                type: 'line' as const,
                                yMin: b.value as number,
                                yMax: b.value as number,
                                borderColor: b.color,
                                borderWidth: 1.5,
                                borderDash: [6, 4],
                                label: {
                                  display: true,
                                  content: `${b.regulator ? `${b.regulator} — ` : ''}${b.label}: ${unitSuffix(b.value as number)}`,
                                  position: 'start' as const,
                                  backgroundColor: b.color,
                                  color: '#fff',
                                  font: { size: 9.5, weight: 600 },
                                  padding: { x: 5, y: 2 },
                                  borderRadius: 3,
                                },
                              },
                            ])
                        )
                      : bench != null
                        ? {
                            standard: {
                              type: 'line' as const,
                              yMin: bench,
                              yMax: bench,
                              borderColor: '#b1441c',
                              borderWidth: 1.5,
                              borderDash: [6, 4],
                              label: {
                                display: true,
                                content: (sharedRegulator ? `${sharedRegulator} benchmark` : 'Benchmark') + ': ' + unitSuffix(bench),
                                position: 'start' as const,
                                backgroundColor: '#b1441c',
                                color: '#fff',
                                font: { size: 9.5, weight: 600 },
                                padding: { x: 5, y: 2 },
                                borderRadius: 3,
                              },
                            },
                          }
                        : {}),
                    ...(hoverYear
                      ? {
                          focus: {
                            type: 'line' as const,
                            xMin: fyLabel(hoverYear),
                            xMax: fyLabel(hoverYear),
                            borderColor: hexToRgba(accent.startsWith('#') ? accent : '#28546f', 0.35),
                            borderWidth: 1.5,
                            borderDash: [3, 3],
                          },
                        }
                      : {}),
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  grid: { color: gridColor },
                  ticks: { font: { size: 10.5 }, maxTicksLimit: 5 },
                  title: yAxisLabel ? { display: true, text: yAxisLabel, font: { size: 10, weight: 600 }, color: axisTitleColor } : undefined,
                },
                x: { grid: { display: false }, ticks: { font: { size: 10.5 } } },
              },
            }}
        />
      </div>

      <div className="indicator-matrix-head">
        <span className="indicator-matrix-title">Year-wise reported values</span>
        <span className="trend-legend-hint" title="↑/↓ show the raw year-on-year change; the colour (green = improved, red = declined) accounts for whether higher or lower is better for this specific indicator. Hover any value for the exact comparison.">
          Trend key ⓘ
        </span>
      </div>

      <div className="indicator-matrix-wrap">
        <table className="indicator-matrix">
          <thead>
            <tr>
              <th scope="col" className="matrix-row-head" />
              {yearsAsc.map((y) => (
                <th key={y} scope="col" className={y === displayYear ? 'active' : undefined}>
                  {fyLabel(y)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <EvidenceRail key={s.label} points={s.points} unitSuffix={unitSuffix} seriesLabel={s.label} color={s.color} hoverYear={hoverYear} focusYear={activeYear} onHoverYear={setHoverYear} />
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}

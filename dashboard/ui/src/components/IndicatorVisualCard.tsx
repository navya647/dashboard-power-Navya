'use client';

import { useState } from 'react';
import { Line } from 'react-chartjs-2';
import { hexToRgba } from '@/lib/colors';
import { fyLabel } from '@/lib/format';
import { allSame } from '@/lib/evidenceStatus';
import ContextLens from './ContextLens';
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

/** A plotted-but-not-comparable benchmark reads as generic "N/A" no matter which of three very
 * different situations produced it — distinguish them from the fields already extracted, without
 * inventing anything the source didn't say. */
function benchmarkLensValue(series: CardSeries[], bench: number | null, unitSuffix: (v: number) => string): string {
  if (bench != null) return unitSuffix(bench);
  const anyRawBenchmark = series.some((s) => s.points.some((p) => p.benchmark != null));
  const anyNotComparable = series.some((s) => s.points.some((p) => p.comparisonPossible === false));
  if (anyRawBenchmark && anyNotComparable) return 'Not directly comparable';
  if (!anyRawBenchmark) return 'No benchmark specified';
  return 'N/A';
}

function truncated(text: string, max = 130): { short: string; needsMore: boolean } {
  if (text.length <= max) return { short: text, needsMore: false };
  return { short: text.slice(0, max).trimEnd() + '…', needsMore: true };
}

function StandardLens({ text, label = 'Standard' }: { text: string; label?: string }) {
  const [expanded, setExpanded] = useState(false);
  const { short, needsMore } = truncated(text);
  return (
    <ContextLens
      label={label}
      value={<span>{expanded ? text : short}</span>}
      sub={
        needsMore && (
          <button type="button" className="lens-more-btn" onClick={() => setExpanded((e) => !e)}>
            {expanded ? 'Show less' : 'View full standard'}
          </button>
        )
      }
    />
  );
}

/** The core reusable visual unit: compact indicator identity, a dominant time-series chart,
 * inline context lenses, and — per DISCOM/series — a fiscal-year evidence rail with any
 * not-comparable exception and regulatory citation deduplicated across years that share the same
 * value. Hovering/focusing an evidence cell drives the chart's enlarged point and a vertical
 * guide line, connecting "this year" to "this point" without a separate control. */
export default function IndicatorVisualCard({ title, typeLabel, meaning, measuredAsLabel, unitSuffix, yAxisLabel, yearsAsc, activeYear, series, animationDelay }: Props) {
  const [hoverYear, setHoverYear] = useState<string | null>(null);

  const hasNumeric = series.some((s) => s.points.some((p) => p.value != null));

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
  const benchmarkValueText = benchmarkLensValue(series, bench, unitSuffix);
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

  const datasets = series.map((s) => ({
    label: s.label,
    data: s.points.map((p) => p.value),
    borderColor: s.color,
    borderWidth: 2,
    fill: series.length === 1,
    spanGaps: false,
    tension: 0,
    backgroundColor: hexToRgba(s.color, 0.07),
    pointRadius: s.points.map((p) => (hoverYear && p.year === hoverYear ? 6 : 3)),
    pointHoverRadius: 7,
    pointBackgroundColor: s.color,
    pointBorderColor: '#faf8f3',
    pointBorderWidth: 1.5,
  }));

  return (
    <div className="chart-card visual-card animate-in" style={animationDelay ? { animationDelay: `${animationDelay}ms` } : undefined}>
      <div className="visual-card-identity">
        <div className="visual-card-title-row">
          <h4>{title}</h4>
          {typeLabel && <span className="visual-card-type">{typeLabel}</span>}
        </div>
        {meaning && <div className="visual-card-meaning">{meaning}</div>}
      </div>

      <div className="context-lens-row">
        {benchDiverges ? (
          perSeriesBench
            .filter((b) => b.value != null)
            .map((b) => <ContextLens key={b.label} label={`${b.label} benchmark`} value={unitSuffix(b.value as number)} />)
        ) : (
          <ContextLens label="Benchmark" value={benchmarkValueText} sub={benchmarkMeaning} />
        )}
        {reportedMeaning && <ContextLens label="Measured as" value={reportedMeaning} />}
        {standardDiverges
          ? groupByText(perSeriesStandard).map((g) => <StandardLens key={g.text} text={g.text} label={`${formatGroupedLabel(g.labels)} — Standard`} />)
          : standardShared && <StandardLens text={standardShared} />}
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
                legend: { display: series.length > 1, position: 'bottom', labels: { boxWidth: 8, usePointStyle: true, padding: 10, font: { size: 10.5 } } },
                tooltip: {
                  backgroundColor: '#1c2127',
                  padding: 9,
                  cornerRadius: 7,
                  displayColors: true,
                  callbacks: { label: (c) => c.dataset.label + ': ' + (c.raw == null ? 'no data' : unitSuffix(c.raw as number)) },
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
                            borderColor: 'rgba(59,95,224,0.35)',
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
                  grid: { color: 'rgba(18,23,42,0.05)' },
                  ticks: { font: { size: 10.5 } },
                  title: yAxisLabel ? { display: true, text: yAxisLabel, font: { size: 10, weight: 600 }, color: '#8a93a3' } : undefined,
                },
                x: { grid: { display: false }, ticks: { font: { size: 10.5 } } },
              },
            }}
        />
      </div>

      {series.map((s) => {
        const notComparablePts = s.points.filter((p) => p.comparisonPossible === false);
        const constantReason = notComparablePts.length ? allSame(notComparablePts.map((p) => p.reasonNotComparable)) : null;
        const distinctReasons = Array.from(new Set(notComparablePts.map((p) => p.reasonNotComparable).filter((r): r is string => !!r && r !== 'N/A')));
        const seriesRegulation = allSame(s.points.map((p) => p.regulation));
        // per-YEAR regulation-citation variation within this one DISCOM's own series — unlike the
        // constant case below (pulled out and deduped across DISCOMs), this is inherently specific
        // to this one series and stays rendered right under its own evidence rail.
        const distinctRegulations = seriesRegulation ? [] : Array.from(new Set(s.points.map((p) => p.regulation).filter((r): r is string => !!r)));

        return (
          <div key={s.label} className="series-block">
            <EvidenceRail
              yearsAsc={yearsAsc}
              points={s.points}
              unitSuffix={unitSuffix}
              seriesLabel={series.length > 1 ? s.label : undefined}
              color={series.length > 1 ? s.color : undefined}
              hoverYear={hoverYear}
              focusYear={activeYear}
              onHoverYear={setHoverYear}
            />

            {notComparablePts.length > 0 && (
              <div className="exception-callout">
                <div className="exception-callout-head">
                  {notComparablePts.length === s.points.length
                    ? '⚠ Not comparable across all years shown'
                    : `⚠ Not comparable in ${notComparablePts.length} of ${s.points.length} years`}
                </div>
                {constantReason && constantReason !== 'N/A' ? (
                  <div className="exception-callout-text">{constantReason}</div>
                ) : (
                  distinctReasons.map((r) => (
                    <div key={r} className="exception-callout-text">
                      <b>{notComparablePts.filter((p) => p.reasonNotComparable === r).map((p) => fyLabel(p.year)).join(', ')}: </b>
                      {r}
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
        <div className="regulation-badge-group">
          {constantRegulations.map((g) => (
            <RegulationBadge key={g.text} text={g.text} label={series.length > 1 ? `${formatGroupedLabel(g.labels)} — source regulation` : 'Source regulation'} />
          ))}
        </div>
      )}
    </div>
  );
}

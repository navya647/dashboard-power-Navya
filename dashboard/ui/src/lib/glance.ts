import type { Discom, DiscomsData } from './types';
import type { CardSeries } from './indicatorContext';
import { benchmarkLine } from './benchmarkLine';
import { directionForMeaning, type Direction } from './indicatorDirection';
import { displayUnitForMeaning, type DisplayUnit } from './indicatorUnits';

/** The At a glance page: one reliability indicator, one year, every DISCOM's reported figure side
 * by side. Nothing is computed beyond sorting — each bar is a figure exactly as reported, each
 * benchmark the one the state page draws (`benchmarkLine`), each verdict the source's own
 * `standard_met`. Figures only share a chart when they share a display unit AND a direction
 * (`indicatorUnits.ts`, `indicatorDirection.ts`): the same canonical indicator is reported on
 * different bases by different states (Transformer Failure: Gujarat's % failure rate vs. everyone
 * else's % replaced in time), and those are never put on one axis or ranked together. */

export interface GlanceRow {
  discom: Discom;
  value: number;
  /** the record's own source wording of what the figure measures */
  meaning: string | null;
  /** the state's benchmark on this chart's scale, or null where there is none to draw */
  benchmark: number | null;
  benchmarkNote: string | null;
  standardMet: boolean | null;
  reasonNotComparable: string | null;
  note: string | null;
  /** this figure's own wording, only where it differs from the chart's title (the most common
   * wording on the chart) — e.g. HT vs EHT/LT cases, a 30-day vs the usual time standard */
  ownWording: string | null;
}

export interface GlanceGroup {
  key: string;
  unit: DisplayUnit | null;
  direction: Direction;
  /** the most common source wording among the group's figures */
  wording: string | null;
  rows: GlanceRow[];
  /** right end of the bars' scale, and the axis's labelled gridlines (0 … scaleMax) */
  scaleMax: number;
  ticks: number[];
}

export interface Glance {
  groups: GlanceGroup[];
}

const hasFigure = (d: Discom, indicator: string, year: string) => typeof d.years[year]?.indicators[indicator]?.value === 'number';

/** Indicators with enough reported figures in some year for a side-by-side view to say anything
 * (Harmonics has one or two a year). */
export function glanceIndicators(data: DiscomsData, minFigures = 3): string[] {
  return data.canonical_order.filter((ind) => data.years.some((y) => data.discoms.filter((d) => hasFigure(d, ind, y)).length >= minFigures));
}

/** Years (newest first, as in the data) with at least one reported figure for the indicator. */
export function glanceYears(data: DiscomsData, indicator: string): string[] {
  return data.years.filter((y) => data.discoms.some((d) => hasFigure(d, indicator, y)));
}

function mostCommon(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let n = 0;
  for (const [k, c] of counts) if (c > n) [best, n] = [k, c];
  return best;
}

/** A tidy right end for the scale: 100 for a percentage that fits in it, else the largest figure or
 * benchmark rounded up to a 1/2/2.5/5 step, so no bar runs to the very edge by accident. */
/** The chart's axis: round tick values from 0, the last one at or just past the largest figure or
 * benchmark, so the scale ends on a labelled gridline. 0–100 for a percentage that fits in it. */
function niceScale(max: number, unit: DisplayUnit | null): { scaleMax: number; ticks: number[] } {
  if (unit?.format === 'percent' && max <= 100) return { scaleMax: 100, ticks: [0, 25, 50, 75, 100] };
  if (max <= 0) return { scaleMax: 1, ticks: [0, 1] };
  // the smallest round step that covers the range in at most 5 intervals
  const p = 10 ** Math.floor(Math.log10(max / 5));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * p).find((s) => Math.ceil(max / s) <= 5) ?? 10 * p;
  const scaleMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= scaleMax + step / 2; t += step) ticks.push(Number(t.toPrecision(12)));
  return { scaleMax, ticks };
}

export function buildGlance(data: DiscomsData, indicator: string, year: string): Glance {
  const reported = data.discoms.filter((d) => hasFigure(d, indicator, year));

  const byKey = new Map<string, { unit: DisplayUnit | null; direction: Direction; discoms: Discom[] }>();
  for (const d of reported) {
    const meaning = d.years[year].indicators[indicator].reported_meaning;
    const unit = displayUnitForMeaning(meaning);
    const direction = directionForMeaning(meaning);
    const key = `${unit?.label ?? 'unstated'}|${direction}`;
    if (!byKey.has(key)) byKey.set(key, { unit, direction, discoms: [] });
    byKey.get(key)!.discoms.push(d);
  }

  const groups: GlanceGroup[] = [];
  for (const [key, g] of byKey) {
    // benchmarks are set per state, so each state's is resolved once, from its own DISCOMs on this
    // chart, exactly as the state page's benchmark line does
    const benchByState = new Map<string, { value: number | null; note: string | null }>();
    for (const state of new Set(g.discoms.map((d) => d.state))) {
      const series: CardSeries[] = g.discoms
        .filter((d) => d.state === state)
        .map((d) => {
          const ind = d.years[year].indicators[indicator];
          const num = ind.benchmark != null && !Number.isNaN(parseFloat(ind.benchmark)) ? parseFloat(ind.benchmark) : null;
          return {
            label: d.short_name,
            color: '',
            points: [
              {
                year,
                value: ind.value,
                benchmark: num,
                benchmarkMeaning: ind.benchmark_meaning,
                reportedMeaning: ind.reported_meaning,
                standardSpecified: ind.standard_specified,
                comparisonPossible: ind.comparison_possible,
                standardMet: ind.standard_met,
                reasonNotComparable: ind.reason_not_comparable,
                regulation: d.years[year].regulation || null,
                benchmarkRaw: ind.benchmark == null ? null : String(ind.benchmark),
              },
            ],
          };
        });
      const line = benchmarkLine(series, [year], g.unit);
      benchByState.set(state, { value: line.values[0], note: line.values[0] != null ? line.note : null });
    }

    const wordings = new Map<string, number>();
    const rows: GlanceRow[] = g.discoms.map((d) => {
      const ind = d.years[year].indicators[indicator];
      const wording = ind.reported_meaning?.trim().replace(/\.+$/, '') ?? null;
      if (wording) wordings.set(wording, (wordings.get(wording) ?? 0) + 1);
      const b = benchByState.get(d.state)!;
      return {
        discom: d,
        value: ind.value as number,
        meaning: ind.reported_meaning,
        benchmark: b.value,
        benchmarkNote: b.note,
        standardMet: ind.standard_met,
        reasonNotComparable: ind.reason_not_comparable,
        note: ind.unit_note,
        ownWording: null,
      };
    });
    // a state's DISCOMs stay together: states ordered by their largest figure (ties keep the
    // dashboard's state order), then each state's DISCOMs largest first
    const stateMax = new Map<string, number>();
    for (const r of rows) stateMax.set(r.discom.state, Math.max(stateMax.get(r.discom.state) ?? -Infinity, r.value));
    const stateIdx = (s: string) => data.state_order.indexOf(s);
    rows.sort(
      (a, b) =>
        stateMax.get(b.discom.state)! - stateMax.get(a.discom.state)! ||
        stateIdx(a.discom.state) - stateIdx(b.discom.state) ||
        b.value - a.value,
    );

    const max = Math.max(...rows.map((r) => r.value), ...rows.map((r) => r.benchmark ?? 0));
    const wording = mostCommon(wordings);
    // a figure worded differently from the chart's title keeps its own wording, shown beside it
    const same = (t: string | null) => (t ?? '').trim().replace(/\s+/g, ' ').replace(/\.+$/, '').toLowerCase();
    for (const r of rows) if (wording && r.meaning && same(r.meaning) !== same(wording)) r.ownWording = r.meaning.trim().replace(/\.+$/, '');
    groups.push({ key, unit: g.unit, direction: g.direction, wording, rows, ...niceScale(max, g.unit) });
  }
  // the chart most DISCOMs share comes first
  groups.sort((a, b) => b.rows.length - a.rows.length);
  return { groups };
}

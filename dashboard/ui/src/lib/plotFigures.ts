import type { MasterRow } from './types';
import { headlineFigure } from './headlineFigure';

/** Chart figures and benchmark lines read out of the master sheet's sentences, for every state
 * (user, 28 Oct 2026: "you need to pull numbers out of the sentences"; first trialled on Rajasthan
 * alone). The page always shows the cells as written; these numbers only position points and
 * lines on the chart.
 *
 * Figure: a plain-number cell as is, otherwise the headline number the row's text states
 * (lib/headlineFigure: "FY within-time share: 99.10%." → 99.10 %, "FY SAIDI: 1,311 minutes per
 * consumer." → 1311 minutes per consumer). Rows with an unclear unit or a part year give none.
 *
 * Benchmark (same row's `standard`):
 *  - a % figure: the "at least N% of cases / of feeders / within" share in the standard → N.
 *  - SAIDI/SAIFI per consumer: a limit the standard sets per year ("Not more than 90 hours per
 *    consumer per year"; hours shown in minutes where the figure is). A per-quarter or per-month
 *    limit is never annualised (user, 28 Oct 2026): it gets no line on an annual chart, and Quick
 *    comparison compares it with the quarter's own figure instead (quarterFigures, standardLimit).
 *  - anything else: no line. */

export type PlotUnit = string;

const SHARE = /(?:at least\s+)?([\d.]+)\s*%\s+(?:of (?:the )?(?:cases|feeders|feeder|complaints|consumers)|within)/i;
// a standard that is one annual % limit and nothing else: "Not more than 0.1% of bills issued.",
// "Shall not exceed 3% per annum.", "Not less than 95%"; never two-value or dated ("From 14 Oct 2022: …")
const SHARE_LIMIT = /^\s*(?:not (?:more|greater|less) than|no more than|shall not exceed|at least|maximum of|minimum of)\s+([\d.]+)\s*%(?![^.;]*\d\s*%)[^;]*$/i;
const PER_QUARTER = /\b(per quarter|quarterly|per month|monthly)\b/i;
// "Not more than 15 hours per consumer per quarter", "Not more than 90 hours per consumer per year",
// "Monthly limit of 600 minutes per consumer"
const LIMIT = /(?:no[t]? more than|limit of)\s+([\d,]+(?:\.\d+)?)\s+(hours|minutes|interruptions) per consumer(?:\s+per\s+(year|quarter|month))?/i;

export interface PlotFigure {
  value: number;
  /** the parsed unit; null when the value came from a plain-number cell (the sheet's own `unit` applies) */
  unit: PlotUnit | null;
  /** the figure exactly as the sheet writes it ("99.10%", "1,311"), for labels */
  text: string;
}

/** The number this row contributes to a chart, or null if it has none. */
export function plotFigure(r: MasterRow): PlotFigure | null {
  // a plain "100.00%" cell is in the same unit as a "share: 99.5%" sentence, so the two can share a chart
  if (r.standardised_num != null)
    return { value: r.standardised_num, unit: /%\s*$/.test(r.standardised_data ?? '') ? '%' : null, text: r.standardised_data ?? String(r.standardised_num) };
  const h = headlineFigure(r);
  return h ? { value: h.value, unit: h.unit, text: h.text } : null;
}

export interface PlotBenchmark {
  value: number;
  /** written on the line itself */
  label: string;
}

const num = (v: number) => v.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** The limit a SAIDI/SAIFI standard sets per consumer, in its own period, never rescaled to
 * another (user, 28 Oct 2026: "never annualise the benchmarks"). Hours become minutes where the
 * figure is in minutes; that is a unit, not a period. null when the standard sets no such limit. */
export function standardLimit(r: MasterRow, figUnit: string): { value: number; period: 'year' | 'quarter' | 'month' } | null {
  if (!r.standard) return null;
  const q = LIMIT.exec(r.standard);
  if (!q) return null;
  const period = (q[3] ?? (/monthly/i.test(r.standard) ? 'month' : /quarterly/i.test(r.standard) ? 'quarter' : '')).toLowerCase();
  if (period !== 'year' && period !== 'quarter' && period !== 'month') return null;
  const limit = Number(q[1].replace(/,/g, ''));
  const what = q[2].toLowerCase();
  if (figUnit === 'minutes per consumer' && (what === 'hours' || what === 'minutes')) return { value: limit * (what === 'hours' ? 60 : 1), period };
  if (figUnit === 'interruptions per consumer' && what === 'interruptions') return { value: limit, period };
  return null;
}

/** The four quarter figures a row's reported data lists ("Q1 327.6; Q2 336.6; Q3 315; Q4 312.6",
 * "Q1 91.76%; …"), null for a quarter it doesn't give; null when it lists none. */
export function quarterFigures(r: MasterRow): (number | null)[] | null {
  const t = r.reported_data;
  if (!t) return null;
  const out: (number | null)[] = [null, null, null, null];
  for (const m of t.matchAll(/\bQ([1-4])\b\s*:?\s*([\d,]+(?:\.\d+)?)/g)) out[Number(m[1]) - 1] ??= Number(m[2].replace(/,/g, ''));
  return out.some((v) => v != null) ? out : null;
}

/** The benchmark line for this row's annual figure, or null when the standard gives none in the
 * figure's own terms and period: a share ("at least 95% of cases"), or a SAIDI/SAIFI limit the
 * standard sets per year. A per-quarter or per-month limit is never scaled up to a year. */
export function plotBenchmark(r: MasterRow, fig: PlotFigure | null): PlotBenchmark | null {
  if (!fig?.unit || !r.standard) return null;
  if (fig.unit === '%') {
    const m = SHARE.exec(r.standard) ?? (PER_QUARTER.test(r.standard) ? null : SHARE_LIMIT.exec(r.standard));
    return m ? { value: Number(m[1]), label: `${num(Number(m[1]))}%` } : null;
  }
  const l = standardLimit(r, fig.unit);
  if (!l || l.period !== 'year') return null;
  return { value: l.value, label: `${num(l.value)} ${fig.unit} per year` };
}

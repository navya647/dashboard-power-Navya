import type { MasterRow } from './types';
import { quarterVerdicts } from './master';
import { plotBenchmark, plotFigure, quarterFigures, standardLimit } from './plotFigures';

/** Quick comparison (/glance), rebuilt 29 Oct 2026 from the user-approved shortlist: six indicators,
 * 5–8 DISCOMs each from Rajasthan, Gujarat, Maharashtra, Odisha and Telangana, all five FYs.
 * Every figure is the one the sheet states, in the period it was reported for (never annualised,
 * averaged or estimated). A record is annual, or quarterly when the sheet assesses it by quarter
 * or holds it to a per-quarter limit. Records only share a chart when they share a measurement
 * basis (unit) and period. A verdict is shown only where the row has a numerical benchmark in the
 * same unit and period, and then it is the sheet's own Yes/No; otherwise "No verdict". */

export type Period = 'annual' | 'quarterly';
export type Verdict = 'met' | 'missed' | 'none';

export interface QcIndicator {
  family: string;
  label: string;
  /** the approved DISCOMs, in display order */
  discoms: string[];
  keep: (r: MasterRow) => boolean;
}

const RJ = ['AVVNL', 'JVVNL', 'JdVVNL'];
const OD = ['TPCODL', 'TPNODL', 'TPSODL', 'TPWODL'];

// Highest confidence only (user, 29 Oct 2026): a figure is kept only where the DISCOM's own return
// states it for that period. Left out: annual SAIDI/SAIFI the sheet summed from monthly or
// quarterly values or combined across feeder categories (Gujarat, MSEDCL, TGSPDCL); shares the
// sheet computed from complaint counts (TGSPDCL); series whose definition changes between years
// (UGVCL); MSEDCL's time-limit shares; JVVNL/JdVVNL transformer figures, which include power
// transformers; TPSODL's "Individual standard" rows (repeat its "Overall" ones); TGNPDCL's
// cities/rural rows where its "Overall" row carries the benchmark.
const overall = (r: MasterRow) => !/Individual standard/i.test(r.indicator) && (r.discom_code !== 'TGNPDCL' || /Overall/i.test(r.indicator));
const notAgri = (r: MasterRow) => !/agricultur/i.test(r.indicator);

export const QC_INDICATORS: QcIndicator[] = [
  { family: 'SAIDI', label: 'SAIDI', discoms: [...RJ, ...OD], keep: notAgri },
  { family: 'SAIFI', label: 'SAIFI', discoms: [...RJ, ...OD], keep: notAgri },
  { family: 'Distribution transformer failure - replacement & restoration', label: 'Transformer Failure', discoms: ['AVVNL', ...OD, 'TGNPDCL'], keep: overall },
  { family: 'Overhead line/cable breakdown restoration', label: 'Line Breakdown', discoms: [...RJ, ...OD, 'TGNPDCL'], keep: overall },
  { family: 'Restoration after LT-side DT fuse / consumer-end fault', label: 'Transformer Fuse', discoms: [...OD, 'TGNPDCL'], keep: overall },
  { family: 'Reconnection after payment of dues', label: 'Reconnection', discoms: [...RJ, 'TGNPDCL'], keep: () => true },
];

export const QC_YEARS = ['2021-22', '2022-23', '2023-24', '2024-25', '2025-26'];

/** the unit the row's figures are in: its year figure's, else what its quarter list says */
function basisOf(r: MasterRow): string | null {
  const u = plotFigure(r)?.unit;
  if (u) return u;
  const t = r.reported_data ?? '';
  return /\d\s*%/.test(t) ? '%' : /minutes per consumer/i.test(t) ? 'minutes per consumer' : /interruptions per consumer/i.test(t) ? 'interruptions per consumer' : null;
}

function periodOf(r: MasterRow): Period | null {
  const u = basisOf(r);
  if (!u) return null;
  if (quarterFigures(r) && (quarterVerdicts(r) != null || standardLimit(r, u)?.period === 'quarter')) return 'quarterly';
  return plotFigure(r)?.unit ? 'annual' : null;
}

/** the feeder / consumer category a row is reported for, from its own indicator name */
function categoryOf(r: MasterRow): string {
  const t = r.indicator;
  if (/excluding agricultur/i.test(t)) return 'Excl. agricultural feeders';
  if (/All feeder/i.test(t)) return 'All feeders';
  if (/Urban/i.test(t)) return 'Urban';
  if (/Rural/i.test(t)) return 'Rural';
  if (/Cities and towns/i.test(t)) return 'Cities & towns';
  if (/Overall/i.test(t)) return 'Overall';
  return '';
}

export interface QcRecord {
  id: string;
  state: string;
  code: string;
  name: string;
  /** the row's own indicator name, verbatim */
  indicator: string;
  category: string;
  fy: string;
  period: Period;
  /** quarter index 0–3 for quarterly records */
  quarter: number | null;
  basis: string;
  value: number;
  /** the sheet's own wording the figure is read from */
  source: string;
  standard: string | null;
  benchmark: number | null;
  verdict: Verdict;
  /** one line of a chart: DISCOM + category + basis + period, the same across years */
  series: string;
  /** the time limit as the sheet words it: the row's own standard when it states one, else the
   * standards of the same DISCOM-year's area rows (e.g. TGNPDCL "Overall" → cities / rural) */
  timeLimits: { area: string; text: string }[];
}

const yesNo = (v: string | null | undefined): Verdict => {
  const t = (v ?? '').trim().toLowerCase();
  return t === 'yes' ? 'met' : t === 'no' ? 'missed' : 'none';
};

/** every approved record of one indicator, all years, annual and per-quarter */
export function qcRecords(rows: MasterRow[], ind: QcIndicator): QcRecord[] {
  const out: QcRecord[] = [];
  for (const r of rows) {
    if (r.indicator_family !== ind.family || !ind.discoms.includes(r.discom_code) || !ind.keep(r)) continue;
    const basis = basisOf(r);
    const period = periodOf(r);
    if (!basis || !period) continue;
    const category = categoryOf(r);
    const base = {
      state: r.state,
      code: r.discom_code,
      name: r.discom_name,
      indicator: r.indicator,
      category,
      fy: r.financial_year,
      period,
      basis,
      standard: r.standard,
      timeLimits: timeLimitsOf(r, rows),
      series: `${r.discom_code}|${category}|${basis}|${period}`,
    };
    if (period === 'annual') {
      const fig = plotFigure(r)!;
      const benchmark = plotBenchmark(r, fig)?.value ?? null;
      out.push({
        ...base,
        id: r.id,
        quarter: null,
        value: fig.value,
        source: r.standardised_data ?? r.reported_data ?? '',
        benchmark,
        verdict: benchmark == null ? 'none' : yesNo(r.standard_met),
      });
    } else {
      const qs = quarterFigures(r)!;
      const qv = quarterVerdicts(r);
      qs.forEach((value, q) => {
        if (value == null) return;
        const benchmark = basis === '%' ? (plotBenchmark(r, { value, unit: '%', text: '' })?.value ?? null) : standardLimit(r, basis)?.period === 'quarter' ? standardLimit(r, basis)!.value : null;
        out.push({
          ...base,
          id: `${r.id}#q${q + 1}`,
          quarter: q,
          value,
          source: r.reported_data ?? '',
          benchmark,
          verdict: benchmark == null || !qv ? 'none' : yesNo(qv[q]),
        });
      });
    }
  }
  return out;
}

const TIME = /\d+\s*(h\b|hours?|days?|working)/i;

function timeLimitsOf(r: MasterRow, rows: MasterRow[]): { area: string; text: string }[] {
  if (!r.standard || TIME.test(r.standard)) return [];
  return rows
    .filter(
      (o) =>
        o.id !== r.id &&
        o.discom_code === r.discom_code &&
        o.financial_year === r.financial_year &&
        o.indicator_family === r.indicator_family &&
        !/Overall/i.test(o.indicator) &&
        o.standard != null &&
        TIME.test(o.standard),
    )
    .map((o) => ({ area: categoryOf(o), text: o.standard! }))
    .filter((t, i, all) => t.area && all.findIndex((x) => x.area === t.area) === i);
}

/** a chart's heading for its measurement basis */
export function basisLabel(basis: string): string {
  return basis === '%' ? '% of cases within the time limit' : basis.charAt(0).toUpperCase() + basis.slice(1);
}

export function formatValue(v: number, basis: string): string {
  const s = v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return basis === '%' ? `${s}%` : s;
}

import type { MasterRow } from './types';
import type { Direction } from './indicatorDirection';
import type { DisplayUnit } from './indicatorUnits';
import { quarterVerdicts } from './master';
import { plotBenchmark, plotFigure, quarterFigures, standardLimit } from './plotFigures';

/** Quick comparison (/glance): one indicator, one year, every DISCOM's figure side by side, in the
 * page design first built on the earlier reliability dataset (GlanceView.tsx, kept as it was), now
 * fed from DISCOM_SoP_master.xlsx. Each figure is the number the row states (`plotFigure`, read
 * out of the sentence where needed), each benchmark the row's own standard, each verdict the
 * sheet's own. Figures are compared in the period their standard is set for, never annualised
 * (user, 28 Oct 2026): a row the sheet assesses quarter by quarter (standard_met_q1–q4) or whose
 * standard is a per-quarter limit shows the chosen quarter's figure from its reported data, that
 * quarter's verdict and the per-quarter limit; every other row its year figure. Nothing else is
 * computed.
 * Figures share a chart only when they share a unit; the six indicators are the ones most DISCOMs
 * report a figure for. */

export const GLANCE_FAMILIES = [
  'SAIDI',
  'SAIFI',
  'Distribution transformer failure - replacement & restoration',
  'Overhead line/cable breakdown restoration',
  'Restoration after LT-side DT fuse / consumer-end fault',
  'Reconnection after payment of dues',
];

/** tab names; the full family name is on hover */
export const GLANCE_SHORT: Record<string, string> = {
  'Distribution transformer failure - replacement & restoration': 'Transformer Failure',
  'Overhead line/cable breakdown restoration': 'Line Breakdown',
  'Restoration after LT-side DT fuse / consumer-end fault': 'Transformer Fuse',
  'Reconnection after payment of dues': 'Reconnection',
};

/** the DISCOM a bar belongs to, in the shape the page draws */
export interface GlanceDiscom {
  /** unique per bar (a DISCOM with urban and rural figures has two) */
  sheet: string;
  short_name: string;
  full_name: string;
  state: string;
}

export interface GlanceRow {
  discom: GlanceDiscom;
  value: number;
  /** the row's own sentence the figure was read from */
  text: string | null;
  meaning: string | null;
  benchmark: number | null;
  benchmarkNote: string | null;
  standard: string | null;
  standardMet: boolean | null;
  reasonNotComparable: string | null;
  note: string | null;
  ownWording: string | null;
}

export type GlancePeriod = 'year' | 'quarter';

export interface GlanceGroup {
  key: string;
  period: GlancePeriod;
  unit: DisplayUnit | null;
  direction: Direction;
  wording: string | null;
  rows: GlanceRow[];
  scaleMax: number;
  ticks: number[];
}

export interface Glance {
  groups: GlanceGroup[];
}

/** the unit a row's figures are in: its year figure's, else what its quarter list says */
export function unitOf(r: MasterRow): string | null {
  const u = plotFigure(r)?.unit;
  if (u) return u;
  const t = r.reported_data ?? '';
  return /\d\s*%/.test(t) ? '%' : /minutes per consumer/i.test(t) ? 'minutes per consumer' : /interruptions per consumer/i.test(t) ? 'interruptions per consumer' : null;
}

/** compared quarter by quarter: assessed so by the sheet, or held to a per-quarter limit, and the
 * reported data lists quarter figures */
export function isQuarterly(r: MasterRow): boolean {
  const u = unitOf(r);
  if (!u || !quarterFigures(r)) return false;
  return quarterVerdicts(r) != null || standardLimit(r, u)?.period === 'quarter';
}

const hasFigure = (r: MasterRow) => (isQuarterly(r) ? true : plotFigure(r)?.unit != null);
const inFamily = (rows: MasterRow[], family: string) => rows.filter((r) => r.indicator_family === family && hasFigure(r));

/** Years (newest first) with at least one figure for the indicator. */
export function glanceYears(rows: MasterRow[], family: string): string[] {
  return [...new Set(inFamily(rows, family).map((r) => r.financial_year))].sort().reverse();
}

const yesNo = (v: string | null | undefined): boolean | null => {
  const t = (v ?? '').trim().toLowerCase();
  return t === 'yes' ? true : t === 'no' ? false : null;
};

/** what tells a DISCOM's rows apart ("Urban", "Rural areas"): the words that differ between their
 * indicator names, when short enough to read; '' otherwise */
function distinguish(names: string[]): string[] {
  if (names.length < 2) return names.map(() => '');
  let pre = 0;
  while (pre < names[0].length && names.every((n) => n[pre] === names[0][pre])) pre++;
  let suf = 0;
  while (suf < names[0].length - pre && names.every((n) => n[n.length - 1 - suf] === names[0][names[0].length - 1 - suf])) suf++;
  while (pre > 0 && /\w/.test(names[0][pre - 1])) pre--;
  while (suf > 0 && /\w/.test(names[0][names[0].length - suf])) suf--;
  return names.map((n) => {
    const t = n.slice(pre, n.length - suf).replace(/^[\s:,(–-]+|[\s:,)–-]+$/g, '').trim();
    return t.length >= 3 && t.length <= 22 ? t : '';
  });
}

function niceScale(max: number, unit: DisplayUnit | null): { scaleMax: number; ticks: number[] } {
  if (unit?.format === 'percent' && max <= 100) return { scaleMax: 100, ticks: [0, 25, 50, 75, 100] };
  if (max <= 0) return { scaleMax: 1, ticks: [0, 1] };
  const p = Math.max(1, 10 ** Math.floor(Math.log10(max / 5)));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * p).filter(Number.isInteger).find((s) => Math.ceil(max / s) <= 5) ?? 10 * p;
  const scaleMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= scaleMax + step / 2; t += step) ticks.push(Number(t.toPrecision(12)));
  return { scaleMax, ticks };
}

export function buildGlance(all: MasterRow[], family: string, year: string, stateOrder: string[], quarter: number): Glance {
  const rows = inFamily(all, family).filter((r) => r.financial_year === year);

  const byKey = new Map<string, { unit: string; period: GlancePeriod; rows: MasterRow[] }>();
  for (const r of rows) {
    const unit = unitOf(r)!;
    const period: GlancePeriod = isQuarterly(r) ? 'quarter' : 'year';
    // a quarter group only holds rows that give the chosen quarter
    if (period === 'quarter' && quarterFigures(r)![quarter] == null) continue;
    const key = `${unit}|${period}`;
    (byKey.get(key) ?? byKey.set(key, { unit, period, rows: [] }).get(key)!).rows.push(r);
  }

  const groups: GlanceGroup[] = [];
  for (const [key, g] of byKey) {
    const u = g.unit;
    // the period is always named, so an annual chart and a quarterly one can't be mistaken for each other
    const when = g.period === 'quarter' ? 'quarterly' : 'annual';
    const unit: DisplayUnit = u === '%' ? { label: `${when} share, per cent`, format: 'percent' } : { label: `${u}, ${when}`, format: 'number' };
    const direction: Direction = u === '%' ? 'higher_is_better' : 'lower_is_better';

    const tags = new Map<string, string>();
    const byDiscom = new Map<string, MasterRow[]>();
    for (const r of g.rows) (byDiscom.get(r.discom_code) ?? byDiscom.set(r.discom_code, []).get(r.discom_code)!).push(r);
    for (const ds of byDiscom.values()) {
      const t = distinguish(ds.map((r) => r.indicator));
      // rows about agricultural feeders (SAIDI/SAIFI: "… Excluding agricultural feeders", "… Agricultural
      // feeders", "… for predominantly agricultural feeders") are always named the same way, in the
      // user's wording, whatever else tells the DISCOM's rows apart
      const agri = (r: MasterRow) => (/excluding agricultur/i.test(r.indicator) ? 'Excluding agriculture' : /agricultur/i.test(r.indicator) ? 'Predominantly agriculture' : '');
      ds.forEach((r, i) => tags.set(r.id, agri(r) || (ds.length > 1 ? t[i] : '')));
    }

    const out: GlanceRow[] = g.rows.map((r) => {
      const tag = tags.get(r.id) ?? '';
      let value: number;
      let benchmark: number | null;
      let met: boolean | null;
      if (g.period === 'quarter') {
        value = quarterFigures(r)![quarter]!;
        benchmark = u === '%' ? (plotBenchmark(r, { value, unit: '%', text: '' })?.value ?? null) : (standardLimit(r, u)?.period === 'quarter' ? standardLimit(r, u)!.value : null);
        const qv = quarterVerdicts(r);
        met = qv ? yesNo(qv[quarter]) : null;
      } else {
        const fig = plotFigure(r)!;
        value = fig.value;
        benchmark = plotBenchmark(r, fig)?.value ?? null;
        met = yesNo(r.standard_met);
      }
      return {
        discom: { sheet: r.id, short_name: tag ? `${r.discom_code} · ${tag}` : r.discom_code, full_name: r.discom_name, state: r.state },
        value,
        text: g.period === 'quarter' ? r.reported_data : (r.standardised_data ?? r.reported_data),
        meaning: r.indicator,
        benchmark,
        benchmarkNote: null,
        standard: r.standard,
        // no benchmark on the chart means nothing to judge the bar against: N/A, never "Not met" (user, 28 Oct 2026)
        standardMet: benchmark == null ? null : met,
        reasonNotComparable: r.why_not_comparable,
        note: null,
        ownWording: null,
      };
    });

    // a state's DISCOMs stay together: states ordered by their best figure, then each state's bars
    // best first (bars sharing a benchmark kept next to each other)
    const better = (a: number, b: number) => (direction === 'lower_is_better' ? a - b : b - a);
    const best = new Map<string, number>();
    for (const r of out) {
      const cur = best.get(r.discom.state);
      if (cur == null || better(r.value, cur) < 0) best.set(r.discom.state, r.value);
    }
    const idx = (s: string) => stateOrder.indexOf(s);
    out.sort(
      (a, b) =>
        better(best.get(a.discom.state)!, best.get(b.discom.state)!) ||
        idx(a.discom.state) - idx(b.discom.state) ||
        (a.benchmark ?? -1) - (b.benchmark ?? -1) ||
        better(a.value, b.value),
    );

    const max = Math.max(...out.map((r) => r.value), ...out.map((r) => r.benchmark ?? 0));
    groups.push({ key, period: g.period, unit, direction, wording: u === '%' ? 'Share within the time allowed' : unit.label, rows: out, ...niceScale(max, unit) });
  }
  groups.sort((a, b) => b.rows.length - a.rows.length);
  return { groups };
}

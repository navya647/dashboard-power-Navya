import { CATEGORICAL } from './colors';
import { plotFigure } from './plotFigures';
import type { MasterData, MasterRow } from './types';

/** Plain lookups over DISCOM_SoP_master.xlsx's rows (sop_master.json). Nothing here derives or
 * re-words a value: rows are only filtered, grouped and ordered, always in the sheet's own row
 * order, so a page shows exactly what the sheet holds. */

export function rowsForState(master: MasterData | null | undefined, state: string): MasterRow[] {
  return master ? master.rows.filter((r) => r.state === state) : [];
}

/** Every financial year the sheet has, ascending ("2021-22" …). */
export function masterYears(master: MasterData | null | undefined): string[] {
  return master ? [...new Set(master.rows.map((r) => r.financial_year))].sort() : [];
}

/** A row the sheet itself treats as carrying a reported figure: either `standardised_data` is a
 * plain number, or the sheet gives a Yes/No verdict against the standard (it only does that when
 * it compared a real figure). Used for the map's "Data Reported" status and nothing else. */
export function rowHasReportedFigure(r: MasterRow): boolean {
  return r.standardised_num != null || r.standard_met === 'Yes' || r.standard_met === 'No' || plotFigure(r) != null || reportedTextHasFigure(r.reported_data);
}

/** A reported_data sentence that states a figure, e.g. Assam's "Monthly SAIDI (minutes): Apr-22
 * 1,029; …": a digit left once dates, years and quarter names are removed, and not a "Not
 * available…" / "No official reported data…" style sentence. */
function reportedTextHasFigure(t: string | null): boolean {
  if (!t || /^\s*(not|no|nil|n\/a|none)\b/i.test(t)) return false;
  return /\d/.test(t.replace(/FY\s*\d{2,4}(-\d{2})?|\b(19|20)\d{2}(-\d{2})?|Q[1-4]|[A-Z][a-z]{2}-\d{2}/g, ''));
}

export interface MasterDiscom {
  code: string;
  name: string;
  color: string;
}

/** A state's DISCOMs in sheet order, each with its fixed categorical hue (`cols[i]` pattern). */
export function stateDiscoms(master: MasterData | null | undefined, state: string): MasterDiscom[] {
  const list = master?.states[state]?.discoms ?? [];
  return list.map((d, i) => ({ code: d.code, name: d.name, color: CATEGORICAL[i % CATEGORICAL.length] }));
}

export interface MasterIndicatorOption {
  indicator: string;
  category: string;
  family: string;
}

/** One option per (category, indicator) pair as the sheet groups them, in sheet order. An
 * indicator the sheet files under two categories appears under both. */
export function indicatorOptionsFor(rows: MasterRow[]): MasterIndicatorOption[] {
  const seen = new Map<string, MasterIndicatorOption>();
  for (const r of rows) {
    const key = `${r.category}\u0000${r.indicator}`;
    if (!seen.has(key)) seen.set(key, { indicator: r.indicator, category: r.category, family: r.indicator_family });
  }
  return [...seen.values()];
}

/** The indicator shown when a state page opens: the one with the most chart figures (plotFigure),
 * else the one with the most Yes/No verdicts, else the first indicator in sheet order. */
export function defaultIndicator(rows: MasterRow[]): string | null {
  if (!rows.length) return null;
  const score = new Map<string, [number, number]>();
  for (const r of rows) {
    const s = score.get(r.indicator) ?? [0, 0];
    if (plotFigure(r) != null) s[0] += 1;
    if (r.standard_met === 'Yes' || r.standard_met === 'No') s[1] += 1;
    score.set(r.indicator, s);
  }
  let best = rows[0].indicator;
  for (const [ind, s] of score) {
    const b = score.get(best)!;
    if (s[0] > b[0] || (s[0] === b[0] && s[1] > b[1])) best = ind;
  }
  return best;
}

/** A row the sheet assesses quarter by quarter (any of standard_met_q1–q4 filled): its four
 * verdicts as written, null for a quarter the sheet leaves blank (not reported). For these rows
 * the page shows only the quarters, never the year's `standard_met`. null for any other row. */
export function quarterVerdicts(r: MasterRow): (string | null)[] | null {
  const q = [r.standard_met_q1, r.standard_met_q2, r.standard_met_q3, r.standard_met_q4];
  return q.some((v) => v != null) ? q : null;
}

const BENCHMARK_WORDING = /at least\s+[\d.]+\s*%|no[t]? more than\s+[\d.,]+|not to exceed\s+[\d.,]+|minimum[^.]*[\d.]+\s*%/i;

/** A row's `standard`, word for word, split into its sentences, each flagged when it states the
 * threshold ("at least 90% of cases…"), so the page can show every time limit and the threshold
 * at a glance. Nothing is reworded or dropped; joining the parts gives the standard back. */
export function standardParts(r: MasterRow): { text: string; threshold: boolean }[] {
  const s = r.standard?.trim();
  if (!s) return [];
  const parts = s.split(/(?<=[.;])\s+/);
  return parts.map((text) => ({ text, threshold: parts.length > 1 && BENCHMARK_WORDING.test(text) }));
}

/** The time-limit wording in a row's `standard`: its sentences other than the threshold one
 * (standardParts), or a one-sentence standard that states no threshold ("Within 4 hours"). null
 * when the standard has none (e.g. "At least 95% within standard time"). Verbatim. */
export function timeSpecified(r: MasterRow): string | null {
  const parts = standardParts(r);
  if (parts.length === 1) return BENCHMARK_WORDING.test(parts[0].text) ? null : parts[0].text;
  const rest = parts.filter((p) => !p.threshold).map((p) => p.text);
  return rest.length ? rest.join(' ') : null;
}

/** Every distinct time-limit wording across an indicator's rows, with the DISCOMs and years
 * whose rows state it, in first-seen order. */
export function timeSpecs(rows: MasterRow[]): { text: string; discoms: string[]; years: string[] }[] {
  const out = new Map<string, { text: string; discoms: string[]; years: string[] }>();
  for (const r of rows) {
    const t = timeSpecified(r);
    if (!t) continue;
    const e = out.get(t) ?? out.set(t, { text: t, discoms: [], years: [] }).get(t)!;
    if (!e.discoms.includes(r.discom_code)) e.discoms.push(r.discom_code);
    if (!e.years.includes(r.financial_year)) e.years.push(r.financial_year);
  }
  return [...out.values()];
}

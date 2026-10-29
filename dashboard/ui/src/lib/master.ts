import { CATEGORICAL } from './colors';
import { plotBenchmark, plotFigure } from './plotFigures';
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

const CONSUMER_FACING = /SAIDI|SAIFI|billing mistake|faulty meter|transformer failure/i;

/** Internal ordering only (user, 29 Oct 2026), never shown: how much an indicator's rows can show.
 * Tier 1 = chart figures in 2+ years with a drawn benchmark in 2+ years, tier 2 = figures in 2+
 * years, tier 3 = the rest; then years with figures, years with a benchmark, consumer-facing
 * indicators, "Overall" rows, a numerical standard in words. The sheet's Met/Not met is not used. */
export function indicatorStrength(rows: MasterRow[]): Map<string, number> {
  const by = new Map<string, { fig: Set<string>; bench: Set<string>; std: boolean }>();
  for (const r of rows) {
    const s = by.get(r.indicator) ?? by.set(r.indicator, { fig: new Set(), bench: new Set(), std: false }).get(r.indicator)!;
    const f = plotFigure(r);
    if (f) {
      s.fig.add(r.financial_year);
      if (plotBenchmark(r, f)) s.bench.add(r.financial_year);
    }
    if (/\d/.test(r.standard ?? '') && !/no numeric|no quantitative/i.test(r.standard ?? '')) s.std = true;
  }
  const out = new Map<string, number>();
  for (const [ind, s] of by) {
    const tier = s.fig.size >= 2 && s.bench.size >= 2 ? 1 : s.fig.size >= 2 ? 2 : 3;
    out.set(ind, (3 - tier) * 1000 + s.fig.size * 100 + s.bench.size * 10 +
      (CONSUMER_FACING.test(ind) ? 5 : 0) + (/overall/i.test(ind) ? 2 : 0) + (s.std ? 1 : 0));
  }
  return out;
}

/** The indicator shown when a state page opens: the strongest by indicatorStrength, first in
 * sheet order on a tie. */
export function defaultIndicator(rows: MasterRow[]): string | null {
  if (!rows.length) return null;
  const score = indicatorStrength(rows);
  let best = rows[0].indicator;
  for (const [ind, s] of score) if (s > score.get(best)!) best = ind;
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

const TIME_WORDING = /\b(hours?|hrs?|h|days?|minutes?|mins?|weeks?|months?|AM|PM|immediate(ly)?)\b|time limits? as per/i;

/** Every distinct time-limit wording across an indicator's rows, with the DISCOMs and years
 * whose rows state it, in first-seen order. */
export function timeSpecs(rows: MasterRow[]): { text: string; discoms: string[]; years: string[] }[] {
  const out = new Map<string, { text: string; discoms: string[]; years: string[] }>();
  for (const r of rows) {
    const t = timeSpecified(r);
    // only wording that names a time; "No numerical limit specified…" restated per year isn't one
    if (!t || !TIME_WORDING.test(t)) continue;
    const e = out.get(t) ?? out.set(t, { text: t, discoms: [], years: [] }).get(t)!;
    if (!e.discoms.includes(r.discom_code)) e.discoms.push(r.discom_code);
    if (!e.years.includes(r.financial_year)) e.years.push(r.financial_year);
  }
  return [...out.values()];
}

const UNIT = String.raw`(?:working hours?|working days?|hours?|hrs?|h\b|days?|minutes?|mins?|months?)`;
// "within 24 hours", "within 2 h (Class-1 cities), 4 h (urban), 8 h (rural)", "not to exceed 12 hours",
// a standard that opens with its time ("60 days. Licensee-level target: …"); the time as written, up
// to " of …" / the sentence's end
const TIME_RES = [
  new RegExp(String.raw`(?:within|not (?:to )?exceed(?:ing)?)\s+(\d+(?:\.\d+)?\s*${UNIT}(?:\s*\([^()]*\))?(?:,\s*\d+(?:\.\d+)?\s*${UNIT}(?:\s*\([^()]*\))?)*)`, 'i'),
  new RegExp(String.raw`^\s*(\d+(?:\.\d+)?\s*${UNIT})(?=\s*[.(]|\s+from\b)`, 'i'),
];
// times written in words: "On the same day.", "within one month"
TIME_RES.push(/\b((?:on )?the same day|(?:the )?next working day|one (?:day|week|month))\b/i);
const TIME_IN = { exec: (t: string) => { for (const re of TIME_RES) { const m = re.exec(t); if (m) return m; } return null; }, test: (t: string) => TIME_RES.some((re) => re.test(t)) };
const baseName = (n: string) =>
  n.replace(/,?\s*(Overall|Guaranteed) standard/i, '').replace(/,?\s*% within time limit/i, '').replace(/\s*[–-]\s*$/, '').trim();

/** The time limit a row's % standard is "within", for standards that leave it out ("At least 95%
 * replaced within the prescribed time"): the same DISCOM and year's sibling rows that state one,
 * i.e. the same indicator as a Guaranteed standard, or its per-area rows ("… – Cities and towns").
 * Each is returned as written, with the part of its name that differs ("Cities and towns"), never
 * merged or reworded. Empty when the row's own standard already gives a time (user, 29 Oct 2026). */
export function borrowedTimes(r: MasterRow, all: MasterRow[]): { area: string; standard: string; time: string }[] {
  if (!r.standard || TIME_IN.test(r.standard)) return [];
  const base = baseName(r.indicator);
  const out: { area: string; standard: string; time: string }[] = [];
  for (const x of all) {
    if (x === r || x.state !== r.state || x.discom_code !== r.discom_code || x.financial_year !== r.financial_year || !x.standard) continue;
    const xb = baseName(x.indicator);
    const sub = xb === base ? '' : xb.startsWith(`${base} – `) ? xb.slice(base.length + 3) : null;
    if (sub == null) continue;
    const m = TIME_IN.exec(x.standard);
    if (m && !out.some((o) => o.standard === x.standard && o.area === sub)) out.push({ area: sub, standard: x.standard, time: m[1] });
  }
  // last resort: the same DISCOM-year's rows of the same indicator family that state a time
  // (Gujarat "…overhead line/cable breakdown" ↔ "Restoration of supply after conductor breakdown – Urban areas")
  if (!out.length)
    for (const x of all) {
      if (x === r || x.state !== r.state || x.discom_code !== r.discom_code || x.financial_year !== r.financial_year || x.indicator_family !== r.indicator_family || !x.standard) continue;
      const m = TIME_IN.exec(x.standard);
      const area = x.indicator.includes(' – ') ? x.indicator.slice(x.indicator.lastIndexOf(' – ') + 3) : x.indicator;
      if (m && !out.some((o) => o.standard === x.standard)) out.push({ area, standard: x.standard, time: m[1] });
    }
  return out;
}

/** "24 hours" / "24 hours (Cities and towns), 48 hours (Rural areas)": the time limit(s) a row's
 * standard is within, its own or borrowedTimes'. null when none is written anywhere. */
export function timeLimitText(r: MasterRow, all: MasterRow[]): string | null {
  const own = r.standard ? TIME_IN.exec(r.standard) : null;
  if (own) return own[1];
  const b = borrowedTimes(r, all);
  const times = [...new Set(b.map((x) => x.time))];
  if (!times.length) return null;
  if (times.length === 1) return times[0];
  return b.map((x) => (x.area ? `${x.time} (${x.area})` : x.time)).filter((v, i, a) => a.indexOf(v) === i).join(', ');
}

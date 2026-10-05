import { fyLabel } from './format';
import type { CardSeries } from './indicatorContext';

/** Source-reference helpers for the indicator module. Everything here is regrouping of fields the
 * extraction already carries — nothing is looked up or inferred from outside the data:
 *
 * - Regulations come from each DISCOM/year block's `regulation` field: the regulation titles a
 *   sheet lists on its second row (principal regulation, revisions, amendments — often several,
 *   spread across columns), which the extraction joins with ' | '. Split back on exactly that
 *   delimiter, never on anything inside one title. The extraction attaches a sheet's header-row
 *   citations to the first year block only, so a citation is sheet-level (per DISCOM), not a
 *   statement about which years it covers — see `regulationAppliesLabel`.
 * - Neither workbook records a URL or file for any regulation or for any year's reported figures.
 *   `SOURCE_URLS` is where one goes once it exists (keyed by the exact citation text); until then
 *   every reference renders as plain text and per-year report documents read "N/A". */

const SOURCE_URLS: Record<string, string> = {};

export function sourceUrlFor(title: string): string | null {
  return SOURCE_URLS[title] ?? null;
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Grouping key for two spellings of the same text that differ only in spacing or a trailing full
 * stop ("…per quarter ." vs "…per quarter", "RG-8 (II)" vs "RG-8(II)") — presentation-only; the
 * first-seen spelling is what gets displayed. */
export function textKey(s: string): string {
  return clean(s).replace(/[\s.]+$/, '').replace(/\s+/g, '').toLowerCase();
}

export function citationParts(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(' | ')
    .map(clean)
    .filter(Boolean);
}

export interface Occurrence {
  series: string;
  year: string;
}

/** "Applies to" text for a value that holds for only some DISCOM/years of an indicator: '' when it
 * covers every DISCOM/year that has a record at all; otherwise each DISCOM by name, with its years
 * listed only where it doesn't cover all of that DISCOM's own record years. */
export function appliesToLabel(occ: Occurrence[], universe: Occurrence[], withYears = true): string {
  const all = new Map<string, Set<string>>();
  for (const o of universe) {
    if (!all.has(o.series)) all.set(o.series, new Set());
    all.get(o.series)!.add(o.year);
  }
  const mine = new Map<string, Set<string>>();
  for (const o of occ) {
    if (!mine.has(o.series)) mine.set(o.series, new Set());
    mine.get(o.series)!.add(o.year);
  }
  const coversAll = [...all].every(([s, ys]) => mine.has(s) && [...ys].every((y) => mine.get(s)!.has(y)));
  if (coversAll) return '';
  return [...mine]
    .map(([s, ys]) => {
      const full = [...(all.get(s) ?? [])].every((y) => ys.has(y));
      if (full || !withYears) return s;
      return `${s} ${[...ys].sort().map(fyLabel).join(', ')}`;
    })
    .join(' · ');
}

export interface TextGroup {
  text: string;
  occ: Occurrence[];
}

/** Distinct values of one text field across every series/year of an indicator, each with where it
 * occurs — so a standard that differs between DISCOMs (or changed in one year) is listed once per
 * distinct text with whom it applies to, instead of silently showing only the first one. */
export function groupTextField(series: CardSeries[], pick: (p: CardSeries['points'][number]) => string | null, skip?: (t: string) => boolean): TextGroup[] {
  const order: string[] = [];
  const groups = new Map<string, TextGroup>();
  for (const s of series) {
    for (const p of s.points) {
      const raw = pick(p);
      if (!raw || !clean(raw) || skip?.(clean(raw))) continue;
      const k = textKey(raw);
      if (!groups.has(k)) {
        groups.set(k, { text: clean(raw), occ: [] });
        order.push(k);
      }
      groups.get(k)!.occ.push({ series: s.label, year: p.year });
    }
  }
  return order.map((k) => groups.get(k)!);
}

export interface RegulationSource {
  title: string;
  /** read literally off the title: "Amendment" if it names itself one, "Regulation" if it names
   * itself a regulation, otherwise just "Citation" (e.g. a sheet's licensee-name row that the
   * extraction picked up alongside the regulation titles) */
  role: 'Regulation' | 'Amendment' | 'Citation';
  url: string | null;
  occ: Occurrence[];
}

export function collectRegulationSources(series: CardSeries[]): RegulationSource[] {
  const order: string[] = [];
  const byKey = new Map<string, RegulationSource>();
  for (const s of series) {
    for (const p of s.points) {
      for (const title of citationParts(p.regulation)) {
        const k = textKey(title);
        if (!byKey.has(k)) {
          byKey.set(k, { title, role: /amendment/i.test(title) ? 'Amendment' : /regulation/i.test(title) ? 'Regulation' : 'Citation', url: sourceUrlFor(title), occ: [] });
          order.push(k);
        }
        byKey.get(k)!.occ.push({ series: s.label, year: p.year });
      }
    }
  }
  return order.map((k) => byKey.get(k)!);
}

/** Which DISCOMs cite a regulation (sheet-level) — plus, only for a sheet that lists citations
 * above more than one year's rows, the year block(s) it was listed above, since that's the only
 * year information the source actually gives. '' when every citing DISCOM on the indicator cites
 * it and no sheet has a second citation block. */
export function regulationAppliesLabel(r: RegulationSource, series: CardSeries[]): string {
  const blocksOf = (s: CardSeries) => s.points.filter((p) => citationParts(p.regulation).length > 0).length;
  const multiBlock = new Set(series.filter((s) => blocksOf(s) > 1).map((s) => s.label));
  const citing = series.filter((s) => blocksOf(s) > 0).map((s) => s.label);
  const bySeries = new Map<string, Set<string>>();
  for (const o of r.occ) {
    if (!bySeries.has(o.series)) bySeries.set(o.series, new Set());
    bySeries.get(o.series)!.add(o.year);
  }
  const everyone = citing.every((l) => bySeries.has(l));
  if (everyone && ![...bySeries.keys()].some((l) => multiBlock.has(l))) return '';
  return [...bySeries]
    .map(([l, ys]) => (multiBlock.has(l) ? `${l} (listed above its ${[...ys].sort().map(fyLabel).join(', ')} rows)` : l))
    .join(' · ');
}

/** Placeholder text the source uses in place of a value ("N/A") — treated as absent. "Not
 * specified" is NOT in here: where the sheet literally says that, it's real reported content. */
export function isNA(t: string | null | undefined): boolean {
  // String(): the source JSON isn't always the string its type says (numeric benchmarks)
  return t == null || t === '' || /^n\/?a\.?$/i.test(String(t).trim());
}

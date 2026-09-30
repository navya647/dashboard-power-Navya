import { fmt, fyLabel } from './format';
import { categoryForType, sortCategories } from './sopCategories';
import { buildFrameworkSeries, buildSopSeries } from './sop';
import { CATEGORICAL } from './colors';
import type { CardPoint, CardSeries } from '@/components/IndicatorVisualCard';
import type { Discom, DiscomsData, StateSpecificData } from './types';

/** One reported/notified fact for one DISCOM/indicator/year, from either dataset — everything
 * `IndicatorVisualCard` needs (via `CardPoint`) plus the two extra fields the Data Table needs:
 * `exists` (was there a source record at all for this year, independent of whether its reported
 * value came back null) and pre-formatted `reportedText`/`benchmarkText` (unit already applied,
 * since the unit varies per indicator across the two datasets). */
export interface UnifiedPoint extends CardPoint {
  exists: boolean;
  reportedText: string | null;
  benchmarkText: string | null;
}

/** The finest-grained unit this page reasons about: one indicator, tracked by one DISCOM (or, for
 * the 5 frameworks-only states, the state's regulatory-framework listing standing in for a
 * DISCOM), across every fiscal year. Both the chart cards and the Data Table — and the DISCOM /
 * Indicator Category / Indicator Type / Indicator filter cascade that drives both — are built from
 * the same flat list of these, so there is exactly one page architecture regardless of which
 * dataset an indicator came from or whether it has any reported figure yet. */
export interface UnifiedIndicatorAtom {
  dataset: 'reliability' | 'sop';
  discomKey: string;
  discomLabel: string;
  discomFullLabel: string | null;
  color: string;
  isFramework: boolean;
  category: string;
  type: string;
  indicator: string;
  meaning: string | null;
  standardSpecified: string | null;
  unitSuffix: (v: number) => string;
  yAxisLabel?: string;
  /** 'allYears' = a framework's static notified indicator, no per-year source rows of its own —
   * the chart still gets a full FY axis (see buildFrameworkSeries), but the Data Table collapses
   * it to one "All years" row rather than fabricating one row per fiscal year. */
  fyMode: 'perYear' | 'allYears';
  points: UnifiedPoint[];
}

/** Each field is the set of selected values for that filter — an empty array means "no constraint"
 * (matches every atom), not "match nothing"; StateDetail.tsx is what additionally treats an empty
 * `indicators` as "show no cards yet" (a display-gating decision, not something this shared match
 * predicate itself should encode, since a page like CompareView.tsx's own category/type/indicator
 * filters wants empty-means-unconstrained instead). */
export interface UnifiedFilters {
  discoms: string[];
  categories: string[];
  types: string[];
  indicators: string[];
}

const RELIABILITY_CATEGORY_ORDER = ['Reliability', 'Power Quality', 'Service', 'Consumer'];

/** Reliability's 4 categories first (in their own fixed order), then the SoP category order, then
 * anything unrecognized last — so switching datasets via the filter never reshuffles a category
 * list a viewer is already scanning. */
export function sortAllCategories(categories: string[]): string[] {
  const relRank = (c: string) => RELIABILITY_CATEGORY_ORDER.indexOf(c);
  const rel = categories.filter((c) => relRank(c) !== -1).sort((a, b) => relRank(a) - relRank(b));
  const rest = sortCategories(categories.filter((c) => relRank(c) === -1));
  return [...rel, ...rest];
}

function firstIndicatorMeaning(d: Discom, yearsAsc: string[], key: string): string | null {
  for (const y of yearsAsc) {
    const m = d.years[y]?.indicators[key]?.indicator_meaning;
    if (m) return m;
  }
  return null;
}

/** Stable DISCOM display order shared by the filter dropdown and the per-DISCOM color assignment:
 * reliability DISCOMs first (in source order), then any SoP-only DISCOM not already counted, then
 * — only when a state has neither — the state's own name standing in for its regulatory-framework
 * pseudo-DISCOM. */
export function unifiedDiscomOrder(allDs: Discom[], stateSpecific: StateSpecificData | null | undefined, stateName: string): string[] {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const d of allDs) {
    if (!seen.has(d.short_name)) {
      seen.add(d.short_name);
      order.push(d.short_name);
    }
  }
  const sopDs = stateSpecific?.discoms.filter((d) => d.state === stateName) ?? [];
  for (const d of sopDs) {
    if (!seen.has(d.short_name)) {
      seen.add(d.short_name);
      order.push(d.short_name);
    }
  }
  if (!allDs.length && !sopDs.length) {
    const framework = stateSpecific?.frameworks.find((f) => f.state === stateName);
    if (framework) order.push(stateName);
  }
  return order;
}

function reliabilityAtoms(discoms: DiscomsData, ds: Discom[], colorOf: (key: string) => string, yearsAsc: string[]): UnifiedIndicatorAtom[] {
  const atoms: UnifiedIndicatorAtom[] = [];
  for (const d of ds) {
    for (const key of discoms.canonical_order) {
      const meta = discoms.canonical_indicators[key];
      // Only 'pct' is a unit the source consistently confirms (the "% of cases..." meaning text
      // matches the number) — 'hours'/'count' are the extraction script's own inferred labels, not
      // something the sheet states directly (SAIDI, for one DISCOM, turned out to be reported in
      // minutes, not hours). Rather than risk mislabeling a unit, show the plain number for those
      // and let the indicator's own "Measured as" text (reportedMeaning, straight from source)
      // carry the real unit description — see CLAUDE.md "preserve source units exactly".
      const isPct = meta.unit === 'pct';
      const unitSuffix = (v: number) => fmt(v, 2) + (isPct ? '%' : '');
      const points: UnifiedPoint[] = yearsAsc.map((year) => {
        const ind = d.years[year]?.indicators[key];
        const benchNum = ind?.benchmark != null && !Number.isNaN(parseFloat(ind.benchmark)) ? parseFloat(ind.benchmark) : null;
        return {
          year,
          exists: ind != null,
          value: ind?.value ?? null,
          benchmark: benchNum,
          benchmarkMeaning: ind?.benchmark_meaning ?? null,
          reportedMeaning: ind?.reported_meaning ?? null,
          standardSpecified: ind?.standard_specified ?? null,
          comparisonPossible: ind?.comparison_possible ?? null,
          standardMet: ind?.standard_met ?? null,
          reasonNotComparable: ind?.reason_not_comparable ?? null,
          regulation: d.years[year]?.regulation || null,
          reportedText: ind?.value == null ? null : unitSuffix(ind.value),
          benchmarkText: benchNum == null ? null : unitSuffix(benchNum),
        };
      });
      atoms.push({
        dataset: 'reliability',
        discomKey: d.short_name,
        discomLabel: d.short_name,
        discomFullLabel: d.full_name,
        color: colorOf(d.short_name),
        isFramework: false,
        category: meta.group,
        type: meta.group,
        indicator: key,
        meaning: firstIndicatorMeaning(d, yearsAsc, key),
        standardSpecified: points.find((p) => p.standardSpecified)?.standardSpecified ?? null,
        unitSuffix,
        yAxisLabel: isPct ? 'Percentage' : undefined,
        fyMode: 'perYear',
        points,
      });
    }
  }
  return atoms;
}

const sopUnitSuffix = (v: number) => fmt(v, 2) + '%';

function sopAtoms(stateSpecific: StateSpecificData, stateName: string, colorOf: (key: string) => string, yearsAsc: string[]): UnifiedIndicatorAtom[] {
  const atoms: UnifiedIndicatorAtom[] = [];
  const discomsForState = stateSpecific.discoms.filter((d) => d.state === stateName);

  if (discomsForState.length) {
    for (const d of discomsForState) {
      for (const s of buildSopSeries(d, yearsAsc)) {
        const points: UnifiedPoint[] = s.points.map((p) => ({
          year: p.year,
          exists: p.entry != null,
          value: p.entry?.reported ?? null,
          benchmark: p.entry?.benchmark ?? null,
          benchmarkMeaning: p.entry?.benchmark_meaning ?? null,
          reportedMeaning: p.entry?.reported_meaning ?? null,
          standardSpecified: p.entry?.standard_specified ?? null,
          comparisonPossible: p.entry?.comparison_possible ?? null,
          standardMet: p.entry?.standard_met ?? null,
          reasonNotComparable: p.entry?.reason_not_comparable ?? null,
          regulation: d.years[p.year]?.regulation ?? null,
          reportedText: p.entry?.reported == null ? null : sopUnitSuffix(p.entry.reported),
          benchmarkText: p.entry?.benchmark == null ? null : sopUnitSuffix(p.entry.benchmark),
        }));
        atoms.push({
          dataset: 'sop',
          discomKey: d.short_name,
          discomLabel: d.short_name,
          discomFullLabel: d.full_name,
          color: colorOf(d.short_name),
          isFramework: false,
          category: categoryForType(s.type),
          type: s.type ?? 'Uncategorized',
          indicator: s.indicator ?? 'Unnamed indicator',
          meaning: s.meaning,
          standardSpecified: points.find((p) => p.standardSpecified)?.standardSpecified ?? null,
          unitSuffix: sopUnitSuffix,
          yAxisLabel: 'Percentage',
          fyMode: 'perYear',
          points,
        });
      }
    }
    return atoms;
  }

  const framework = stateSpecific.frameworks.find((f) => f.state === stateName);
  if (!framework) return atoms;

  for (const s of buildFrameworkSeries(framework, yearsAsc)) {
    const entry = s.points[0].entry!;
    const points: UnifiedPoint[] = yearsAsc.map((year) => ({
      year,
      exists: true,
      value: null,
      benchmark: entry.benchmark ?? null,
      benchmarkMeaning: entry.benchmark_meaning ?? null,
      reportedMeaning: entry.reported_meaning ?? null,
      standardSpecified: entry.standard_specified ?? null,
      comparisonPossible: entry.comparison_possible ?? null,
      standardMet: entry.standard_met ?? null,
      reasonNotComparable: entry.reason_not_comparable ?? null,
      regulation: framework.regulation ?? null,
      reportedText: null,
      benchmarkText: entry.benchmark == null ? null : sopUnitSuffix(entry.benchmark),
    }));
    atoms.push({
      dataset: 'sop',
      discomKey: stateName,
      discomLabel: stateName,
      discomFullLabel: null,
      color: colorOf(stateName),
      isFramework: true,
      category: categoryForType(s.type),
      type: s.type ?? 'Uncategorized',
      indicator: s.indicator ?? 'Unnamed indicator',
      meaning: s.meaning,
      standardSpecified: entry.standard_specified ?? null,
      unitSuffix: sopUnitSuffix,
      yAxisLabel: 'Percentage',
      fyMode: 'allYears',
      points,
    });
  }
  return atoms;
}

/** The one data-unification entry point for the State Performance page: every reliability and SoP
 * indicator this state has anything for (reported or merely notified), as one flat, dataset-
 * agnostic list. Nothing here is a derived score — every field is lifted straight from the source,
 * see CLAUDE.md. */
export function buildUnifiedAtoms(discoms: DiscomsData | null | undefined, allDs: Discom[], stateSpecific: StateSpecificData | null | undefined, stateName: string, yearsAsc: string[]): UnifiedIndicatorAtom[] {
  const order = unifiedDiscomOrder(allDs, stateSpecific, stateName);
  const colorOf = (key: string) => CATEGORICAL[Math.max(0, order.indexOf(key)) % CATEGORICAL.length];
  const atoms: UnifiedIndicatorAtom[] = [];
  if (discoms) atoms.push(...reliabilityAtoms(discoms, allDs, colorOf, yearsAsc));
  if (stateSpecific) atoms.push(...sopAtoms(stateSpecific, stateName, colorOf, yearsAsc));
  return atoms;
}

export function matchesFilters(atom: UnifiedIndicatorAtom, f: UnifiedFilters): boolean {
  if (f.discoms.length && !f.discoms.includes(atom.discomKey)) return false;
  if (f.categories.length && !f.categories.includes(atom.category)) return false;
  if (f.types.length && !f.types.includes(atom.type)) return false;
  if (f.indicators.length && !f.indicators.includes(atom.indicator)) return false;
  return true;
}

export interface DiscomOption {
  key: string;
  label: string;
}

export function discomOptions(atoms: UnifiedIndicatorAtom[]): DiscomOption[] {
  const map = new Map<string, string>();
  for (const a of atoms) if (!map.has(a.discomKey)) map.set(a.discomKey, a.discomLabel);
  return Array.from(map, ([key, label]) => ({ key, label }));
}

export function categoryOptions(atoms: UnifiedIndicatorAtom[]): string[] {
  return sortAllCategories(Array.from(new Set(atoms.map((a) => a.category))));
}

export function typeOptions(atoms: UnifiedIndicatorAtom[]): string[] {
  return Array.from(new Set(atoms.map((a) => a.type))).sort();
}

export function indicatorOptions(atoms: UnifiedIndicatorAtom[]): string[] {
  return Array.from(new Set(atoms.map((a) => a.indicator))).sort();
}

export interface DefaultIndicatorSelection {
  category: string;
  type: string;
  indicator: string;
}

/** Picks one indicator to show by default when a state/UT page first loads (or the viewer
 * navigates to a different one), so the analysis section isn't empty before any filter is
 * touched. Prefers SAIDI whenever it has any actual reported figure for this state; otherwise
 * falls back to whichever indicator has the most reported figures across every DISCOM/year here,
 * so the initial view is never empty just because SAIDI itself wasn't reported. Ties fall to
 * whichever indicator's atoms were built first (a deterministic, state-independent order — see
 * `buildUnifiedAtoms`), not to indicator name, so the same tie always resolves the same way.
 * Returns null when nothing in this state has a single reported figure at all (the 5
 * frameworks-only states, or a state whose atoms exist but are all unreported) — callers should
 * fall back to their existing empty state rather than forcing a selection onto an indicator that
 * merely exists in the regulatory-standards data with nothing reported against it. */
export function pickDefaultIndicator(atoms: UnifiedIndicatorAtom[]): DefaultIndicatorSelection | null {
  const byIndicator = new Map<string, { category: string; type: string; reportedCount: number }>();
  for (const a of atoms) {
    const reportedCount = a.points.filter((p) => p.exists && p.value != null).length;
    const existing = byIndicator.get(a.indicator);
    if (existing) existing.reportedCount += reportedCount;
    else byIndicator.set(a.indicator, { category: a.category, type: a.type, reportedCount });
  }

  const saidi = byIndicator.get('SAIDI');
  if (saidi && saidi.reportedCount > 0) return { category: saidi.category, type: saidi.type, indicator: 'SAIDI' };

  let best: (DefaultIndicatorSelection & { reportedCount: number }) | null = null;
  for (const [indicator, info] of byIndicator) {
    if (info.reportedCount <= 0) continue;
    if (!best || info.reportedCount > best.reportedCount) best = { indicator, category: info.category, type: info.type, reportedCount: info.reportedCount };
  }
  return best ? { category: best.category, type: best.type, indicator: best.indicator } : null;
}

function stripTableFields(p: UnifiedPoint): CardPoint {
  const { exists: _exists, reportedText: _reportedText, benchmarkText: _benchmarkText, ...rest } = p;
  return rest;
}

/** One chart card per indicator this page shows, one line per DISCOM that reports it — DISCOMs are
 * never split into separate cards for the same indicator (reliability's canonical keys already
 * guaranteed this; SoP indicator identity is exact-string `category`+`type`+`indicator` equality,
 * never a cross-DISCOM semantic merge — see CLAUDE.md — so two DISCOMs only ever land on the same
 * card when their source sheets used the literal same Indicator Type/Indicator text). Every
 * matching indicator gets a card, whether or not it has a single reported figure yet —
 * `IndicatorVisualCard` already renders an indicator's full FY axis and regulatory context either
 * way. `discomKey`/`discomLabel` are only set when exactly one DISCOM contributed to the card —
 * with more than one they're null, since the chart's own per-series labels/legend already carry
 * that identity, same as the reliability dataset always has. */
export interface UnifiedCard {
  id: string;
  dataset: 'reliability' | 'sop';
  category: string;
  type: string;
  indicator: string;
  meaning: string | null;
  discomKey: string | null;
  discomLabel: string | null;
  discomFullLabel: string | null;
  unitSuffix: (v: number) => string;
  yAxisLabel?: string;
  series: CardSeries[];
}

export function buildUnifiedCards(atoms: UnifiedIndicatorAtom[]): UnifiedCard[] {
  const byKey = new Map<string, UnifiedIndicatorAtom[]>();
  for (const a of atoms) {
    const key = `${a.dataset}::${a.category}::${a.type}::${a.indicator}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(a);
  }

  const cards: UnifiedCard[] = [];
  for (const [key, group] of byKey) {
    const first = group[0];
    const oneDiscom = group.length === 1 ? first : null;
    cards.push({
      id: key,
      dataset: first.dataset,
      category: first.category,
      type: first.type,
      indicator: first.indicator,
      meaning: group.map((a) => a.meaning).find((m) => m) ?? null,
      discomKey: oneDiscom?.discomKey ?? null,
      discomLabel: oneDiscom?.discomLabel ?? null,
      discomFullLabel: oneDiscom?.discomFullLabel ?? null,
      unitSuffix: first.unitSuffix,
      yAxisLabel: first.yAxisLabel,
      series: group.map((a) => ({ label: a.discomLabel, color: a.color, points: a.points.map(stripTableFields) })),
    });
  }
  return cards;
}

export interface UnifiedTableRow {
  key: string;
  discom: string;
  fy: string;
  category: string;
  type: string;
  indicator: string;
  standardSpecified: string | null;
  benchmarkText: string | null;
  benchmarkMeaning: string | null;
  reportedText: string | null;
  reportedMeaning: string | null;
  standardMet: boolean | null;
  regulation: string | null;
}

/** One Data Table row per actual source record — a framework's notified indicator collapses to a
 * single "All years" row (never one fabricated row per fiscal year, see CLAUDE.md), and a
 * per-DISCOM reported indicator gets one row per fiscal year it actually has a record for
 * (`exists`), never one for a year the workbook simply never covered. */
export function buildUnifiedTableRows(atoms: UnifiedIndicatorAtom[]): UnifiedTableRow[] {
  const rows: UnifiedTableRow[] = [];
  for (const a of atoms) {
    if (a.fyMode === 'allYears') {
      const p = a.points[0];
      rows.push({
        key: `${a.discomKey}::${a.type}::${a.indicator}::all`,
        discom: a.discomLabel,
        fy: 'All years',
        category: a.category,
        type: a.type,
        indicator: a.indicator,
        standardSpecified: p.standardSpecified,
        benchmarkText: p.benchmarkText,
        benchmarkMeaning: p.benchmarkMeaning,
        reportedText: p.reportedText,
        reportedMeaning: p.reportedMeaning,
        standardMet: p.standardMet,
        regulation: p.regulation,
      });
      continue;
    }
    for (const p of a.points) {
      if (!p.exists) continue;
      rows.push({
        key: `${a.discomKey}::${a.type}::${a.indicator}::${p.year}`,
        discom: a.discomLabel,
        fy: fyLabel(p.year),
        category: a.category,
        type: a.type,
        indicator: a.indicator,
        standardSpecified: p.standardSpecified,
        benchmarkText: p.benchmarkText,
        benchmarkMeaning: p.benchmarkMeaning,
        reportedText: p.reportedText,
        reportedMeaning: p.reportedMeaning,
        standardMet: p.standardMet,
        regulation: p.regulation,
      });
    }
  }
  return rows;
}

/** DISCOM options available for one jurisdiction's Compare picker — reliability DISCOMs first,
 * then any SoP-only DISCOM, then (only for the 5 frameworks-only states) the state's own name
 * standing in for its regulatory-framework pseudo-DISCOM. Same ordering `unifiedDiscomOrder`
 * already gives the State Performance page's filter, reused here so the two pages never disagree.
 * `key` stays the bare short name (matches `UnifiedIndicatorAtom.discomKey`, used for filtering);
 * `label` is "Full name (SHORT)" wherever a full name is on record and differs from the short one
 * — the framework-only fallback (key === the state's own name) has no full name to add. */
export function jurisdictionDiscomOptions(discoms: DiscomsData, stateSpecific: StateSpecificData | null | undefined, jurisdiction: string): DiscomOption[] {
  const allDs = discoms.discoms.filter((d) => d.state === jurisdiction);
  const keys = unifiedDiscomOrder(allDs, stateSpecific, jurisdiction);
  const fullNameByKey = new Map<string, string | null>();
  for (const d of allDs) if (!fullNameByKey.has(d.short_name)) fullNameByKey.set(d.short_name, d.full_name);
  for (const d of stateSpecific?.discoms.filter((d) => d.state === jurisdiction) ?? []) {
    if (!fullNameByKey.has(d.short_name)) fullNameByKey.set(d.short_name, d.full_name);
  }
  return keys.map((key) => {
    const full = fullNameByKey.get(key);
    return { key, label: full && full !== key ? `${full} (${key})` : key };
  });
}

export interface JurisdictionDiscomSelection {
  state: string;
  discomKeys: string[];
}

/** Compare page atom builder: unlike the State Performance page's `buildUnifiedAtoms` (every
 * DISCOM a state has, always shown as separate lines) this narrows each jurisdiction down to only
 * the DISCOMs ticked in its own picker — one series per ticked DISCOM, never collapsed/averaged
 * across DISCOMs (no state-level median — see CLAUDE.md, that'd be an invented derived metric),
 * and never a fixed "whole state" line either. Colored uniquely across the *entire* selection (not
 * just within one state) so two lines are never the same color, and labeled `DISCOM — State` so a
 * line is unambiguous once multiple states are on the same chart. Returns one entry per state,
 * each carrying just that state's (already colored/labeled) atoms — see
 * `buildMultiDiscomComparableCards` for how these get matched into cards across states. */
export function buildMultiDiscomAtoms(
  discoms: DiscomsData,
  stateSpecific: StateSpecificData | null | undefined,
  selection: JurisdictionDiscomSelection[],
  yearsAsc: string[]
): { state: string; atoms: UnifiedIndicatorAtom[] }[] {
  const result = selection.map(({ state, discomKeys }) => {
    const allDs = discoms.discoms.filter((d) => d.state === state);
    const atoms = buildUnifiedAtoms(discoms, allDs, stateSpecific, state, yearsAsc).filter((a) => discomKeys.includes(a.discomKey));
    return { state, atoms };
  });
  // one color per (state, DISCOM) pair, not per atom — a DISCOM reports many indicators, each its
  // own atom, and every one of them must land on the same color or the same line would appear a
  // different color on every chart card.
  const colorByKey = new Map<string, string>();
  let i = 0;
  for (const { state, atoms } of result) {
    for (const atom of atoms) {
      const ck = `${state}::${atom.discomKey}`;
      if (!colorByKey.has(ck)) {
        colorByKey.set(ck, CATEGORICAL[i % CATEGORICAL.length]);
        i += 1;
      }
      atom.color = colorByKey.get(ck)!;
      atom.discomLabel = `${atom.discomLabel} — ${state}`;
    }
  }
  return result;
}

/** One {label, color} entry per (state, DISCOM) actually contributing to `buildMultiDiscomAtoms`'s
 * output — the Compare page's page-level legend, so every DISCOM's color is named once instead of
 * only inside each chart card's own (repeated, and hidden when a card has just one series)
 * legend. */
export function multiDiscomLegend(atomsByState: { state: string; atoms: UnifiedIndicatorAtom[] }[]): { label: string; color: string }[] {
  const seen = new Map<string, string>();
  for (const { atoms } of atomsByState) {
    for (const atom of atoms) {
      if (!seen.has(atom.discomLabel)) seen.set(atom.discomLabel, atom.color);
    }
  }
  return Array.from(seen, ([label, color]) => ({ label, color }));
}

/** From `buildMultiDiscomAtoms`'s per-state atom lists, the cards for indicators captured by at
 * least one ticked DISCOM in EVERY selected state — the multi-DISCOM equivalent of the old
 * single-line-per-state `buildComparableCards` (see CLAUDE.md/spec: matched on the captured
 * record's identity, never on whether a reported value exists). A state with zero DISCOMs ticked
 * contributes no keys, so nothing can match — callers should prompt the viewer to tick at least
 * one DISCOM per state rather than rendering an empty gallery unexplained. */
export function buildMultiDiscomComparableCards(atomsByState: { state: string; atoms: UnifiedIndicatorAtom[] }[]): UnifiedCard[] {
  const keysByState = atomsByState.map(({ atoms }) => new Set(atoms.map((a) => `${a.dataset}::${a.category}::${a.type}::${a.indicator}`)));
  const commonKeys = keysByState.length ? keysByState.reduce((acc, s) => new Set([...acc].filter((k) => s.has(k)))) : new Set<string>();
  const flat = atomsByState.flatMap(({ atoms }) => atoms);
  return buildUnifiedCards(flat).filter((c) => commonKeys.has(c.id));
}

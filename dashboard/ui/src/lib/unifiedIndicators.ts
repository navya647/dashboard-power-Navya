import { fmt, fyLabel, median } from './format';
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

export interface UnifiedFilters {
  discom: string;
  category: string;
  type: string;
  indicator: string;
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
  if (f.discom !== 'all' && atom.discomKey !== f.discom) return false;
  if (f.category !== 'all' && atom.category !== f.category) return false;
  if (f.type !== 'all' && atom.type !== f.type) return false;
  if (f.indicator !== 'all' && atom.indicator !== f.indicator) return false;
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

/** Collapses every DISCOM atom sharing one jurisdiction's `${dataset}::${category}::${type}::${indicator}`
 * identity into a single atom representing that jurisdiction as a whole — the Compare page shows
 * one line per jurisdiction, not one per DISCOM within it (unlike the State page, which shows
 * DISCOMs as separate series on purpose). A year's value is the median of that year's non-null
 * DISCOM values, never a fabricated zero when every DISCOM is null that year and never plotted at
 * all when none of them have one; benchmark/standard/regulation context comes from whichever
 * contributing DISCOM reported a value that year (or, failing that, whichever has a record at
 * all) — cross-DISCOM divergence in these fields within one jurisdiction is not the kind of
 * divergence Compare itself needs to surface (that happens one layer up, across jurisdictions,
 * once each has already been collapsed to one atom here — see IndicatorVisualCard's per-series
 * benchmark/standard handling). */
export function collapseAtomsToJurisdiction(atoms: UnifiedIndicatorAtom[], jurisdictionKey: string, jurisdictionLabel: string, color: string, yearsAsc: string[]): UnifiedIndicatorAtom[] {
  const byKey = new Map<string, UnifiedIndicatorAtom[]>();
  for (const a of atoms) {
    const key = `${a.dataset}::${a.category}::${a.type}::${a.indicator}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(a);
  }

  const result: UnifiedIndicatorAtom[] = [];
  for (const group of byKey.values()) {
    const first = group[0];
    const fyMode: UnifiedIndicatorAtom['fyMode'] = group.some((a) => a.fyMode === 'allYears') ? 'allYears' : 'perYear';
    const points: UnifiedPoint[] = yearsAsc.map((year) => {
      const yearPoints = group.flatMap((a) => a.points.filter((p) => p.year === year));
      const numeric = yearPoints.filter((p) => p.value != null).map((p) => p.value as number);
      const value = numeric.length ? median(numeric) : null;
      const contributing = yearPoints.find((p) => p.value != null) ?? yearPoints.find((p) => p.exists) ?? yearPoints[0];
      return {
        year,
        exists: yearPoints.some((p) => p.exists),
        value,
        benchmark: contributing?.benchmark ?? null,
        benchmarkMeaning: contributing?.benchmarkMeaning ?? null,
        reportedMeaning: contributing?.reportedMeaning ?? null,
        standardSpecified: contributing?.standardSpecified ?? null,
        comparisonPossible: contributing?.comparisonPossible ?? null,
        standardMet: contributing?.standardMet ?? null,
        reasonNotComparable: contributing?.reasonNotComparable ?? null,
        regulation: contributing?.regulation ?? null,
        reportedText: value == null ? null : first.unitSuffix(value),
        benchmarkText: contributing?.benchmarkText ?? null,
      };
    });
    result.push({
      dataset: first.dataset,
      discomKey: jurisdictionKey,
      discomLabel: jurisdictionLabel,
      discomFullLabel: null,
      color,
      isFramework: group.some((a) => a.isFramework),
      category: first.category,
      type: first.type,
      indicator: first.indicator,
      meaning: group.map((a) => a.meaning).find((m) => m) ?? null,
      standardSpecified: group.map((a) => a.standardSpecified).find((m) => m) ?? null,
      unitSuffix: first.unitSuffix,
      yAxisLabel: first.yAxisLabel,
      fyMode,
      points,
    });
  }
  return result;
}

/** Every indicator this jurisdiction has ANY captured record for (a reliability canonical
 * indicator every DISCOM sheet always carries a row for, or an SoP indicator/framework entry) —
 * collapsed to one atom per indicator, colored for its slot in the Compare selection. Used to
 * build the cross-jurisdiction atom list the Compare page's cards and matching are derived from;
 * "captured" here is independent of whether a reported *value* exists (see CLAUDE.md — a
 * jurisdiction can have a real regulatory-framework listing or an all-null DISCOM sheet and still
 * have legitimate content to show). */
export function buildJurisdictionAtoms(
  discoms: DiscomsData,
  stateSpecific: StateSpecificData | null | undefined,
  jurisdiction: string,
  color: string,
  yearsAsc: string[]
): UnifiedIndicatorAtom[] {
  const allDs = discoms.discoms.filter((d) => d.state === jurisdiction);
  const atoms = buildUnifiedAtoms(discoms, allDs, stateSpecific, jurisdiction, yearsAsc);
  return collapseAtomsToJurisdiction(atoms, jurisdiction, jurisdiction, color, yearsAsc);
}

/** From a set of already-collapsed per-jurisdiction atoms (see `buildJurisdictionAtoms`), the
 * cards for indicators captured by EVERY selected jurisdiction — the Compare page's "automatic
 * indicator matching" (see CLAUDE.md/spec): matched on the captured record's identity, never on
 * whether a reported value exists, so an indicator stays visible even when one or all selected
 * jurisdictions currently have nothing reported for it. */
export function buildComparableCards(atoms: UnifiedIndicatorAtom[], jurisdictions: string[]): UnifiedCard[] {
  return buildUnifiedCards(atoms).filter((c) => jurisdictions.every((j) => c.series.some((s) => s.label === j)));
}

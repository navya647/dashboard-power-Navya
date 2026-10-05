import { fyLabel } from './format';
import { allSame } from './evidenceStatus';

/** Pure regulatory-context derivations for one indicator's set of series (one per DISCOM, or on the
 * Compare page one per jurisdiction) — benchmark, standard, reported measure, comparability and
 * source-regulation grouping. Lifted out of IndicatorVisualCard unchanged so the Compare page's card
 * and the State page's indicator summary / trend chart all read the exact same logic rather than
 * each re-deriving it. Nothing here computes a score; every value is lifted from the source rows. */

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
  /** extraction-time standardisation note (e.g. a figure converted onto its series' annual basis) */
  note?: string | null;
  /** the benchmark exactly as the sheet words it, where it's text rather than a bare number
   * (reliability sheets: "15 hours per consumer per quarter (or 30 hours per six months)") */
  benchmarkRaw?: string | null;
}

export interface CardSeries {
  label: string;
  color: string;
  points: CardPoint[];
  /** the series' own source definition of the indicator (its sheet's "Indicator meaning") */
  meaning?: string | null;
  /** a frameworks-only state's notified SoP indicator — no per-year reported records */
  isFramework?: boolean;
  /** which workbook sheet this series was extracted from, when the extraction recorded one */
  source?: { workbook: string; sheet: string | null };
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
export function regulatorFromRegulationText(text: string | null): string | null {
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
 * not, rather than silently pooling every series' benchmarks into one popular-vote number. */
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

export function perSeriesValue<T>(s: CardSeries, pick: (p: CardPoint) => T | null | undefined): T | null {
  for (const p of s.points) {
    const v = pick(p);
    if (v != null && v !== '') return v;
  }
  return null;
}

export function firstNonNull<T>(series: CardSeries[], pick: (p: CardPoint) => T | null | undefined): T | null {
  for (const s of series) {
    const v = perSeriesValue(s, pick);
    if (v != null) return v;
  }
  return null;
}

/** Groups per-series values that read identically (e.g. every DISCOM of one state sharing the
 * same regulator-specified standard text) into one entry — so a divergent-standard card shows one
 * lens per distinct standard actually in play, not one per series repeating the same text. */
export function groupByText(items: { label: string; value: string | null }[]): { text: string; labels: string[] }[] {
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
export function formatGroupedLabel(labels: string[]): string {
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

export interface ComparabilityMessage {
  head: string;
  constantReason: string | null;
  distinctReasons: { years: string; reason: string }[];
}

/** Exactly the same "which years, which reason(s)" computation the not-comparable callout always
 * used — factored out so it can run once (for a shared advisory, when every series happens to
 * agree) or once per series (when they don't), without duplicating the logic itself. Never changes
 * what counts as not-comparable or what reason is shown — purely a presentation-layer reuse. */
export function comparabilityMessage(s: CardSeries): ComparabilityMessage | null {
  const notComparablePts = s.points.filter((p) => p.comparisonPossible === false);
  if (!notComparablePts.length) return null;
  const constantReason = allSame(notComparablePts.map((p) => p.reasonNotComparable));
  const distinctReasonTexts = Array.from(new Set(notComparablePts.map((p) => p.reasonNotComparable).filter((r): r is string => !!r && r !== 'N/A')));
  return {
    head:
      notComparablePts.length === s.points.length
        ? 'Not comparable across all years shown'
        : `Not comparable in ${notComparablePts.length} of ${s.points.length} years`,
    constantReason: constantReason && constantReason !== 'N/A' ? constantReason : null,
    distinctReasons:
      constantReason && constantReason !== 'N/A'
        ? []
        : distinctReasonTexts.map((r) => ({
            years: notComparablePts
              .filter((p) => p.reasonNotComparable === r)
              .map((p) => fyLabel(p.year))
              .join(', '),
            reason: r,
          })),
  };
}

/** A signature that's identical for two series only when they're not-comparable in exactly the
 * same years for exactly the same reason(s) — used to detect whether every DISCOM on this card
 * shares one comparability situation (worth saying once) or genuinely differs (worth keeping
 * distinct, per-DISCOM). Never itself changes the comparability classification. */
function comparabilitySignature(s: CardSeries): string {
  const notComparablePts = s.points.filter((p) => p.comparisonPossible === false);
  if (!notComparablePts.length) return '';
  const years = notComparablePts.length === s.points.length ? 'all' : notComparablePts.map((p) => p.year).sort().join(',');
  const reasons = Array.from(new Set(notComparablePts.map((p) => p.reasonNotComparable ?? 'N/A'))).sort().join('|');
  return `${years}::${reasons}`;
}

export type ComparabilityVerdict = 'comparable' | 'not-comparable' | 'unavailable';

/** The coarse, indicator-level comparability verdict — distinct from `comparabilityMessage`'s
 * per-year detail (which years, which reason) and from `standardMet` (an actual compliance result,
 * shown separately per year, never here). Derived strictly from `comparisonPossible`: 'unavailable'
 * when the source never recorded an assessment either way for this series (every point's
 * `comparisonPossible` is null — nothing to report, not the same as a recorded "no");
 * 'not-comparable' when at least one year was explicitly marked not comparable; 'comparable' only
 * when every recorded assessment says so. */
export function seriesComparabilityVerdict(s: CardSeries): ComparabilityVerdict {
  const assessed = s.points.filter((p) => p.comparisonPossible != null);
  if (!assessed.length) return 'unavailable';
  if (assessed.some((p) => p.comparisonPossible === false)) return 'not-comparable';
  return 'comparable';
}

export interface IndicatorContext {
  hasNumeric: boolean;
  perSeriesBench: SeriesBenchmark[];
  benchDiverges: boolean;
  /** the one comparable benchmark every series agrees on — drawn as the chart's reference line */
  bench: number | null;
  benchmarkMeaning: string | null;
  /** the recorded benchmark number, comparable or not (benchmark availability is its own fact) */
  rawBenchmark: number | null;
  sharedRegulator: string | null;
  perSeriesStandard: { label: string; value: string | null }[];
  standardShared: string | null;
  standardDiverges: boolean;
  reportedMeaning: string | null;
  /** one entry per distinct regulation text that's constant across a series' years */
  constantRegulations: { text: string; labels: string[] }[];
  /** per series: regulation texts that vary year to year within that one series */
  variantRegulations: { label: string; texts: string[] }[];
  hasSharedAdvisory: boolean;
  sharedAdvisory: ComparabilityMessage | null;
  /** per series, only when the comparability situation genuinely diverges between series */
  perSeriesAdvisories: { label: string; message: ComparabilityMessage }[];
  seriesVerdicts: ComparabilityVerdict[];
  /** null when the series disagree on the coarse verdict */
  sharedVerdict: ComparabilityVerdict | null;
}

export function deriveIndicatorContext(series: CardSeries[], measuredAsLabel?: string | null): IndicatorContext {
  const hasNumeric = series.some((s) => s.points.some((p) => p.value != null));

  // Several series on one indicator may NOT share a benchmark/standard (the Compare page merges
  // one series per jurisdiction) — never silently pool them into one popular-vote value. Only
  // collapse to one shared value when every series that has a value agrees; otherwise attribute
  // each series' own value to it explicitly.
  const perSeriesBench = perSeriesComparableBenchmarks(series);
  const distinctBenchValues = Array.from(new Set(perSeriesBench.filter((x) => x.value != null).map((x) => x.value)));
  const benchDiverges = series.length > 1 && distinctBenchValues.length > 1;
  const bench = distinctBenchValues.length === 1 ? distinctBenchValues[0] : null;
  const benchmarkMeaning = firstNonNull(series, (p) => p.benchmarkMeaning);
  // A raw benchmark number can exist in the source even when it was never counted as `bench`
  // above (comparisonPossible false/null on every point that has one) — the Regulatory Standard
  // still shows that recorded number, while whether it's usable for comparison is the separate
  // comparability verdict's concern, never conflated here.
  const rawBenchmark = bench ?? (!benchDiverges ? firstNonNull(series, (p) => p.benchmark) : null);
  // when every series agrees on one benchmark value, they're only ever the same regulator too
  // (states never share a commission) — so any series' own regulation citation names it.
  const sharedRegulator = bench != null ? regulatorFromRegulationText(firstNonNull(series, (p) => p.regulation)) : null;

  const perSeriesStandard = series.map((s) => ({ label: s.label, value: perSeriesValue(s, (p) => p.standardSpecified) }));
  const standardShared = allSame(perSeriesStandard.map((x) => x.value));
  const standardDiverges = series.length > 1 && !standardShared && perSeriesStandard.some((x) => x.value != null);

  const reportedMeaning = measuredAsLabel ?? firstNonNull(series, (p) => p.reportedMeaning);

  // one entry per distinct regulation text shared by every series citing it — grouped once rather
  // than repeated per series, since the citation doesn't change DISCOM to DISCOM within a state.
  // Per-year variation *within* one series is a separate case, kept per series.
  const constantRegulations = groupByText(series.map((s) => ({ label: s.label, value: allSame(s.points.map((p) => p.regulation)) })));
  const variantRegulations = series
    .map((s) => {
      if (allSame(s.points.map((p) => p.regulation))) return { label: s.label, texts: [] as string[] };
      return { label: s.label, texts: Array.from(new Set(s.points.map((p) => p.regulation).filter((r): r is string => !!r))) };
    })
    .filter((v) => v.texts.length > 0);

  // Whether every series that has ANY not-comparable years shares the exact same situation (same
  // years, same reason) — if so, one shared advisory says it once instead of repeating an
  // identical callout per DISCOM; never suppress a real divergence. `allSame` returns null both
  // when there's no shared value and when every series has nothing to report — the emptiness check
  // tells those apart.
  const comparabilitySignatures = series.map(comparabilitySignature);
  const anyNotComparable = comparabilitySignatures.some((sig) => sig !== '');
  const sharedComparabilitySignature = allSame(comparabilitySignatures);
  const hasSharedAdvisory = anyNotComparable && sharedComparabilitySignature != null && sharedComparabilitySignature !== '';
  const sharedAdvisory = hasSharedAdvisory ? comparabilityMessage(series[0]) : null;
  const perSeriesAdvisories = hasSharedAdvisory
    ? []
    : series.flatMap((s) => {
        const message = comparabilityMessage(s);
        return message ? [{ label: s.label, message }] : [];
      });

  const seriesVerdicts = series.map(seriesComparabilityVerdict);
  const sharedVerdict = allSame(seriesVerdicts);

  return {
    hasNumeric,
    perSeriesBench,
    benchDiverges,
    bench,
    benchmarkMeaning,
    rawBenchmark,
    sharedRegulator,
    perSeriesStandard,
    standardShared,
    standardDiverges,
    reportedMeaning,
    constantRegulations,
    variantRegulations,
    hasSharedAdvisory,
    sharedAdvisory,
    perSeriesAdvisories,
    seriesVerdicts,
    sharedVerdict,
  };
}

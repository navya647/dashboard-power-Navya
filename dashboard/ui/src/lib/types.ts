export type IndicatorUnit = 'hours' | 'count' | 'pct';

export interface CanonicalIndicatorMeta {
  group: string;
  unit: IndicatorUnit;
}

export interface IndicatorEntry {
  value: number | null;
  subtypes: Record<string, number | null>;
  indicator_meaning: string | null;
  standard_specified: string | null;
  benchmark: string | null;
  benchmark_meaning: string | null;
  reported_meaning: string | null;
  unit_note: string | null;
  comparison_possible: boolean;
  standard_met: boolean | null;
  reason_not_comparable: string | null;
}

export interface Scoring {
  total_indicators: number;
  standards_available_pct: number | null;
  data_reported_pct: number;
  comparable_pct: number | null;
  compliance_pct: number | null;
  composite_score: number;
  grade: 'A' | 'B' | 'C';
  phantom_comparable_count: number;
  indicators_reported: number;
}

export interface YearData {
  regulation: string;
  indicators: Record<string, IndicatorEntry>;
  scoring: Scoring;
}

export interface Discom {
  sheet: string;
  full_name: string;
  short_name: string;
  state: string;
  years: Record<string, YearData>;
}

export interface DiscomsData {
  state_order: string[];
  canonical_indicators: Record<string, CanonicalIndicatorMeta>;
  canonical_order: string[];
  years: string[];
  discoms: Discom[];
}

export interface GeoFeature {
  type: string;
  properties: { st_nm: string };
  geometry: unknown;
}

export interface IndiaGeoJSON {
  type: string;
  features: GeoFeature[];
}

export type MapStatus = 'full' | 'partial' | 'none' | undefined;

/** Whether a state's SERC has published its standards-of-performance regulation online — not
 * what the regulation says, just whether it's findable at all. From ACCESSIBILITY.xlsx's
 * REGULATION sheet. `null` means the source data didn't have a Yes/No answer for this row. */
export interface StateAccessibility {
  state: string;
  regulation_available: boolean | null;
  /** Google Drive copies of the principal regulation / its amendments (cell hyperlinks). */
  regulation_link: string | null;
  /** the link cell's display text (document file names), tidied */
  regulation_label: string | null;
  amendment_link: string | null;
  amendment_label: string | null;
  /** every regulation document with its own direct link, in the links sheet's order */
  regulation_documents: RegulationDocument[];
}

/** Whether a licensee's reported performance data is published on its state SERC's website, and
 * whether that publication is machine-readable (vs. e.g. a scanned PDF). From
 * ACCESSIBILITY.xlsx's REPORTED DATAPERFORMANCE sheet. `machine_readable` is `null` whenever the
 * source marked it "N/A" — in practice, whenever `available_on_serc` is false, since a format
 * question doesn't apply to data that isn't published at all. */
export interface DiscomAccessibility {
  discom: string;
  abbreviation: string;
  state: string;
  available_on_serc: boolean | null;
  machine_readable: boolean | null;
  drive_link: string | null;
  /** the SERC web page the data was found on (a cell comment in the source workbook) */
  serc_link: string | null;
  /** one link per financial year of reported data (data/hyperlinks.xlsx), sorted by year; empty
   * when none was found. `scope: 'state'` = a state-level year folder shared by every DISCOM in
   * the state (Madhya Pradesh, Odisha). */
  data_links: ReportedDataLink[];
}

export interface ReportedDataLink {
  /** '2021-22' */
  year: string;
  url: string;
  kind: 'file' | 'folder';
  scope: 'discom' | 'state';
}

/** One regulation document (principal regulation, amendment, consolidated version) as listed in
 * data/hyperlinks.xlsx — `title` and `year` exactly as the sheet gives them. */
export interface RegulationDocument {
  title: string;
  year: string | null;
  url: string;
}

export interface AccessibilitySummary {
  states_total: number;
  states_regulation_available: number;
  discoms_total: number;
  discoms_available_on_serc: number;
  discoms_machine_readable: number;
}

export interface AccessibilityData {
  state_order: string[];
  states: StateAccessibility[];
  discoms: DiscomAccessibility[];
  summary: AccessibilitySummary;
}

/** One raw Standards-of-Performance indicator row, from State specific Indicators.xlsx — the SoP
 * (consumer-service) counterpart to the SAIDI/SAIFI-style Common Indicators dataset. Unlike that
 * dataset, raw indicator names here are too varied (dozens, state-specific — fuse-off calls,
 * meter complaints, billing mistakes...) to normalize into a small canonical set, so they're kept
 * as-is rather than mapped to `canonical_order`. */
export interface SopIndicator {
  type: string | null;
  indicator: string | null;
  meaning: string | null;
  standard_specified: string | null;
  benchmark: number | null;
  benchmark_meaning: string | null;
  reported: number | null;
  reported_meaning: string | null;
  comparison_possible: boolean | null;
  standard_met: boolean | null;
  reason_not_comparable: string | null;
}

export interface SopYearData {
  regulation: string | null;
  indicators: SopIndicator[];
}

export interface SopDiscom {
  sheet: string;
  full_name: string | null;
  short_name: string;
  state: string;
  years: Record<string, SopYearData>;
}

/** A state whose SERC publishes a Standards-of-Performance regulation with named indicators and
 * benchmarks, but for which no licensee reported figures were available to check against them —
 * so no compliance score can be computed. Kept separate from `SopDiscom` rather than folded in
 * with an all-zero score, which would misleadingly read as "failing" rather than "no data". */
export interface SopFramework {
  state: string;
  regulation: string;
  indicators: SopIndicator[];
}

export interface StateSpecificData {
  state_order: string[];
  years: string[];
  discoms: SopDiscom[];
  frameworks: SopFramework[];
}

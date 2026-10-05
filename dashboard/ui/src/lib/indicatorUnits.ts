import { fmt } from './format';

/** Dashboard presentation metadata — NOT sourced from either workbook as its own column. Neither
 * dataset has a display-unit field: each record only carries a free-text `reported_meaning`
 * ("Total minutes of supply interruption for an average consumer over the year.") describing what
 * its reported figure measures. This table maps every distinct such description found across both
 * workbooks (Common Indicators / State specific Indicators, as of the Oct 2026 versions) and the
 * extracted JSON to a short display unit, by hand, from what that exact text literally says — never
 * by truncating it, and never from the indicator's name.
 *
 * Keyed by the description, not the indicator, for the same reason as `indicatorDirection.ts`: one
 * indicator can be reported on different bases by different DISCOMs/years (Rajasthan SAIDI is
 * "minutes per year" for most years but "hours per quarter" for AVVNL FY23–24), and those must stay
 * distinguishable rather than share one label. Placeholder descriptions ("N/A", "No data furnished
 * by the licensee", "Value reported as NIL", the sheets' own header text read in as a row, ...) are
 * deliberately absent, as is any wording a future extraction introduces — those resolve to `null`
 * ("unit not stated") rather than a guess. The full source description always stays available
 * alongside (definition view, cell detail). */

export interface DisplayUnit {
  /** concise unit text shown in headers, axis titles and cell detail */
  label: string;
  /** 'percent' values render with a trailing "%"; 'number' values render bare, unit shown beside */
  format: 'percent' | 'number';
}

const pct = (label: string): DisplayUnit => ({ label, format: 'percent' });
const num = (label: string): DisplayUnit => ({ label, format: 'number' });

export function normalizeMeaning(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.trim().replace(/\s+/g, ' ').replace(/\.+$/, '').trim().toLowerCase();
  return t || null;
}

const MEANING_UNIT: Record<string, DisplayUnit> = {
  // --- reliability indices (SAIDI / SAIFI / MAIFI / CAIDI) ---
  'total minutes of supply interruption for an average consumer over the year': num('minutes / consumer / year'),
  'total minutes of supply interruption for an average consumer over the year (derived from quarterly averages)': num('minutes / consumer / year'),
  'total minutes of supply interruption for an average consumer over the year (derived)': num('minutes / consumer / year'),
  'total minutes of supply interruption for an average consumer over two quarters': num('minutes / consumer / two quarters'),
  'total hours of supply interruption for an average consumer over the year': num('hours / consumer / year'),
  'average hours of supply interruption for an average consumer per quarter': num('hours / consumer / quarter'),
  'total number of sustained interruptions for an average consumer over the year': num('interruptions / consumer / year'),
  'total number of sustained interruptions for an average consumer over the year (derived from quarterly averages)': num('interruptions / consumer / year'),
  'total number of sustained interruptions for an average consumer over the year (derived)': num('interruptions / consumer / year'),
  'total number of sustained interruptions per consumer for the year': num('interruptions / consumer / year'),
  'total number of sustained interruptions for an average consumer over two quarters': num('interruptions / consumer / two quarters'),
  'average number of sustained interruptions for an average consumer per quarter': num('interruptions / consumer / quarter'),
  'total number of momentary interruptions for an average consumer over the year': num('momentary interruptions / consumer / year'),
  'total number of momentary interruptions per consumer for the year': num('momentary interruptions / consumer / year'),
  // Odisha's MAIFI rows say "average interruptions"; MAIFI is the momentary-interruption index, so
  // it shares the other DISCOMs' label (the source wording stays visible as the metric text)
  'total number of average interruptions for an average consumer over the year': num('momentary interruptions / consumer / year'),
  'average minutes taken to restore supply for each interruption event over the year': num('minutes'),
  'average minutes taken to restore supply for each interruption event over two quarters': num('minutes'),
  'average restoration time (minutes) for interrupted consumers over the year': num('minutes'),
  'total minutes of restoration time for consumers who experienced interruptions': num('minutes'),

  // --- "% of cases / complaints / calls resolved in time" family (one label: a complaint is a case,
  // and Odisha's series switch wording year to year for the same measure) ---
  '% of cases resolved within specified time/standard': pct('% of cases'),
  '% of cases resolved within specified time/standard during the year': pct('% of cases'),
  '% of cases resolved within the specified time limit': pct('% of cases'),
  '% of cases resolved against the benchmark': pct('% of cases'),
  '% of cases complying with the specified maximum-duration standard': pct('% of cases'),
  '% of cases in which supply was restored within the specified time': pct('% of cases'),
  '% of cases resolved within stipulated time : for current bills where no additional information is required; where additional information relating to correctness of reading etc. is required':
    pct('% of cases'),
  '% of complaints redressal in time': pct('% of cases'),
  '% of complaints redressed in time': pct('% of cases'),
  '% of registered complaints redressed in standard time': pct('% of cases'),
  '% of complaints resolved within the specified 30-day time standard during the year': pct('% of cases'),
  '% of calls rectified within the specified time limits': pct('% of calls'),
  '% of connections released out of the total applications': pct('% of applications'),
  '% of dtrs replaced within the specified time limits': pct('% of DTRs'),

  // --- power quality ---
  '% of sample tests showing nil deviation from prescribed standards': pct('% of sample tests'),
  '% compliance': pct('% compliance'),
  '% deviation': pct('% deviation'),
  '% cases exceeding voltage limits for eht and lt': pct('% of cases'),
  'zero cases exceeding voltage limits for eht and lt': num('number of cases'),
  'zero cases exceeding voltage limits for eht and lt were reported': num('number of cases'),
  'nine cases exceeding voltage limits for ht': num('number of cases'),
  'cases exceeding voltage limits for ht were reported': num('number of cases'),
  'zero formal consumer complaints recieved': num('number of cases'),
  'no. of deviation of results from the sample test': num('number of deviations'),
  'no. of cases in which voltage at the point of commencement of supply exceeded 3% of the voltage limits': num('number of cases'),
  'no. of hourly measurement in which the supply frequency went beyond + 3%': num('number of hourly measurements'),

  // --- equipment, metering, billing, losses ---
  '% failure rate of distribution transformer': pct('% failure rate'),
  '% failure rate of distribution transformer for the year': pct('% failure rate'),
  'no. of faulty bills prepared as a percentage of total no. of bills issued': pct('% of bills'),
  'no. of faulty/defective meters as a percentage of total no. of existing meters': pct('% of meters'),
  'no. of faulty meters pending at year-end': num('number of meters'),
  'total no. of faulty meters pending at year-end': num('number of meters'),
  '% atc loss': pct('% AT&C loss'),
  '% system loss': pct('% system loss'),
  '% system loss (first half and second half)': pct('% system loss'),

  // --- safety, administration ---
  'no. of accident cases': num('number of cases'),
  'number of accidents': num('number of accidents'),
  'total no. of help desk established': num('number of help desks'),
  'no. of help desk established in time': num('number of help desks'),
};

export function displayUnitForMeaning(reportedMeaning: string | null | undefined): DisplayUnit | null {
  const norm = normalizeMeaning(reportedMeaning);
  if (!norm) return null;
  return MEANING_UNIT[norm] ?? null;
}

/** A value rendered in its own unit's style — "98.4%" for a percentage unit, a bare "221.62" for
 * anything else (whose unit is shown beside it, never glued on). `null` unit = not stated in the
 * source, so the number is shown bare. Missing values read "N/A" (see CLAUDE.md). */
export function formatInUnit(v: number | null | undefined, unit: DisplayUnit | null): string {
  if (v == null || Number.isNaN(v)) return 'N/A';
  return fmt(v, 2) + (unit?.format === 'percent' ? '%' : '');
}

/** Sentence-cased unit for an axis title ("Minutes / consumer / year") — the DTRs/AT&C acronyms
 * are left alone since they're already capitalised. */
export function axisTitleForUnit(unit: DisplayUnit | null): string {
  if (!unit) return 'Unit not stated in source';
  return unit.label.charAt(0).toUpperCase() + unit.label.slice(1);
}

/** Every placeholder description seen in the data that names no unit at all — not used for display
 * logic (anything unmapped already resolves to `null`), only so the coverage check below can tell
 * an intentional "no unit" apart from a description nobody has looked at yet. */
export const PLACEHOLDER_MEANINGS = new Set([
  'n/a',
  'no',
  'no cases',
  'value reported as nil',
  'no data furnished by the licensee',
  'no data furnished by the licensee for this period',
  'data for harmonic levels was not reported in this period',
  'data for average restoration time not listed in the overall standard reporting table',
  // the sheets' own header row text, read in as data on a few sheets
  'reported data meaning',
  'comparison possible?',
]);

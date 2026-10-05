/** Dashboard interpretation metadata for trend assessment — NOT sourced from either workbook.
 * Kept in its own module, separate from the extracted JSON, so it is always auditable as an
 * explicit dashboard decision rather than something silently baked into the extraction pipeline.
 *
 * Direction can't safely be keyed by the *canonical* reliability indicator name (SAIDI, VOLTAGE
 * VARIATION, ...) the way it might first seem: canonical_order groups together raw sheet rows that
 * turned out, on inspection of their own `reported_meaning` field, to describe genuinely different
 * things depending on the DISCOM/year. For example, under the canonical key "TRANSFORMER FAILURE"
 * some rows report "% of cases resolved within specified time/standard" (higher is better — a
 * resolution rate) while others report "% failure rate of Distribution transformer" (lower is
 * better — an actual failure rate) — opposite directions under the same canonical bucket. The same
 * split happens under "VOLTAGE VARIATION" (compliance-% rows vs. limit-exceedance-count rows). So
 * direction is assigned per the exact `reported_meaning` text each record already carries (itself a
 * source-extracted definition of what the reported figure means), not per indicator label —
 * `directionForMeaning` below. Any wording not in this table — including anything new a future
 * extraction run introduces — falls through to `direction_unknown` rather than guessing.
 */
export type Direction = 'higher_is_better' | 'lower_is_better' | 'direction_unknown';

function normalizeMeaning(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\.+$/, '')
    .trim()
    .toLowerCase();
  return t || null;
}

/** Every distinct `reported_meaning` string found (as of this writing) across discoms2.json and
 * state_specific.json that unambiguously states which way is an improvement, lowercased and with
 * any trailing period stripped (see `normalizeMeaning`). Meanings that are placeholders rather than
 * definitions ("N/A", "No data furnished...", "Value reported as NIL", ...) are deliberately
 * omitted, as are a handful of genuinely ambiguous ones ("Total no. of help desk established",
 * "No. of deviation of results from the sample test") — all of those fall through to
 * `direction_unknown` by simply not appearing here. */
const MEANING_DIRECTION: Record<string, Direction> = {
  // --- reliability dataset (discoms2.json) ---
  'total minutes of supply interruption for an average consumer over the year': 'lower_is_better',
  'total minutes of supply interruption for an average consumer over the year (derived from quarterly averages)': 'lower_is_better',
  'total minutes of supply interruption for an average consumer over the year (derived)': 'lower_is_better',
  'total number of sustained interruptions for an average consumer over the year (derived from quarterly averages)': 'lower_is_better',
  'total number of sustained interruptions for an average consumer over the year (derived)': 'lower_is_better',
  'total minutes of supply interruption for an average consumer over two quarters': 'lower_is_better',
  'average hours of supply interruption for an average consumer per quarter': 'lower_is_better',
  'total hours of supply interruption for an average consumer over the year': 'lower_is_better',
  'total number of sustained interruptions for an average consumer over the year': 'lower_is_better',
  'total number of sustained interruptions for an average consumer over two quarters': 'lower_is_better',
  'average number of sustained interruptions for an average consumer per quarter': 'lower_is_better',
  'total number of sustained interruptions per consumer for the year': 'lower_is_better',
  'total number of momentary interruptions for an average consumer over the year': 'lower_is_better',
  'total number of average interruptions for an average consumer over the year': 'lower_is_better',
  'total number of momentary interruptions per consumer for the year': 'lower_is_better',
  'average minutes taken to restore supply for each interruption event over the year': 'lower_is_better',
  'average minutes taken to restore supply for each interruption event over two quarters': 'lower_is_better',
  'average restoration time (minutes) for interrupted consumers over the year': 'lower_is_better',
  'total minutes of restoration time for consumers who experienced interruptions': 'lower_is_better',
  '% of cases resolved within specified time/standard': 'higher_is_better',
  '% of cases resolved within specified time/standard during the year': 'higher_is_better',
  '% of sample tests showing nil deviation from prescribed standards': 'higher_is_better',
  '% compliance': 'higher_is_better',
  'zero formal consumer complaints recieved': 'lower_is_better',
  'zero cases exceeding voltage limits for eht and lt': 'lower_is_better',
  'zero cases exceeding voltage limits for eht and lt were reported': 'lower_is_better',
  '% cases exceeding voltage limits for eht and lt': 'lower_is_better',
  'nine cases exceeding voltage limits for ht': 'lower_is_better',
  'cases exceeding voltage limits for ht were reported': 'lower_is_better',
  '% failure rate of distribution transformer for the year': 'lower_is_better',
  '% failure rate of distribution transformer': 'lower_is_better',
  '% of dtrs replaced within the specified time limits': 'higher_is_better',
  '% of cases resolved against the benchmark': 'higher_is_better',
  '% of complaints resolved within the specified 30-day time standard during the year': 'higher_is_better',
  '% of cases resolved within stipulated time : for current bills where no additional information is required; where additional information relating to correctness of reading etc. is required':
    'higher_is_better',

  // --- Standards of Performance dataset (state_specific.json) ---
  '% of cases resolved within the specified time limit': 'higher_is_better',
  '% of calls rectified within the specified time limits': 'higher_is_better',
  '% of cases complying with the specified maximum-duration standard': 'higher_is_better',
  '% of cases in which supply was restored within the specified time': 'higher_is_better',
  '% of complaints redressal in time': 'higher_is_better',
  '% of complaints redressed in time': 'higher_is_better',
  '% of registered complaints redressed in standard time': 'higher_is_better',
  '% of connections released out of the total applications': 'higher_is_better',
  'no. of faulty bills prepared as a percentage of total no. of bills issued': 'lower_is_better',
  'no. of faulty/defective meters as a percentage of total no. of existing meters': 'lower_is_better',
  'no. of faulty meters pending at year-end': 'lower_is_better',
  'total no. of faulty meters pending at year-end': 'lower_is_better',
  'no. of accident cases': 'lower_is_better',
  'number of accidents': 'lower_is_better',
  '% atc loss': 'lower_is_better',
  '% system loss': 'lower_is_better',
  '% system loss (first half and second half)': 'lower_is_better',
  'no. of hourly measurement in which the supply frequency went beyond + 3%': 'lower_is_better',
  'no. of cases in which voltage at the point of commencement of supply exceeded 3% of the voltage limits':
    'lower_is_better',
};

export function directionForMeaning(reportedMeaning: string | null | undefined): Direction {
  const norm = normalizeMeaning(reportedMeaning);
  if (!norm) return 'direction_unknown';
  return MEANING_DIRECTION[norm] ?? 'direction_unknown';
}

/** Coarse, literal signal of the unit/period a reported figure is actually on — used only to catch
 * an explicit basis change within one series (e.g. one year's meaning says "minutes", another
 * year's says "hours"; one says "quarter", another says "year"). Deliberately shallow: it only
 * flags a conflict when both sides name a basis explicitly and disagree, never when one side is
 * simply silent about it, since terse wording is common and isn't itself evidence of a changed
 * metric. See CLAUDE.md — SAIDI has a documented real case of a DISCOM reporting in minutes where
 * others reported hours. */
export interface BasisSignature {
  unit: 'min' | 'hr' | 'na';
  period: 'quarter' | 'year' | 'na';
}

export function basisSignature(reportedMeaning: string | null | undefined): BasisSignature {
  const norm = normalizeMeaning(reportedMeaning) ?? '';
  const unit = norm.includes('minute') ? 'min' : norm.includes('hour') ? 'hr' : 'na';
  // period ignores parenthetical method notes — "over the year (derived from quarterly averages)" is
  // an annual figure, and its "quarterly" must not read as a quarterly basis
  const p = norm.replace(/\([^)]*\)/g, '');
  const period = p.includes('quarter') ? 'quarter' : p.includes('year') ? 'year' : 'na';
  return { unit, period };
}

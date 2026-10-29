import type { MasterRow } from './types';

/** The headline number written in a master-sheet row, for charts: "FY within-time share: 99.50%"
 * → 99.5 %, "FY SAIDI: 1,947 minutes per consumer." → 1947 minutes per consumer. Read from
 * `standardised_data` (the sheet's one-line FY summary), else `reported_data`. Only a number that
 * is written is ever returned; nothing is converted, added up or estimated. The sentence itself is
 * still what the page shows on hover. (User, 28 Oct 2026: "you need to pull numbers out of the
 * sentences".)
 *
 * Returns null when there is no single clear figure with a clear unit: "Not available…" text, a
 * row of quarter values with no FY figure, or a unit the sheet marks as unknown ("unit as printed,
 * unresolved", "basis not stated", "not standardised"). */
export interface Headline {
  value: number;
  /** display unit, e.g. "%", "minutes per consumer", "interruptions per kW of connected load" */
  unit: string;
  /** the number exactly as written ("1,947", "99.50%"), for labels */
  text: string;
}

const NONE = /^\s*(not|no|nil|n\/a|none)\b/i;
const UNKNOWN_BASIS = /unresolved|basis not stated|not standardised|unit basis|not annualised/i;
// dates, years, quarter names and voltage levels, which are numbers but never the figure
const NOT_FIGURES = /FY\s*\d{2,4}(-\d{2,4})?|\b(19|20)\d{2}(-\d{2})?\b|\bQ[1-4]\b|[A-Z][a-z]{2}-\d{2}|\b\d{1,2}\s*kV\b|within \d+\s*(hours?|hrs|days?)/gi;
const NUMBER = /(\d[\d,]*(?:\.\d+)?)\s*(%|minutes|mins|hours|hrs|momentary interruptions|interruptions|nos\b|times|accidents|complaints)?/i;

function basis(after: string): string | null {
  const t = after.toLowerCase();
  if (/per\s+kw|kw of connected/.test(t)) return 'per kW of connected load';
  if (/connected load/.test(t)) return 'per unit of connected load';
  if (/consumer|customer/.test(t)) return 'per consumer';
  if (/^\s*per day/.test(t)) return 'per day';
  return null;
}

export function headlineFigure(r: MasterRow): Headline | null {
  const sentence = r.standardised_data ?? r.reported_data;
  if (!sentence || NONE.test(sentence) || UNKNOWN_BASIS.test(sentence)) return null;
  // quarter-by-quarter values with no FY figure: no single number for the year
  if (!r.standardised_data && /\bQ[1-4]\b.*\bQ[2-4]\b/.test(sentence)) return null;

  // a row naming several indices ("SAIFI 188.09; SAIDI 38,658 minutes"): the one this family is
  const fam = r.indicator_family.toUpperCase();
  let s = sentence;
  if (/^(SAIDI|SAIFI|CAIDI|MAIFI)$/.test(fam)) {
    const at = s.toUpperCase().indexOf(fam);
    if (at >= 0) s = s.slice(at + fam.length);
  }
  s = s.replace(NOT_FIGURES, ' ');

  const m = NUMBER.exec(s);
  if (!m) return null;
  const value = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(value)) return null;
  const word = (m[2] ?? '').toLowerCase();
  const after = s.slice(m.index + m[0].length, m.index + m[0].length + 80);

  const text = word === '%' ? `${m[1]}%` : m[1];
  if (word === '%') return { value, unit: '%', text };
  // no basis written beside the number ("FY SAIFI: 91.44 Nos.", "FY SAIDI: 10,344 minutes."): the
  // row's own `unit` column, only where it names the same measure (user, 29 Oct 2026)
  const sheet = (r.unit ?? '').toLowerCase();
  const per = basis(after);
  if (word === 'minutes' || word === 'mins')
    return per ? { value, unit: `minutes ${per}`, text } : sheet.startsWith('minutes per') ? { value, unit: sheet, text } : null;
  if (word === 'hours' || word === 'hrs')
    return per ? { value, unit: `hours ${per}`, text } : sheet.startsWith('hours per') ? { value, unit: sheet, text } : null;
  if (word === 'momentary interruptions')
    return per ? { value, unit: `momentary interruptions ${per}`, text } : sheet.startsWith('momentary interruptions per') ? { value, unit: sheet, text } : null;
  if (word === 'interruptions' || word === 'nos' || word === 'times')
    return per ? { value, unit: `interruptions ${per}`, text } : sheet.startsWith('interruptions per') ? { value, unit: sheet, text } : null;
  if ((word === 'accidents' || word === 'complaints') && sheet === 'count') return { value, unit: word, text };
  return null;
}

import { fyLabel } from './format';
import { evidenceStatus } from './evidenceStatus';
import { assessYearOverYear } from './trend';
import type { CardSeries, IndicatorContext } from './indicatorContext';

/** Plain, deterministic observations for the "What this shows" panel. Every sentence restates
 * something already on screen — which years have a reported value, each DISCOM's first and last
 * reported figure (and any lower/higher point in between), the count of year-on-year changes the
 * values strip already colours as improved/declined, and the comparability / standard-met status
 * recorded in the source. No score, ranking, cause or adjective of magnitude is ever produced. */

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const num = (n: number) => NUMBER_WORDS[n] ?? String(n);

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function buildInsights(series: CardSeries[], ctx: IndicatorContext, yearsAsc: string[], unitSuffix: (v: number) => string): string[] {
  const out: string[] = [];
  const nYears = yearsAsc.length;
  const range = nYears > 1 ? `${fyLabel(yearsAsc[0])}–${fyLabel(yearsAsc[nYears - 1])}` : fyLabel(yearsAsc[0] ?? '');
  const who = series.length === 1 ? series[0].label : series.length === 2 ? 'both DISCOMs' : `all ${num(series.length)} DISCOMs`;

  // ---- coverage ----
  const gaps = series.map((s) => ({ label: s.label, missing: s.points.filter((p) => p.value == null).map((p) => fyLabel(p.year)) }));
  const anyValue = series.some((s) => s.points.some((p) => p.value != null));
  if (!anyValue) {
    out.push(`No reported values are available for ${who} in any year from ${range}.`);
  } else if (gaps.every((g) => g.missing.length === 0)) {
    out.push(`Reported values are available for ${who} across all ${num(nYears)} years (${range}).`);
  } else {
    const withGaps = gaps.filter((g) => g.missing.length > 0);
    const parts = withGaps.map((g) => (g.missing.length === nYears ? `${g.label} (no year reported)` : `${g.label} (${listJoin(g.missing)})`));
    out.push(`Reported values are missing for ${listJoin(parts)}; every other DISCOM-year shown has a reported figure.`);
  }

  // ---- movement over the period, per DISCOM ----
  for (const s of series) {
    const present = s.points.filter((p): p is typeof p & { value: number } => p.value != null);
    if (present.length < 2) continue;
    const first = present[0];
    const last = present[present.length - 1];
    let sentence = `${s.label} reported ${unitSuffix(first.value)} in ${fyLabel(first.year)} and ${unitSuffix(last.value)} in ${fyLabel(last.year)}`;
    // an interior low/high (a turning point between the two ends) — stated, not characterised
    const interior = present.slice(1, -1);
    if (interior.length) {
      const lo = interior.reduce((a, b) => (b.value < a.value ? b : a));
      const hi = interior.reduce((a, b) => (b.value > a.value ? b : a));
      const endsMin = Math.min(first.value, last.value);
      const endsMax = Math.max(first.value, last.value);
      const extras: string[] = [];
      if (lo.value < endsMin) extras.push(`a low of ${unitSuffix(lo.value)} in ${fyLabel(lo.year)}`);
      if (hi.value > endsMax) extras.push(`a high of ${unitSuffix(hi.value)} in ${fyLabel(hi.year)}`);
      if (extras.length) sentence += `, with ${listJoin(extras)}`;
    }
    // the same year-on-year classification the values strip colours, tallied
    let improved = 0;
    let declined = 0;
    for (let i = 1; i < s.points.length; i++) {
      const st = assessYearOverYear(s.points[i - 1], s.points[i]).status;
      if (st === 'improved') improved++;
      else if (st === 'declined') declined++;
    }
    if (improved + declined > 0) {
      const bits = [improved ? `${num(improved)} improved` : null, declined ? `${num(declined)} declined` : null].filter(Boolean) as string[];
      sentence += ` (year-on-year: ${bits.join(', ')})`;
    }
    out.push(sentence + '.');
  }

  // ---- comparability with the regulatory standard ----
  if (ctx.sharedVerdict === 'not-comparable') {
    const reason = ctx.sharedAdvisory?.constantReason;
    const scope = ctx.sharedAdvisory && ctx.sharedAdvisory.head !== 'Not comparable across all years shown' ? ctx.sharedAdvisory.head.replace(/^Not comparable/, '') : ''; // e.g. " in 2 of 5 years"
    out.push(`Direct comparison with the regulatory standard is unavailable${scope}${reason ? ` — ${reason.replace(/\.$/, '')}` : ''}.`);
  } else if (ctx.sharedVerdict === 'unavailable') {
    out.push('The source data does not record whether these figures can be compared with the regulatory standard.');
  } else if (ctx.sharedVerdict == null && series.length > 1) {
    out.push('Whether the reported figures can be compared with the regulatory standard differs between DISCOMs.');
  }

  // ---- standard met / not met, where the source records it ----
  for (const s of series) {
    const met = s.points.filter((p) => evidenceStatus(p) === 'met').map((p) => fyLabel(p.year));
    const notMet = s.points.filter((p) => evidenceStatus(p) === 'not-met').map((p) => fyLabel(p.year));
    if (!met.length && !notMet.length) continue;
    const bits = [met.length ? `met the standard in ${listJoin(met)}` : null, notMet.length ? `did not meet it in ${listJoin(notMet)}` : null].filter(Boolean) as string[];
    out.push(`${s.label} ${listJoin(bits)}, as recorded in the source.`);
  }

  return out;
}

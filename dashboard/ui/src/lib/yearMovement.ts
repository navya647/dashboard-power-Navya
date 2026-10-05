import { basisSignature, directionForMeaning } from './indicatorDirection';
import { displayUnitForMeaning } from './indicatorUnits';
import type { CardPoint } from './indicatorContext';

/** Year-on-year movement for the indicator module's year-wise values. Two deliberately separate
 * facts:
 *
 * - `arrow` is purely NUMERICAL movement versus the previous year that actually has a reported
 *   value (skipping years with none): ↑ increased, ↓ decreased, ○ unchanged. It never implies
 *   better or worse.
 * - `performance` is only set when the explicit direction metadata (`indicatorDirection.ts`, keyed
 *   on each record's own reported-metric text) establishes which way is better for BOTH years;
 *   otherwise it is 'unknown' and the UI must not call the movement an improvement or decline.
 *
 * No movement is computed at all ('basis-changed') when the two years' figures are on different
 * reporting bases — a different display unit (minutes/year vs hours/quarter), or an explicit
 * minutes/hours or quarter/year conflict in their descriptions — since subtracting them would
 * compare different things. */

export type Performance = 'improved' | 'worsened' | 'no-change' | 'unknown';

export type Movement =
  | { kind: 'first' }
  | { kind: 'no-value' }
  | { kind: 'no-previous' }
  | { kind: 'basis-changed'; prevYear: string }
  | { kind: 'moved'; arrow: '↑' | '↓' | '○'; delta: number; prevYear: string; prevValue: number; performance: Performance };

export function movementAt(points: CardPoint[], i: number): Movement {
  const curr = points[i];
  if (curr.value == null || Number.isNaN(curr.value)) return { kind: 'no-value' };
  if (i === 0) return { kind: 'first' };

  let j = i - 1;
  while (j >= 0 && (points[j].value == null || Number.isNaN(points[j].value as number))) j -= 1;
  if (j < 0) return { kind: 'no-previous' };
  const prev = points[j];

  const prevUnit = displayUnitForMeaning(prev.reportedMeaning)?.label ?? null;
  const currUnit = displayUnitForMeaning(curr.reportedMeaning)?.label ?? null;
  const pb = basisSignature(prev.reportedMeaning);
  const cb = basisSignature(curr.reportedMeaning);
  const unitConflict = prevUnit !== currUnit || (pb.unit !== 'na' && cb.unit !== 'na' && pb.unit !== cb.unit);
  const periodConflict = pb.period !== 'na' && cb.period !== 'na' && pb.period !== cb.period;
  if (unitConflict || periodConflict) return { kind: 'basis-changed', prevYear: prev.year };

  const delta = (curr.value as number) - (prev.value as number);
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '○';

  const dPrev = directionForMeaning(prev.reportedMeaning);
  const dCurr = directionForMeaning(curr.reportedMeaning);
  let performance: Performance = 'unknown';
  if (delta === 0) performance = 'no-change';
  else if (dCurr !== 'direction_unknown' && dCurr === dPrev) {
    performance = (dCurr === 'higher_is_better') === delta > 0 ? 'improved' : 'worsened';
  }

  return { kind: 'moved', arrow, delta, prevYear: prev.year, prevValue: prev.value as number, performance };
}

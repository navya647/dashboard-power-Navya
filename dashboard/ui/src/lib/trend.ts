import { basisSignature, directionForMeaning } from './indicatorDirection';

export type YoyStatus = 'improved' | 'declined' | 'no-change' | 'not-assessable';

export interface YoyResult {
  status: YoyStatus;
  /** The raw numerical direction of movement (curr vs. prev) — independent of whether that
   * movement counts as an improvement. A lower_is_better indicator that fell still shows a down
   * arrow; only the color/status says that's an improvement. '○' when no numeric comparison was
   * possible at all. */
  arrow: '↑' | '↓' | '→' | '○';
}

export interface YoyPoint {
  value: number | null;
  /** The record's own stated definition of what `value` measures — the basis for direction, see
   * `lib/indicatorDirection.ts`. Never the indicator name, benchmark, or the value itself. */
  reportedMeaning: string | null;
}

export const YOY_META: Record<YoyStatus, { text: string; cls: string }> = {
  improved: { text: 'Improved', cls: 'yoy-improved' },
  declined: { text: 'Declined', cls: 'yoy-declined' },
  'no-change': { text: 'No change', cls: 'yoy-no-change' },
  'not-assessable': { text: 'Not assessable', cls: 'yoy-not-assessable' },
};

/** Year-on-year performance assessment used everywhere it's shown (main dashboard chart cards and
 * the Compare page) — see CLAUDE.md working preferences and DataRules.tsx's "Trend Assessment"
 * section. Compares one fiscal year's reported value against the *immediately preceding* fiscal
 * year in the displayed period — never an earlier usable year found by skipping past a missing one,
 * so a gap always reads as Not assessable for the year right after it, not a silently-bridged
 * comparison. Callers are responsible for passing the actual previous slot in the displayed
 * sequence (`undefined` only for the very first displayed year, which has no preceding year at all
 * and is rendered as "—", not "Not assessable" — see EvidenceRail.tsx). */
export function assessYearOverYear(prev: YoyPoint, curr: YoyPoint): YoyResult {
  if (prev.value == null || curr.value == null || Number.isNaN(prev.value) || Number.isNaN(curr.value)) {
    return { status: 'not-assessable', arrow: '○' };
  }

  const prevDirection = directionForMeaning(prev.reportedMeaning);
  const currDirection = directionForMeaning(curr.reportedMeaning);
  if (prevDirection === 'direction_unknown' || currDirection === 'direction_unknown' || prevDirection !== currDirection) {
    return { status: 'not-assessable', arrow: '○' };
  }

  const prevBasis = basisSignature(prev.reportedMeaning);
  const currBasis = basisSignature(curr.reportedMeaning);
  const unitConflict = prevBasis.unit !== 'na' && currBasis.unit !== 'na' && prevBasis.unit !== currBasis.unit;
  const periodConflict = prevBasis.period !== 'na' && currBasis.period !== 'na' && prevBasis.period !== currBasis.period;
  if (unitConflict || periodConflict) {
    return { status: 'not-assessable', arrow: '○' };
  }

  const delta = curr.value - prev.value;
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  if (delta === 0) return { status: 'no-change', arrow };

  const improved = currDirection === 'higher_is_better' ? delta > 0 : delta < 0;
  return { status: improved ? 'improved' : 'declined', arrow };
}

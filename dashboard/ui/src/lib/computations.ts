import { CATEGORICAL, MAP_STATUS } from './colors';
import type { AccessibilityData, Discom, DiscomAccessibility, DiscomsData, StateSpecificData } from './types';

export function indicatorsInScope(discoms: DiscomsData, group: string, indicator: string): string[] {
  return discoms.canonical_order.filter((k) => {
    if (indicator !== 'all') return k === indicator;
    if (group !== 'all') return discoms.canonical_indicators[k].group === group;
    return true;
  });
}

/** Color assigned to a state currently in the comparison set, by selection order (null if not selected). */
export function compareColor(compareSet: string[], name: string): string | null {
  const idx = compareSet.indexOf(name);
  return idx === -1 ? null : CATEGORICAL[idx % CATEGORICAL.length];
}

/** Whether the Standards-of-Performance dataset has anything at all to show for this state — a
 * per-DISCOM sheet with its own SoP indicators, or (for the 5 states with no reported SoP figures
 * at all) the regulatory-framework listing. Either is real page content, even when every reported
 * value in it is null. Used only to widen "in scope" — see stateIsTracked — never treated as
 * "has reported data" on its own (a framework listing has no reported figures by definition). */
export function stateHasSopData(stateSpecific: StateSpecificData | null | undefined, state: string): boolean {
  if (!stateSpecific) return false;
  return stateSpecific.discoms.some((d) => d.state === state) || stateSpecific.frameworks.some((f) => f.state === state);
}

/** Whether this state is in ACPET's scope at all (year-independent) — gates whether it's on the
 * map as anything but "Coming soon". True if either dataset tracks it, even if neither has a
 * reported figure yet (see stateMapStatus for the "tracked but no data" split). */
export function stateIsTracked(discoms: Discom[], state: string, stateSpecific?: StateSpecificData | null): boolean {
  return discoms.some((d) => d.state === state) || stateHasSopData(stateSpecific, state);
}

/** Whether this state has an actual reported figure anywhere — a reliability indicator value, or
 * a SoP indicator's reported value — in any year, in either dataset. A SoP regulatory-framework
 * listing alone (standards and benchmarks with no reported data by definition) does NOT count:
 * this specifically answers "is there real performance data to explore", which is what
 * distinguishes the map's "Tracked" fill from "Tracked — Data Not Reported". */
export function stateHasReportedData(discoms: Discom[], state: string, stateSpecific?: StateSpecificData | null): boolean {
  const reliabilityReported = discoms
    .filter((d) => d.state === state)
    .some((d) => Object.values(d.years).some((y) => Object.values(y.indicators).some((i) => i.value != null)));
  if (reliabilityReported) return true;
  return !!stateSpecific?.discoms
    .filter((d) => d.state === state)
    .some((d) => Object.values(d.years).some((y) => y.indicators.some((i) => i.reported != null)));
}

export type StateMapStatus = 'tracked' | 'no-data' | 'idle';

/** Three-way map status for a state: 'idle' (outside ACPET's scope in both datasets — "Coming
 * soon", not clickable), 'no-data' (in scope, but no reported figure anywhere yet — still
 * clickable, since a SoP framework listing or an all-null DISCOM sheet is real content worth
 * seeing, just not performance data), or 'tracked' (has an actual reported figure somewhere). */
export function stateMapStatus(discoms: Discom[], state: string, stateSpecific?: StateSpecificData | null): StateMapStatus {
  if (!stateIsTracked(discoms, state, stateSpecific)) return 'idle';
  return stateHasReportedData(discoms, state, stateSpecific) ? 'tracked' : 'no-data';
}

/** Map fill by status — a muted terracotta/clay for states with reported data, a lighter tint of
 * that same clay for states entirely outside ACPET's tracked scope, and an off-white for
 * tracked states still awaiting reported data. */
export function stateFillColor(status: StateMapStatus): string {
  if (status === 'tracked') return MAP_STATUS.tracked;
  if (status === 'no-data') return MAP_STATUS.noData;
  return MAP_STATUS.idle;
}

/** One state's direct aggregation of its licensees' accessibility booleans — a count/percentage
 * summary, never a weighted or composite score. `publishedPct`/`machineReadablePct` are `null`
 * only when the state has zero tracked licensees to divide by. */
export interface StateAccessibilityCoverage {
  state: string;
  regulationAvailable: boolean | null;
  licenseeCount: number;
  publishedCount: number;
  machineReadableCount: number;
  publishedPct: number | null;
  machineReadablePct: number | null;
}

/** The single source of truth for a DISCOM's *displayed* machine-readability — never
 * independently "not machine-readable" when performance data was never published at all, since
 * machine readability is only a meaningful question once something has actually been published.
 * Today's workbook always leaves `machine_readable` null/blank for an unpublished row (see
 * `extraction_accessibility.py`'s `to_bool()`), but nothing in the type system enforces that
 * convention — every place this page shows or filters on machine-readability derives it from this
 * function (which forces `null` whenever `available_on_serc` isn't `true`) rather than trusting
 * `d.machine_readable` directly, so a future data-entry mistake (e.g. `available_on_serc: false,
 * machine_readable: true`) can never surface as a contradictory or misleading status. */
export function machineReadableDisplayStatus(d: DiscomAccessibility): boolean | null {
  return d.available_on_serc === true ? d.machine_readable : null;
}

/** A DISCOM has an accessibility gap when its performance data isn't published at all, OR is
 * published but not machine-readable — an unpublished DISCOM is never counted as a *second*,
 * separate "not machine-readable" gap. */
export function hasAccessibilityGap(d: DiscomAccessibility): boolean {
  return d.available_on_serc !== true || machineReadableDisplayStatus(d) !== true;
}

export function accessibilityByState(accessibility: AccessibilityData): StateAccessibilityCoverage[] {
  const regByState = new Map(accessibility.states.map((s) => [s.state, s.regulation_available]));
  return accessibility.state_order.map((state) => {
    const group = accessibility.discoms.filter((d) => d.state === state);
    const publishedCount = group.filter((d) => d.available_on_serc === true).length;
    const machineReadableCount = group.filter((d) => machineReadableDisplayStatus(d) === true).length;
    return {
      state,
      regulationAvailable: regByState.get(state) ?? null,
      licenseeCount: group.length,
      publishedCount,
      machineReadableCount,
      publishedPct: group.length ? Math.round((100 * publishedCount) / group.length) : null,
      machineReadablePct: group.length ? Math.round((100 * machineReadableCount) / group.length) : null,
    };
  });
}

/** Sorted for the jurisdiction comparison chart only (machine-readable % desc, then published %
 * desc, then jurisdiction name as a deterministic final tie-break) — every other view (grid,
 * small-multiples, matrix) keeps `state_order` so it stays directly comparable to the source
 * workbook. */
export function sortStatesForComparison(coverage: StateAccessibilityCoverage[]): StateAccessibilityCoverage[] {
  return [...coverage].sort((a, b) => {
    const machineDelta = (b.machineReadablePct ?? -1) - (a.machineReadablePct ?? -1);
    if (machineDelta !== 0) return machineDelta;
    const publishedDelta = (b.publishedPct ?? -1) - (a.publishedPct ?? -1);
    if (publishedDelta !== 0) return publishedDelta;
    return a.state.localeCompare(b.state);
  });
}

/** Direct counts of where accessibility breaks down across every tracked DISCOM — never a
 * derived score. */
export interface AccessibilityGaps {
  notPublished: number;
  publishedNotMachineReadable: number;
}

export function accessibilityGaps(accessibility: AccessibilityData): AccessibilityGaps {
  return {
    notPublished: accessibility.discoms.filter((d) => d.available_on_serc !== true).length,
    publishedNotMachineReadable: accessibility.discoms.filter((d) => d.available_on_serc === true && machineReadableDisplayStatus(d) !== true).length,
  };
}

export function accessibilityGapCount(accessibility: AccessibilityData): number {
  return accessibility.discoms.filter(hasAccessibilityGap).length;
}

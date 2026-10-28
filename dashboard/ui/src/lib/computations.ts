import { CATEGORICAL, MAP_STATUS } from './colors';
import { rowHasReportedFigure } from './master';
import type { AccessibilityData, DiscomAccessibility, MasterData } from './types';

/** Color assigned to a state currently in the comparison set, by selection order (null if not selected). */
export function compareColor(compareSet: string[], name: string): string | null {
  const idx = compareSet.indexOf(name);
  return idx === -1 ? null : CATEGORICAL[idx % CATEGORICAL.length];
}

/** Whether DISCOM_SoP_master.xlsx has any row for this state, gates whether it's on the map as
 * anything but "Coming soon". True even when none of its rows carries a reported figure (see
 * stateMapStatus for the "tracked but no data" split). */
export function stateIsTracked(master: MasterData | null | undefined, state: string): boolean {
  return !!master && master.rows.some((r) => r.state === state);
}

/** Whether any of this state's rows carries a reported figure (rowHasReportedFigure), what
 * distinguishes the map's "Tracked, Data Reported" fill from "Tracked, Data Not Reported". */
export function stateHasReportedData(master: MasterData | null | undefined, state: string): boolean {
  return stateReportedYears(master, state).length > 0;
}

/** The fiscal years (raw "2023-24" keys) in which this state has a reported figure, by the same
 * rule as stateHasReportedData. */
export function stateReportedYears(master: MasterData | null | undefined, state: string): string[] {
  const years = new Set<string>();
  for (const r of master?.rows ?? []) if (r.state === state && rowHasReportedFigure(r)) years.add(r.financial_year);
  return [...years].sort();
}

export type StateMapStatus = 'tracked' | 'no-data' | 'idle';

const statusCache = new WeakMap<MasterData, Map<string, StateMapStatus>>();

/** The one wording for each map status, the home map legend and the state search list (visible
 * swatch labels and screen-reader text) both read from here so they can never drift apart. */
export const MAP_STATUS_LABEL: Record<StateMapStatus, string> = {
  tracked: 'Tracked, Data Reported',
  'no-data': 'Tracked, Data Not Reported',
  idle: 'Coming soon',
};

/** Three-way map status for a state: 'idle' (no rows in the master sheet, "Coming soon", not
 * clickable), 'no-data' (has rows, but none with a reported figure, still clickable, since its
 * standards and the sheet's notes are real content), or 'tracked' (has a reported figure). */
export function stateMapStatus(master: MasterData | null | undefined, state: string): StateMapStatus {
  if (!master) return 'idle';
  // the map asks for every state on every render, so the 12k-row scan runs once per dataset
  let byState = statusCache.get(master);
  if (!byState) {
    byState = new Map();
    for (const r of master.rows) {
      if (rowHasReportedFigure(r)) byState.set(r.state, 'tracked');
      else if (!byState.has(r.state)) byState.set(r.state, 'no-data');
    }
    statusCache.set(master, byState);
  }
  return byState.get(state) ?? 'idle';
}

/** Map fill by status, a muted terracotta/clay for states with reported data, a lighter tint of
 * that same clay for states entirely outside ACPET's tracked scope, and an off-white for
 * tracked states still awaiting reported data. */
export function stateFillColor(status: StateMapStatus): string {
  if (status === 'tracked') return MAP_STATUS.tracked;
  if (status === 'no-data') return MAP_STATUS.noData;
  return MAP_STATUS.idle;
}

/** One state's direct aggregation of its licensees' accessibility booleans, a count/percentage
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

/** The single source of truth for a DISCOM's *displayed* machine-readability, never
 * independently "not machine-readable" when performance data was never published at all, since
 * machine readability is only a meaningful question once something has actually been published.
 * Today's workbook always leaves `machine_readable` null/blank for an unpublished row (see
 * `extraction_accessibility.py`'s `to_bool()`), but nothing in the type system enforces that
 * convention, every place this page shows or filters on machine-readability derives it from this
 * function (which forces `null` whenever `available_on_serc` isn't `true`) rather than trusting
 * `d.machine_readable` directly, so a future data-entry mistake (e.g. `available_on_serc: false,
 * machine_readable: true`) can never surface as a contradictory or misleading status. */
export function machineReadableDisplayStatus(d: DiscomAccessibility): boolean | null {
  return d.available_on_serc === true ? d.machine_readable : null;
}

/** A DISCOM has an accessibility gap when its performance data isn't published at all, OR is
 * published but not machine-readable, an unpublished DISCOM is never counted as a *second*,
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
 * desc, then jurisdiction name as a deterministic final tie-break), every other view (grid,
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

/** Direct counts of where accessibility breaks down across every tracked DISCOM, never a
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

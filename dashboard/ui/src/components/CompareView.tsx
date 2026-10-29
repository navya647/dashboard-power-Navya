'use client';

import '@/lib/chartSetup';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MAP_HREF } from '@/lib/routes';
import { useData } from '@/lib/DataContext';
import { CATEGORICAL } from '@/lib/colors';
import { compareColor, stateHasReportedData } from '@/lib/computations';
import { masterYears, rowsForState, stateDiscoms, type MasterDiscom } from '@/lib/master';
import { plotBenchmark, plotFigure } from '@/lib/plotFigures';
import type { MasterRow } from '@/lib/types';
import DiscomMultiSelect from './DiscomMultiSelect';
import IndicatorSelect, { type IndicatorOption } from './IndicatorSelect';
import MasterIndicator from './MasterIndicator';
import StateShape from './StateShape';

// a row the sheet itself words as the whole DISCOM's figure ("Overall standard", "All feeder
// categories", "… combined") rather than one area's or class's
const OVERALL = /\boverall\b|\ball feeder|\bcombined\b/i;

/** One family's rows, at most one per DISCOM × year where the sheet defensibly gives one: when a
 * DISCOM-year has several rows (urban / rural / overall …) and exactly one is worded as the
 * overall figure, keep only that one; otherwise keep them all, since picking one would be a guess. */
function annualView(rows: MasterRow[]): MasterRow[] {
  const groups = new Map<string, MasterRow[]>();
  for (const r of rows) {
    const k = `${r.indicator_family}|${r.discom_code}|${r.financial_year}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  const keep = new Set<MasterRow>();
  for (const g of groups.values()) {
    const overall = g.filter((r) => OVERALL.test(r.indicator));
    (g.length > 1 && overall.length === 1 ? overall : g).forEach((r) => keep.add(r));
  }
  return rows.filter((r) => keep.has(r));
}

// Rows kept out of the default view only; they stay selectable. A figure stated per kW of connected
// load though the sheet's unit says per consumer (Odisha, TGSPDCL), a year total that disagrees with
// its own quarters (TGNPDCL SAIDI FY26: 1,693 vs about 365), MSEDCL's % shares (12-66%, far below
// every other DISCOM: likely another basis).
const PER_LOAD = /per kw|connected load/i;
const DEFAULT_EXCLUDE = new Set(['TGNPDCL-2025-26-51']);
const figUnit = (r: MasterRow) => (plotFigure(r)?.unit ?? r.unit ?? '').toLowerCase();
const defaultEligible = (r: MasterRow) =>
  !DEFAULT_EXCLUDE.has(r.id) && !PER_LOAD.test(r.reported_data ?? '') && !(r.discom_code === 'MSEDCL' && figUnit(r) === '%');

const CONSUMER_FACING = /SAIDI|SAIFI|billing|meter|transformer failure/i;

interface FamilyFit {
  score: number;
  /** DISCOMs with default-eligible figures in the family's main unit */
  discoms: Set<string>;
  /** latest year at least two of the selected states (or, for one state, two DISCOMs) have figures */
  latestShared: string | null;
}

/** Internal only, never shown (user, 29 Oct 2026): how well one family compares across the selected
 * states. Only default-eligible figures in the unit most of them use count. Tier 1 = figures shared
 * across states in 2+ years and a drawn benchmark in every state, tier 2 = shared in 2+ years, tier
 * 3 = the rest; then shared years, consumer-facing families, DISCOMs with figures. The sheet's
 * Met/Not met is not used. */
function familyFit(rows: MasterRow[], states: string[]): FamilyFit {
  const ok = rows.filter(defaultEligible);
  const units = new Map<string, number>();
  ok.forEach((r) => units.set(figUnit(r), (units.get(figUnit(r)) ?? 0) + 1));
  const main = [...units].sort((a, b) => b[1] - a[1])[0]?.[0];
  const inUnit = ok.filter((r) => figUnit(r) === main);
  const byYear = new Map<string, { states: Set<string>; discoms: Set<string> }>();
  for (const r of inUnit) {
    const y = byYear.get(r.financial_year) ?? byYear.set(r.financial_year, { states: new Set(), discoms: new Set() }).get(r.financial_year)!;
    y.states.add(r.state);
    y.discoms.add(r.discom_code);
  }
  const shared = [...byYear].filter(([, y]) => (states.length > 1 ? y.states.size >= 2 : y.discoms.size >= 2)).map(([fy]) => fy).sort();
  const benchStates = new Set(inUnit.filter((r) => plotBenchmark(r, plotFigure(r))).map((r) => r.state));
  const discoms = new Set(inUnit.map((r) => r.discom_code));
  const tier = shared.length >= 2 && states.every((s) => benchStates.has(s)) ? 1 : shared.length >= 2 ? 2 : 3;
  const f = rows[0]?.indicator_family ?? '';
  return {
    score: (3 - tier) * 100000 + shared.length * 1000 + (CONSUMER_FACING.test(f) ? 500 : 0) + discoms.size * 10 + benchStates.size,
    discoms,
    latestShared: shared[shared.length - 1] ?? null,
  };
}

interface Props {
  states: string[];
}

/** "One selected jurisdiction has nothing reported" / "none of them do", phrased as *currently*
 * unavailable (data may arrive later), never as "they don't overlap". */
function dataAvailabilityMessage(jurisdictions: string[], lacking: string[]): string | null {
  if (lacking.length === 0) return null;
  if (lacking.length === jurisdictions.length) {
    return jurisdictions.length === 2
      ? 'Reported performance data is currently unavailable for both selected jurisdictions. Standards are shown where available.'
      : 'Reported performance data is currently unavailable for all selected jurisdictions. Standards are shown where available.';
  }
  const names = lacking.length === 1 ? lacking[0] : lacking.slice(0, -1).join(', ') + ' and ' + lacking[lacking.length - 1];
  return `Reported performance data is currently unavailable for ${names}. Available standards are shown where captured.`;
}

/** The Compare results view, read from DISCOM_SoP_master.xlsx like the State page. States name
 * their indicators differently, so they're matched on the sheet's `indicator_family`: an indicator
 * is offered only when every selected state has rows for it (among its ticked DISCOMs). Each
 * selected indicator is one MasterIndicator (the State page's module) over every selected state's
 * rows, so every line is a real DISCOM's own figures, shown exactly as the sheet has them. */
export default function CompareView({ states }: Props) {
  const { master, geojson, loading, error } = useData();
  const router = useRouter();
  // per state; an empty list means all of that state's DISCOMs
  const [selectedDiscoms, setSelectedDiscoms] = useState<Record<string, string[]>>({});
  // null until the viewer picks, meaning "the default indicator"
  const [selectedFamilies, setSelectedFamilies] = useState<string[] | null>(null);

  if (loading) return <p className="detail-placeholder">Loading…</p>;
  if (error || !master) return <p className="detail-placeholder">Could not load dashboard data.</p>;

  const back = (
    <button type="button" className="back-btn" onClick={() => router.push(MAP_HREF)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Back to Map
    </button>
  );

  if (states.length < 2) {
    return (
      <div className="state-page">
        <p className="detail-placeholder">Pick at least 2 jurisdictions to compare from the map explorer.</p>
        {back}
      </div>
    );
  }

  const YEARS_ASC = masterYears(master);

  // every selected state's DISCOMs as one list, each with its own fixed hue
  const discomsByState = new Map(states.map((s) => [s, stateDiscoms(master, s)]));
  const allDiscoms: MasterDiscom[] = states.flatMap((s) => discomsByState.get(s) ?? []).map((d, i) => ({ ...d, color: CATEGORICAL[i % CATEGORICAL.length] }));

  // the DISCOMs the viewer has ticked (undefined until they touch that state's picker; [] = all)
  const chosen = (s: string) => selectedDiscoms[s] ?? [];
  // only rows with a year figure to chart (user: "lose granularity and use annual data where
  // defensibly possible"), narrowed to the sheet's overall row where it has one
  const rowsFor = (s: string, keys: string[]) =>
    annualView(rowsForState(master, s).filter((r) => (keys.length === 0 || keys.includes(r.discom_code)) && plotFigure(r) != null));
  const baseByState = new Map<string, MasterRow[]>(states.map((s) => [s, rowsFor(s, chosen(s))]));

  // families every selected state has, in the first state's sheet order, grouped by the sheet's category
  const familiesOf = (rows: MasterRow[]) => new Set(rows.map((r) => r.indicator_family));
  const common = [...familiesOf(baseByState.get(states[0]) ?? [])].filter((f) => states.every((s) => familiesOf(baseByState.get(s) ?? []).has(f)));
  const baseRows = states.flatMap((s) => baseByState.get(s) ?? []);
  const fit = new Map(common.map((f) => [f, familyFit(baseRows.filter((r) => r.indicator_family === f), states)]));
  const rank = new Map(common.map((f) => [f, fit.get(f)!.score]));

  // default: the family that compares best across the selected states (familyFit)
  const defaultFamily = common.reduce<string | null>((best, f) => (best == null || rank.get(f)! > rank.get(best)! ? f : best), null);
  const isDefaultView = selectedFamilies == null;
  const shownFamilies = (selectedFamilies ?? (defaultFamily ? [defaultFamily] : [])).filter((f) => common.includes(f));

  // in the default view, a state the viewer hasn't narrowed ticks only the DISCOMs whose figures
  // compare on the default family's basis (all of them when that's every DISCOM or none)
  const defaultTicks = (s: string): string[] => {
    if (!isDefaultView || !defaultFamily || selectedDiscoms[s] !== undefined) return chosen(s);
    const all = discomsByState.get(s) ?? [];
    const keep = all.filter((d) => fit.get(defaultFamily)!.discoms.has(d.code)).map((d) => d.code);
    return keep.length === 0 || keep.length === all.length ? [] : keep;
  };
  const ticked = (s: string) => defaultTicks(s);
  const rowsByState = new Map<string, MasterRow[]>(states.map((s) => [s, rowsFor(s, ticked(s))]));
  const allRows = states.flatMap((s) => rowsByState.get(s) ?? []);
  const familyRows = (f: string) => allRows.filter((r) => r.indicator_family === f);
  const indicatorOpts: IndicatorOption[] = common.map((f) => ({ indicator: f, category: (familyRows(f)[0] ?? baseRows.find((r) => r.indicator_family === f))!.category, type: f }));

  const shownDiscoms = allDiscoms.filter((d) => {
    const s = states.find((st) => (discomsByState.get(st) ?? []).some((x) => x.code === d.code))!;
    return ticked(s).length === 0 || ticked(s).includes(d.code);
  });

  const lacking = states.filter((s) => !stateHasReportedData(master, s));
  const availabilityMessage = dataAvailabilityMessage(states, lacking);

  return (
    <div className="state-page">
      <div className="state-topbar">
        {back}
        <div className="breadcrumb">
          India Power Supply, Service Quality and Safety Dashboard <span>/</span> <b>Compare</b>
        </div>
      </div>

      <div className="state-hero">
        <div>
          <h1>Performance comparison</h1>
          {geojson && (
            <div className="compare-shapes">
              {states.map((name) => (
                <div className="compare-shape" key={name}>
                  <StateShape geojson={geojson} name={name} color={compareColor(states, name) ?? '#999'} />
                  <span>{name}</span>
                </div>
              ))}
            </div>
          )}
          <p className="control-hint">{states.length} jurisdictions selected</p>
        </div>
      </div>

      <div className="toolbar toolbar--raised">
        {states.map((name) => {
          const opts = (discomsByState.get(name) ?? []).map((d) => ({ key: d.code, label: d.code }));
          return (
            <div className="toolbar-field" key={name}>
              <label>{name}</label>
              <DiscomMultiSelect
                options={opts}
                selected={ticked(name)}
                label={`${name} DISCOM`}
                allLabel="All DISCOMs"
                summaryText={(sel, o) =>
                  sel.length === 0 || sel.length === o.length ? 'All DISCOMs' : sel.length === 1 ? (o.find((x) => x.key === sel[0])?.label ?? '1 DISCOM') : `${sel.length} DISCOMs`
                }
                onChange={(next) => setSelectedDiscoms((prev) => ({ ...prev, [name]: next }))}
              />
            </div>
          );
        })}
      </div>

      <div className="toolbar">
        <div className="toolbar-field toolbar-field--indicator">
          <label>Select Indicator</label>
          <IndicatorSelect options={indicatorOpts} selected={shownFamilies} rank={rank} onChange={setSelectedFamilies} />
        </div>
      </div>

      {availabilityMessage && (
        <div className="no-data-box" style={{ marginTop: 12 }}>
          {availabilityMessage}
        </div>
      )}

      {common.length === 0 ? (
        <p className="detail-placeholder">No indicator has reported figures for every selected jurisdiction yet.</p>
      ) : shownFamilies.length === 0 ? (
        <p className="detail-placeholder">Select at least one indicator above to compare what the sheet reports for it.</p>
      ) : (
        <div className="im-stack">
          {shownFamilies.map((f) => (
            <MasterIndicator key={f} indicator={f} rows={familyRows(f)} discoms={shownDiscoms} yearsAsc={YEARS_ASC} hideTimes annualOnly chartOnly states={states} initialYear={isDefaultView ? (fit.get(f)?.latestShared ?? undefined) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

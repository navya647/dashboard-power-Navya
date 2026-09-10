'use client';

import '@/lib/chartSetup';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/lib/DataContext';
import { compareColor, stateHasReportedData } from '@/lib/computations';
import { fyLabel } from '@/lib/format';
import { buildMultiDiscomAtoms, buildMultiDiscomComparableCards, buildUnifiedTableRows, jurisdictionDiscomOptions, multiDiscomLegend } from '@/lib/unifiedIndicators';
import DiscomMultiSelect from './DiscomMultiSelect';
import IndicatorVisualCard from './IndicatorVisualCard';
import StateShape from './StateShape';
import UnifiedDataTable from './UnifiedDataTable';
import YearPicker from './YearPicker';

interface Props {
  states: string[];
}

/** "One selected jurisdiction has nothing reported" / "none of them do" — phrased as *currently*
 * unavailable (data may arrive later) and never as "they don't overlap", which would misattribute
 * a missing-reported-data situation to some sort of mismatch between the jurisdictions. */
function dataAvailabilityMessage(jurisdictions: string[], lacking: string[]): string | null {
  if (lacking.length === 0) return null;
  if (lacking.length === jurisdictions.length) {
    return jurisdictions.length === 2
      ? 'Reported performance data is currently unavailable for both selected jurisdictions. Standards and benchmarks are shown where available.'
      : 'Reported performance data is currently unavailable for all selected jurisdictions. Standards and benchmarks are shown where available.';
  }
  const names = lacking.length === 1 ? lacking[0] : lacking.slice(0, -1).join(', ') + ' and ' + lacking[lacking.length - 1];
  return `Reported performance data is currently unavailable for ${names}. Available standards and benchmarks are shown where captured.`;
}

/** The Compare results view — same page architecture as the State Performance page: one chart
 * gallery (always the full FY-axis trend, never re-scoped by a year control) and one Data Table
 * beneath it, with its own fiscal-year focus control that narrows only the table, exactly like
 * `StateDetail.tsx`. Each selected state gets its own tickable DISCOM picker (`DiscomMultiSelect`)
 * — no "whole state" option, so every line on the chart is always a specific, real DISCOM's own
 * reported figures, never an invented cross-DISCOM average (see CLAUDE.md).
 * `buildMultiDiscomComparableCards` matches indicators captured by at least one ticked DISCOM in
 * EVERY selected state, never on whether a reported value exists — see CLAUDE.md and the unified
 * State page this mirrors. */
export default function CompareView({ states }: Props) {
  const { discoms, stateSpecific, geojson, loading, error } = useData();
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [showAllYears, setShowAllYears] = useState(true);
  const [selectedDiscoms, setSelectedDiscoms] = useState<Record<string, string[]>>({});

  if (loading) return <p className="detail-placeholder">Loading…</p>;
  if (error || !discoms || !geojson) return <p className="detail-placeholder">Could not load dashboard data.</p>;

  if (states.length < 2) {
    return (
      <div className="state-page">
        <p className="detail-placeholder">Pick at least 2 jurisdictions to compare from the map explorer.</p>
        <button type="button" className="back-btn" onClick={() => router.back()}>
          Back to Home
        </button>
      </div>
    );
  }

  const YEARS_ASC = [...discoms.years].reverse();
  const activeYear = selectedYear ?? (discoms.years.includes('2023-24') ? '2023-24' : discoms.years[0]);

  // ticked DISCOMs default to "every DISCOM this state has" until the viewer narrows a state's
  // own picker — never a state-level median, just every real DISCOM line shown at once.
  const discomOptsByState = new Map(states.map((name) => [name, jurisdictionDiscomOptions(discoms, stateSpecific, name)]));
  const selection = states.map((name) => ({
    state: name,
    discomKeys: selectedDiscoms[name] ?? discomOptsByState.get(name)?.map((o) => o.key) ?? [],
  }));

  const atomsByState = buildMultiDiscomAtoms(discoms, stateSpecific, selection, YEARS_ASC);
  const cards = buildMultiDiscomComparableCards(atomsByState);

  // the Data Table shows exactly the same comparable indicators as the chart gallery above it —
  // scoped to the atoms that actually made it onto a card, not every atom either jurisdiction has.
  const cardKeys = new Set(cards.map((c) => c.id));
  const comparableAtoms = atomsByState.flatMap(({ atoms }) => atoms).filter((a) => cardKeys.has(`${a.dataset}::${a.category}::${a.type}::${a.indicator}`));
  const allTableRows = buildUnifiedTableRows(comparableAtoms);
  const tableRows = showAllYears ? allTableRows : allTableRows.filter((r) => r.fy === fyLabel(activeYear) || r.fy === 'All years');

  const lacking = states.filter((name) => !stateHasReportedData(discoms.discoms, name, stateSpecific));
  const availabilityMessage = dataAvailabilityMessage(states, lacking);
  const emptyPicks = selection.filter((s) => s.discomKeys.length === 0).map((s) => s.state);
  const legend = multiDiscomLegend(atomsByState);

  return (
    <div className="state-page">
      <div className="state-topbar">
        <button type="button" className="back-btn" onClick={() => router.back()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Home
        </button>
        <div className="breadcrumb">
          India Power Supply and Service Quality Dashboard <span>/</span> <b>Compare</b>
        </div>
      </div>

      <div className="state-hero">
        <div>
          <h1>Performance comparison</h1>
          <div className="compare-shapes">
            {states.map((name) => (
              <div className="compare-shape" key={name}>
                <StateShape geojson={geojson} name={name} color={compareColor(states, name) ?? '#999'} />
                <span>{name}</span>
              </div>
            ))}
          </div>
          <p className="control-hint">{states.length} jurisdictions selected</p>
        </div>
      </div>

      <div className="toolbar">
        {states.map((name) => {
          const discomOpts = discomOptsByState.get(name) ?? [];
          return (
            <div className="toolbar-field" key={name}>
              <label>{name}</label>
              <DiscomMultiSelect
                options={discomOpts}
                selected={selectedDiscoms[name] ?? discomOpts.map((o) => o.key)}
                onChange={(next) => setSelectedDiscoms((prev) => ({ ...prev, [name]: next }))}
              />
            </div>
          );
        })}
      </div>

      {legend.length > 0 && (
        <div className="discom-legend">
          {legend.map((l) => (
            <span className="discom-legend-item" key={l.label}>
              <span className="discom-legend-dot" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      )}

      {emptyPicks.length > 0 && (
        <div className="no-data-box" style={{ marginTop: 12 }}>
          Tick at least one DISCOM for {emptyPicks.join(', ')} to see comparable indicators.
        </div>
      )}

      {availabilityMessage && (
        <div className="no-data-box" style={{ marginTop: 12 }}>
          {availabilityMessage}
        </div>
      )}

      <div className="section-header">
        <span className="section-label">Comparable Indicators</span>
        <span className="section-title">Regulatory standards, benchmarks and targets, reported performance, compliance, and year-wise trends</span>
      </div>

      {cards.length === 0 ? (
        <p className="detail-placeholder">No comparable indicator is currently captured across every selected jurisdiction.</p>
      ) : (
        <div className="chart-grid">
          {cards.map((c, idx) => (
            <IndicatorVisualCard
              key={c.id}
              title={c.indicator}
              typeLabel={c.type}
              meaning={c.meaning}
              unitSuffix={c.unitSuffix}
              yAxisLabel={c.yAxisLabel}
              yearsAsc={YEARS_ASC}
              activeYear={activeYear}
              series={c.series}
              animationDelay={idx * 60}
            />
          ))}
        </div>
      )}

      <div className="complete-data-band">
        <div className="section-header">
          <span className="section-title">Data Table</span>
        </div>

        <div className="complete-data-toggle complete-data-toggle-sticky">
          <span>{showAllYears ? `Showing all ${discoms.years.length} fiscal years` : `Focused on ${fyLabel(activeYear)}`}</span>
          {discoms.years.length > 1 && (
            <YearPicker
              years={discoms.years}
              active={activeYear}
              onChange={(y) => {
                setSelectedYear(y);
                setShowAllYears(false);
              }}
            />
          )}
          <button type="button" className="complete-data-toggle-btn" onClick={() => setShowAllYears((v) => !v)}>
            {showAllYears ? 'Show one year' : 'Show all years'}
          </button>
        </div>

        <UnifiedDataTable rows={tableRows} />
      </div>
    </div>
  );
}

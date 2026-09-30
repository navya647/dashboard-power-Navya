'use client';

import '@/lib/chartSetup';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/lib/DataContext';
import { stateHueMap } from '@/lib/colors';
import { stateHasSopData } from '@/lib/computations';
import { fyLabel } from '@/lib/format';
import {
  buildUnifiedAtoms,
  buildUnifiedCards,
  buildUnifiedTableRows,
  categoryOptions,
  discomOptions,
  indicatorOptions,
  matchesFilters,
  pickDefaultIndicator,
  typeOptions,
  type UnifiedFilters,
} from '@/lib/unifiedIndicators';
import DiscomMultiSelect from './DiscomMultiSelect';
import IndicatorVisualCard from './IndicatorVisualCard';
import StateShape from './StateShape';
import UnifiedDataTable from './UnifiedDataTable';
import YearPicker from './YearPicker';

/** The State Performance page. One architecture serves every state regardless of whether it has a
 * single reported figure yet: header, one DISCOM / Indicator Category / Indicator Type / Indicator
 * filter bar, one chart-card gallery, one Data Table. Reported data and framework-only data (the 5
 * states with a notified SoP regulation but no per-DISCOM reported-figures sheet — see CLAUDE.md)
 * are unified into one flat list of indicator "atoms" by lib/unifiedIndicators before this
 * component ever sees them, so there is no separate no-data layout to keep in sync with this one. */
export default function StateDetail({ name }: { name: string }) {
  const { discoms, geojson, stateSpecific, loading, error } = useData();
  const router = useRouter();

  // One filter bar drives both the chart gallery and the Data Table below it. Every field is a
  // tickable multi-select (an empty array means "no constraint" — see UnifiedFilters) except that
  // this page treats an empty `selectedIndicators` specially: no chart/table content is shown at
  // all until at least one indicator is explicitly picked, rather than defaulting to "show
  // everything" the way the other three fields do.
  const [selectedDiscoms, setSelectedDiscoms] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [showAllYears, setShowAllYears] = useState(true);
  // Whether the current filter selection is still the auto-picked default this page landed on —
  // drives the "Showing an initial view of..." note (see below), which disappears the moment the
  // viewer changes any filter themselves.
  const [isDefaultView, setIsDefaultView] = useState(false);

  // computed defensively (discoms/stateSpecific may still be null/undefined while loading, or
  // permanently absent for a framework-only state) so they're safe to use in the effect below,
  // which — being a hook — must run on every render, before either early return further down.
  const YEARS_ASC = discoms ? [...discoms.years].reverse() : [];
  const allDs = discoms ? discoms.discoms.filter((d) => d.state === name) : [];
  const atoms = buildUnifiedAtoms(discoms, allDs, stateSpecific, name, YEARS_ASC);

  // Re-picks (and resets every filter for) a fresh default each time the viewer lands on a
  // *different* state/UT than `name` last was — covers both the first mount and a client-side
  // navigation between two state pages, which reuses this same component instance (same dynamic
  // route, just a different `name` prop) rather than remounting it, so plain useState alone would
  // otherwise carry one state's stale DISCOM/category/type/indicator selection over onto the next
  // state. Guarded on `name`, not on the current filter values, so deliberately clearing a
  // selection back to empty never re-triggers this on its own.
  const appliedDefaultForRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading || (!discoms && !stateSpecific)) return;
    if (appliedDefaultForRef.current === name) return;
    appliedDefaultForRef.current = name;
    const preferred = pickDefaultIndicator(atoms);
    setSelectedDiscoms([]);
    setSelectedCategories(preferred ? [preferred.category] : []);
    setSelectedTypes(preferred ? [preferred.type] : []);
    setSelectedIndicators(preferred ? [preferred.indicator] : []);
    setIsDefaultView(preferred != null);
  }, [name, loading, discoms, stateSpecific, atoms]);

  if (loading) return <p className="detail-placeholder">Loading…</p>;
  if (error || !discoms) return <p className="detail-placeholder">Could not load dashboard data.</p>;

  const activeYear = selectedYear ?? (discoms.years.includes('2023-24') ? '2023-24' : discoms.years[0]);

  // a state can have zero reliability DISCOMs and still have real Standards-of-Performance
  // content to show (its own per-DISCOM sheets, or a regulatory-framework listing) — only bail
  // out entirely when neither dataset has anything for this state.
  if (!allDs.length && !stateHasSopData(stateSpecific, name)) {
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
            India Power Supply and Service Quality Dashboard <span>/</span> <b>{name}</b>
          </div>
        </div>

        <div className="coming-soon-panel">
          <div className="coming-soon-icon-wrap">
            <svg className="coming-soon-icon" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="6" rx="7" ry="3" />
              <path d="M5 6v6c0 1.66 3.13 3 7 3s7-1.34 7-3V6" />
              <path d="M5 12v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
            </svg>
          </div>
          <span className="coming-soon-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
            Data compilation in progress
          </span>
          <h1>Data for {name} is being compiled</h1>
          <button type="button" className="coming-soon-cta" onClick={() => router.push('/?view=map')}>
            Explore Other States &amp; UTs <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    );
  }

  const color = stateHueMap(discoms.state_order)[name] || '#8B1A1A';

  const discomOpts = discomOptions(atoms);
  const discomScope = atoms.filter((a) => selectedDiscoms.length === 0 || selectedDiscoms.includes(a.discomKey));
  const categoryOpts = categoryOptions(discomScope);
  const categoryScope = discomScope.filter((a) => selectedCategories.length === 0 || selectedCategories.includes(a.category));
  const typeOpts = typeOptions(categoryScope);
  const typeScope = categoryScope.filter((a) => selectedTypes.length === 0 || selectedTypes.includes(a.type));
  const indicatorOpts = indicatorOptions(typeScope);

  const filters: UnifiedFilters = { discoms: selectedDiscoms, categories: selectedCategories, types: selectedTypes, indicators: selectedIndicators };
  // Nothing shown — chart gallery or Data Table — until at least one indicator is explicitly
  // selected (see the state declarations above): an empty `filteredAtoms` here automatically empties
  // both `cards` and `tableRows` below, so this one gate covers both.
  const filteredAtoms = selectedIndicators.length === 0 ? [] : atoms.filter((a) => matchesFilters(a, filters));
  const cards = buildUnifiedCards(filteredAtoms);

  const allTableRows = buildUnifiedTableRows(filteredAtoms);
  const tableRows = showAllYears ? allTableRows : allTableRows.filter((r) => r.fy === fyLabel(activeYear) || r.fy === 'All years');

  // ---- Overview counts — plain counts of source records, never a derived score ----
  const discomCount = discomOpts.length;
  const fyRange = YEARS_ASC.length > 1 ? `${fyLabel(YEARS_ASC[0])}–${fyLabel(YEARS_ASC[YEARS_ASC.length - 1])}` : fyLabel(YEARS_ASC[0]);
  // placeholder ownership label — not real per-DISCOM ownership data, see StateDetail.tsx history
  const ownershipLabel = name === 'Odisha' ? 'All Public-Private Joint Venture' : 'All State-Government Owned';

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
          India Power Supply and Service Quality Dashboard <span>/</span> <b>{name}</b>
        </div>
      </div>

      <header className="state-hero state-hero--compact" style={{ ['--hero-color' as string]: color, borderLeftColor: color }}>
        <div className="state-hero-main">
          <div className="state-hero-text">
            <h1>{name}</h1>
            {allDs.length ? (
              <ul className="sub">
                {allDs.map((d) => (
                  <li key={d.short_name}>
                    {d.full_name} ({d.short_name})
                  </li>
                ))}
              </ul>
            ) : (
              <div className="sub">No DISCOMs tracked</div>
            )}
          </div>
          {geojson && (
            <div className="state-hero-shape">
              <StateShape geojson={geojson} name={name} size={116} color={color} />
            </div>
          )}
        </div>
        <div className="state-hero-stats-inline">
          <span>
            <b>{discomCount}</b> DISCOM{discomCount === 1 ? '' : 's'} · {ownershipLabel}
          </span>
          <span>
            <b>{fyRange}</b>
          </span>
        </div>
      </header>

      <div className="toolbar">
        <div className="toolbar-field">
          <label>Discom</label>
          <DiscomMultiSelect
            options={discomOpts}
            selected={selectedDiscoms}
            noun="DISCOMs"
            onChange={(next) => {
              setSelectedDiscoms(next);
              setSelectedCategories([]);
              setSelectedTypes([]);
              setSelectedIndicators([]);
              setIsDefaultView(false);
            }}
          />
        </div>

        <div className="toolbar-field">
          <label>Indicator Category</label>
          <DiscomMultiSelect
            options={categoryOpts.map((c) => ({ key: c, label: c }))}
            selected={selectedCategories}
            noun="Categories"
            onChange={(next) => {
              setSelectedCategories(next);
              setSelectedTypes([]);
              setSelectedIndicators([]);
              setIsDefaultView(false);
            }}
          />
        </div>

        <div className="toolbar-field">
          <label>Indicator Type</label>
          <DiscomMultiSelect
            options={typeOpts.map((t) => ({ key: t, label: t }))}
            selected={selectedTypes}
            noun="Types"
            onChange={(next) => {
              setSelectedTypes(next);
              setSelectedIndicators([]);
              setIsDefaultView(false);
            }}
          />
        </div>

        <div className="toolbar-field">
          <label>Indicator</label>
          <DiscomMultiSelect
            options={indicatorOpts.map((i) => ({ key: i, label: i }))}
            selected={selectedIndicators}
            noun="Indicators"
            onChange={(next) => {
              setSelectedIndicators(next);
              setIsDefaultView(false);
            }}
          />
        </div>

        <div className="toolbar-field">
          <label>Year</label>
          <select
            value={showAllYears ? 'all' : activeYear}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'all') {
                setShowAllYears(true);
              } else {
                setSelectedYear(v);
                setShowAllYears(false);
              }
            }}
          >
            <option value="all">All years</option>
            {YEARS_ASC.map((y) => (
              <option key={y} value={y}>
                {fyLabel(y)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedIndicators.length === 0 && <p className="detail-placeholder">Select at least one indicator above to view its reported performance, benchmarks and trends.</p>}

      {isDefaultView && cards.length > 0 && (
        <p className="default-view-note">
          Showing an initial view of {selectedIndicators.join(', ')} across {name}&apos;s DISCOMs. Use the filters above to explore other indicators.
        </p>
      )}

      {cards.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-title">Regulatory Standards &amp; Compliance</span>
          </div>
          <div className="chart-grid">
            {cards.map((c, idx) => (
              <IndicatorVisualCard
                key={c.id}
                section="compliance"
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

          <div className="section-header">
            <span className="section-title">Year-wise Trends</span>
          </div>
          <div className="chart-grid">
            {cards.map((c, idx) => (
              <IndicatorVisualCard
                key={c.id}
                section="trends"
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
        </>
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

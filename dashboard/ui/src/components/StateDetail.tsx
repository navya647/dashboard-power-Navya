'use client';

import '@/lib/chartSetup';
import { useState } from 'react';
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
  typeOptions,
  type UnifiedFilters,
} from '@/lib/unifiedIndicators';
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

  // One filter bar drives both the chart gallery and the Data Table below it.
  const [selectedDiscom, setSelectedDiscom] = useState('all');
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedIndicator, setSelectedIndicator] = useState('all');
  const [showAllYears, setShowAllYears] = useState(true);

  if (loading) return <p className="detail-placeholder">Loading…</p>;
  if (error || !discoms) return <p className="detail-placeholder">Could not load dashboard data.</p>;

  const activeYear = selectedYear ?? (discoms.years.includes('2023-24') ? '2023-24' : discoms.years[0]);
  const YEARS_ASC = [...discoms.years].reverse();
  const allDs = discoms.discoms.filter((d) => d.state === name);

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
          <svg className="coming-soon-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
          <h1>Information Coming Soon</h1>
          <p>Data Collation in Progress</p>
        </div>
      </div>
    );
  }

  const color = stateHueMap(discoms.state_order)[name] || '#8B1A1A';

  const atoms = buildUnifiedAtoms(discoms, allDs, stateSpecific, name, YEARS_ASC);

  const discomOpts = discomOptions(atoms);
  const discomScope = atoms.filter((a) => selectedDiscom === 'all' || a.discomKey === selectedDiscom);
  const categoryOpts = categoryOptions(discomScope);
  const categoryScope = discomScope.filter((a) => selectedCategory === 'all' || a.category === selectedCategory);
  const typeOpts = typeOptions(categoryScope);
  const typeScope = categoryScope.filter((a) => selectedType === 'all' || a.type === selectedType);
  const indicatorOpts = indicatorOptions(typeScope);

  const filters: UnifiedFilters = { discom: selectedDiscom, category: selectedCategory, type: selectedType, indicator: selectedIndicator };
  const filteredAtoms = atoms.filter((a) => matchesFilters(a, filters));
  const cards = buildUnifiedCards(filteredAtoms);

  const allTableRows = buildUnifiedTableRows(filteredAtoms);
  const tableRows = showAllYears ? allTableRows : allTableRows.filter((r) => r.fy === fyLabel(activeYear) || r.fy === 'All years');

  // ---- Overview counts — plain counts of source records, never a derived score ----
  const discomCount = discomOpts.length;
  const fyRange = YEARS_ASC.length > 1 ? `${fyLabel(YEARS_ASC[0])}–${fyLabel(YEARS_ASC[YEARS_ASC.length - 1])}` : fyLabel(YEARS_ASC[0]);
  // placeholder ownership label — not real per-DISCOM ownership data, see StateDetail.tsx history
  const ownershipLabel = name === 'Odisha' ? 'All Private' : 'All Public';

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
          <div>
            <h1>{name}</h1>
            <div className="sub">{allDs.length ? allDs.map((d) => `${d.full_name} (${d.short_name})`).join(' · ') : 'No DISCOMs tracked'}</div>
          </div>
          {geojson && (
            <div className="state-hero-shape">
              <StateShape geojson={geojson} name={name} size={72} color={color} />
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
          <select
            value={selectedDiscom}
            onChange={(e) => {
              setSelectedDiscom(e.target.value);
              setSelectedCategory('all');
              setSelectedType('all');
              setSelectedIndicator('all');
            }}
          >
            <option value="all">All DISCOMs</option>
            {discomOpts.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-field">
          <label>Indicator Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedType('all');
              setSelectedIndicator('all');
            }}
          >
            <option value="all">All Categories</option>
            {categoryOpts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-field">
          <label>Indicator Type</label>
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setSelectedIndicator('all');
            }}
          >
            <option value="all">All Types</option>
            {typeOpts.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-field">
          <label>Indicator</label>
          <select value={selectedIndicator} onChange={(e) => setSelectedIndicator(e.target.value)}>
            <option value="all">All Indicators</option>
            {indicatorOpts.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="section-header">
        <span className="section-title">Regulatory standards, benchmarks and targets, reported performance, compliance, and year-wise trends</span>
      </div>

      {cards.length > 0 && (
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

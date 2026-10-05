'use client';

import '@/lib/chartSetup';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MAP_HREF } from '@/lib/routes';
import { useData } from '@/lib/DataContext';
import { stateHueMap } from '@/lib/colors';
import { stateHasSopData, stateReportedYears } from '@/lib/computations';
import { fyRunsLabel } from '@/lib/format';
import {
  buildUnifiedAtoms,
  buildUnifiedCards,
  discomOptions,
  matchesFilters,
  pickDefaultIndicator,
  withStandardOrFigures,
  type UnifiedFilters,
  type UnifiedIndicatorAtom,
} from '@/lib/unifiedIndicators';
import CompilingState from './CompilingState';
import DiscomMultiSelect from './DiscomMultiSelect';
import IndicatorSelect, { type IndicatorOption } from './IndicatorSelect';
import IndicatorModule from './IndicatorModule';
import StateShape from './StateShape';

/** The State Performance page. One architecture serves every state regardless of whether it has a
 * single reported figure yet: header, one DISCOM / Indicator filter bar, one IndicatorModule per selected indicator. Reported data and framework-only data (the 5
 * states with a notified SoP regulation but no per-DISCOM reported-figures sheet — see CLAUDE.md)
 * are unified into one flat list of indicator "atoms" by lib/unifiedIndicators before this
 * component ever sees them, so there is no separate no-data layout to keep in sync with this one. */
export default function StateDetail({ name }: { name: string }) {
  const { discoms, geojson, stateSpecific, loading, error } = useData();
  const router = useRouter();

  // One filter bar drives the chart gallery: DISCOM and Indicator (no Year — the page is a
  // year-wise trend view, so charts always show the full series). Both are tickable multi-selects (each picked
  // indicator gets its own compliance card and trend section); an empty DISCOM list means "no
  // constraint" (all DISCOMs), but an empty `selectedIndicators` means nothing is shown at all
  // until at least one indicator is picked. Indicator Category and Indicator Type are no longer
  // filters of their own — every indicator name belongs to exactly one category/type within a
  // state (verified across all 12), so they're derived from the picked indicators (see `filters`
  // below) and select exactly the rows the old Category → Type → Indicator cascade did.
  const [selectedDiscoms, setSelectedDiscoms] = useState<string[]>([]);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  // Set when a DISCOM change left none of the picked indicators available, so the page fell back
  // to that DISCOM selection's own default indicator instead of going empty — says what happened.
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);

  // computed defensively (discoms/stateSpecific may still be null/undefined while loading, or
  // permanently absent for a framework-only state) so they're safe to use in the effect below,
  // which — being a hook — must run on every render, before either early return further down.
  const YEARS_ASC = discoms ? [...discoms.years].reverse() : [];
  const allDs = discoms ? discoms.discoms.filter((d) => d.state === name) : [];
  // indicators with neither a standard nor reported figures for this state are never offered
  const atoms = withStandardOrFigures(buildUnifiedAtoms(discoms, allDs, stateSpecific, name, YEARS_ASC));

  // The page-load default — also exactly what Reset returns to: all DISCOMs, the default indicator
  // (SAIDI if reported, else the most-reported one — see pickDefaultIndicator).
  function applyDefaultView(stateAtoms: UnifiedIndicatorAtom[]) {
    const preferred = pickDefaultIndicator(stateAtoms);
    setSelectedDiscoms([]);
    setSelectedIndicators(preferred ? [preferred.indicator] : []);
    setFallbackNote(null);
  }

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
    applyDefaultView(atoms);
  }, [name, loading, discoms, stateSpecific, atoms]);

  if (loading) return <p className="detail-placeholder">Loading…</p>;
  if (error || !discoms) return <p className="detail-placeholder">Could not load dashboard data.</p>;

  // a state can have zero reliability DISCOMs and still have real Standards-of-Performance
  // content to show (its own per-DISCOM sheets, or a regulatory-framework listing) — only bail
  // out entirely when neither dataset has anything for this state.
  if (!allDs.length && !stateHasSopData(stateSpecific, name)) {
    return (
      <div className="state-page state-page--empty">
        {/* the same back button + breadcrumb row as a state with data */}
        <div className="state-topbar">
          <button type="button" className="back-btn" onClick={() => router.push(MAP_HREF)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Home
          </button>
          <div className="breadcrumb">
            India Power Supply, Service Quality and Safety Dashboard <span>/</span> <b>{name}</b>
          </div>
        </div>

        <CompilingState name={name} geojson={geojson} />
      </div>
    );
  }

  // light mode swaps the state's categorical hue for the interaction blue (--state-accent in
  // tokens.css); dark mode leaves --state-accent unset, so the hue shows as before
  const color = `var(--state-accent, ${stateHueMap(discoms.state_order)[name] || '#8B1A1A'})`;

  const discomOpts = discomOptions(atoms);
  const inDiscoms = (keys: string[]) => atoms.filter((a) => keys.length === 0 || keys.includes(a.discomKey));
  const discomScope = inDiscoms(selectedDiscoms);
  // one option per indicator name, carrying its (unique) category/type for grouping and labelling
  const indicatorOpts: IndicatorOption[] = Array.from(new Map(discomScope.map((a) => [a.indicator, { indicator: a.indicator, category: a.category, type: a.type }])).values());

  const pickedAtoms = discomScope.filter((a) => selectedIndicators.includes(a.indicator));
  const filters: UnifiedFilters = {
    discoms: selectedDiscoms,
    categories: Array.from(new Set(pickedAtoms.map((a) => a.category))),
    types: Array.from(new Set(pickedAtoms.map((a) => a.type))),
    indicators: selectedIndicators,
  };

  // DISCOM change: keep whichever picked indicators the new DISCOM selection still has; if none
  // survive, fall back to that selection's own default rather than leaving the page empty.
  function changeDiscoms(next: string[]) {
    const scope = inDiscoms(next);
    const available = new Set(scope.map((a) => a.indicator));
    const kept = selectedIndicators.filter((i) => available.has(i));
    setSelectedDiscoms(next);
    if (kept.length > 0 || selectedIndicators.length === 0) {
      setSelectedIndicators(kept);
      setFallbackNote(null);
      return;
    }
    const preferred = pickDefaultIndicator(scope);
    const n = selectedIndicators.length;
    const lost = n === 1 ? selectedIndicators[0] : selectedIndicators.slice(0, -1).join(', ') + ' and ' + selectedIndicators[n - 1];
    const verb = n === 1 ? 'isn’t' : 'aren’t';
    const forWhom = next.length === 1 ? (discomOpts.find((o) => o.key === next[0])?.label ?? 'this DISCOM') : 'the selected DISCOMs';
    setSelectedIndicators(preferred ? [preferred.indicator] : []);
    setFallbackNote(
      preferred
        ? `${lost} ${verb} reported for ${forWhom}, so we’re showing ${preferred.indicator} instead.`
        : `${lost} ${verb} reported for ${forWhom}, and no other indicator has reported figures for it.`,
    );
  }

  // Reset only appears once the view differs from the page-load default (see applyDefaultView)
  const defaultIndicator = pickDefaultIndicator(atoms)?.indicator ?? null;
  const atDefault =
    selectedDiscoms.length === 0 &&
    (defaultIndicator ? selectedIndicators.length === 1 && selectedIndicators[0] === defaultIndicator : selectedIndicators.length === 0);
  // Nothing shown until at least one indicator is explicitly selected (see the state declarations
  // above): an empty `filteredAtoms` here automatically empties `cards` below.
  const filteredAtoms = selectedIndicators.length === 0 ? [] : atoms.filter((a) => matchesFilters(a, filters));
  const cards = buildUnifiedCards(filteredAtoms);

  // ---- Overview counts — plain counts of source records, never a derived score ----
  // counted from the same list the header chips show (the reliability dataset's DISCOMs), so the
  // number and the chips can never disagree — counting the filter's options instead also counted
  // a state's regulatory-framework entry as a "DISCOM", and Gujarat's DGCVL/DGVCL spelling variant
  // across the two workbooks twice.
  const discomCount = allDs.length;
  // the years this state actually has reported figures for (either dataset), not the dashboard-wide
  // year list — every sheet has rows for every year, but e.g. Madhya Pradesh reports only FY22–FY24
  const reportedYears = fyRunsLabel(stateReportedYears(discoms.discoms, name, stateSpecific), YEARS_ASC) || 'N/A';
  // placeholder ownership label — not real per-DISCOM ownership data, see StateDetail.tsx history
  const ownershipLabel = name === 'Odisha' ? 'All public-private joint venture' : 'All state-government owned';

  return (
    <div className="state-page">
      <div className="state-topbar">
        <button type="button" className="back-btn" onClick={() => router.push(MAP_HREF)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Home
        </button>
        <div className="breadcrumb">
          India Power Supply, Service Quality and Safety Dashboard <span>/</span> <b>{name}</b>
        </div>
      </div>

      {/* compact masthead: silhouette + name + meta line on the left, the DISCOM list on the right */}
      <header className="state-hero state-hero--compact" style={{ ['--hero-color' as string]: color }}>
        <div className="state-hero-title">
          {geojson && (
            <div className="state-hero-shape" aria-hidden="true">
              <StateShape geojson={geojson} name={name} size={60} color={color} />
            </div>
          )}
          <div className="state-hero-text">
            <h1>{name}</h1>
            <p className="state-hero-meta">
              {discomCount ? `${discomCount} DISCOM${discomCount === 1 ? '' : 's'}` : 'No DISCOMs tracked'} · {ownershipLabel} · Reported data {reportedYears}
            </p>
          </div>
        </div>
        {allDs.length > 0 && (
          <div className="state-hero-discoms">
            {/* one per line: short name (fixed-width column, so the full names line up) then the
                full name. 5+ DISCOMs split into two side-by-side lists to keep the card short. */}
            <div className={`hero-discom-list${allDs.length >= 5 ? ' hero-discom-list--split' : ''}`}>
              {(allDs.length >= 5 ? [allDs.slice(0, Math.ceil(allDs.length / 2)), allDs.slice(Math.ceil(allDs.length / 2))] : [allDs]).map((col, ci) => (
                <ul key={ci} aria-label="DISCOMs">
                  {col.map((d) => {
                    const short = d.short_name?.trim();
                    return (
                      <li key={d.full_name} className={short ? undefined : 'hero-discom-list-fullonly'}>
                        {short && <b>{short}</b>}
                        <span>{d.full_name}</span>
                      </li>
                    );
                  })}
                </ul>
              ))}
            </div>
          </div>
        )}
      </header>

      <div className="toolbar toolbar--filters" role="group" aria-label="Filters">
        <div className="toolbar-field">
          <label>DISCOM</label>
          <DiscomMultiSelect
            options={discomOpts}
            selected={selectedDiscoms}
            label="DISCOM"
            allLabel="All DISCOMs"
            summaryText={(sel, opts) =>
              sel.length === 0 || sel.length === opts.length ? 'All DISCOMs' : sel.length === 1 ? (opts.find((o) => o.key === sel[0])?.label ?? '1 DISCOM') : `${sel.length} DISCOMs`
            }
            onChange={changeDiscoms}
          />
        </div>

        <div className="toolbar-field toolbar-field--indicator">
          <label>Indicator</label>
          <IndicatorSelect
            options={indicatorOpts}
            selected={selectedIndicators}
            onChange={(next) => {
              setSelectedIndicators(next);
              setFallbackNote(null);
            }}
          />
        </div>

        {!atDefault && (
          <button type="button" className="toolbar-reset" onClick={() => applyDefaultView(atoms)}>
            Reset
          </button>
        )}
      </div>

      {fallbackNote && (
        <p className="filter-fallback-note" role="status">
          <span>{fallbackNote}</span>
          <button type="button" aria-label="Dismiss note" onClick={() => setFallbackNote(null)}>
            ×
          </button>
        </p>
      )}

      {selectedIndicators.length === 0 && <p className="detail-placeholder">Select at least one indicator above to view its reported performance, benchmarks and trends.</p>}


      {/* one self-contained analysis module per selected indicator — never merged across indicators */}
      {cards.length > 0 && (
        <div className="im-stack">
          {cards.map((c) => (
            <IndicatorModule key={c.id} card={c} yearsAsc={YEARS_ASC} state={name} />
          ))}
        </div>
      )}

    </div>
  );
}

'use client';

import '@/lib/chartSetup';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MAP_HREF } from '@/lib/routes';
import { useData } from '@/lib/DataContext';
import { stateHueMap } from '@/lib/colors';
import { stateIsTracked, stateReportedYears } from '@/lib/computations';
import { fyRunsLabel } from '@/lib/format';
import { REGULATORS } from '@/lib/regulators';
import { discomFullName } from '@/lib/discomNames';
import { defaultDiscom, defaultIndicators, pinnedIndicators } from '@/lib/priorityIndicators';
import { indicatorOptionsFor, indicatorStrength, masterYears, rowsForState, stateDiscoms } from '@/lib/master';
import CompilingState from './CompilingState';
import DiscomMultiSelect from './DiscomMultiSelect';
import IndicatorSelect, { type IndicatorOption } from './IndicatorSelect';
import MasterIndicator from './MasterIndicator';
import StateShape from './StateShape';

/** The State Performance page, read entirely from DISCOM_SoP_master.xlsx (lib/master). Header,
 * one DISCOM / Indicator filter bar, then one MasterIndicator per selected indicator: every row the
 * sheet has for it, exactly as the sheet shows it. A state with no rows at all gets the "data being
 * compiled" view. */
export default function StateDetail({ name }: { name: string }) {
  const { master, geojson, loading, error } = useData();
  const router = useRouter();

  // An empty DISCOM list means all DISCOMs; an empty indicator list shows nothing until one is picked.
  const [selectedDiscoms, setSelectedDiscoms] = useState<string[]>([]);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  // the sheet's three categories; empty = all
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // Set when a DISCOM change left none of the picked indicators available, so the page fell back
  // to that DISCOM selection's own default indicator instead of going empty, says what happened.
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);

  // computed before the early returns below, since the effect needs them on every render
  const YEARS_ASC = masterYears(master);
  const stateRows = rowsForState(master, name);
  const discoms = stateDiscoms(master, name);

  function applyDefaultView(rows: typeof stateRows) {
    // one DISCOM selected by default (user, 29 Oct 2026), with its own primary indicators
    const d = defaultDiscom(name, discoms.map((x) => x.code), stateRows);
    const picked = d ? [d] : [];
    setSelectedDiscoms(picked);
    setSelectedCategories([]);
    setSelectedIndicators(defaultIndicators(name, picked, rows.filter((r) => !d || r.discom_code === d)));
    setFallbackNote(null);
  }

  // Re-picks (and resets every filter for) a fresh default each time the viewer lands on a
  // different state than `name` last was: a client-side navigation between two state pages reuses
  // this component instance, so plain useState would carry the old state's selection over.
  const appliedDefaultForRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading || !master) return;
    if (appliedDefaultForRef.current === name) return;
    appliedDefaultForRef.current = name;
    applyDefaultView(stateRows);
  }, [name, loading, master, stateRows]);

  if (loading) return <p className="detail-placeholder">Loading…</p>;
  if (error || !master) return <p className="detail-placeholder">Could not load dashboard data.</p>;

  if (!stateIsTracked(master, name)) {
    return (
      <div className="state-page state-page--empty">
        {/* the same back button + breadcrumb row as a state with data */}
        <div className="state-topbar">
          <button type="button" className="back-btn" onClick={() => router.push(MAP_HREF)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Map
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
  const color = `var(--state-accent, ${stateHueMap(master.state_order)[name] || '#8B1A1A'})`;

  const discomOpts = discoms.map((d) => ({ key: d.code, label: d.code }));
  const inDiscoms = (keys: string[]) => stateRows.filter((r) => keys.length === 0 || keys.includes(r.discom_code));
  const discomScope = inDiscoms(selectedDiscoms);
  // the sheet's own category heads each group; `type` carries the indicator family
  const allIndicatorOpts: IndicatorOption[] = indicatorOptionsFor(discomScope).map((o) => ({ indicator: o.indicator, category: o.category, type: o.family }));
  const categoryOpts = [...new Set(allIndicatorOpts.map((o) => o.category))].map((c) => ({ key: c, label: c }));
  const inCategories = (o: IndicatorOption, cats: string[]) => cats.length === 0 || cats.includes(o.category);
  const indicatorOpts = allIndicatorOpts.filter((o) => inCategories(o, selectedCategories));
  const indicatorRank = indicatorStrength(discomScope);

  // category change: keep the picked indicators still in it, else the first one it offers
  function changeCategories(next: string[]) {
    setSelectedCategories(next);
    const opts = allIndicatorOpts.filter((o) => inCategories(o, next));
    const kept = selectedIndicators.filter((i) => opts.some((o) => o.indicator === i));
    setSelectedIndicators(kept.length ? kept : opts.length ? [opts[0].indicator] : []);
    setFallbackNote(null);
  }

  // DISCOM change: keep whichever picked indicators the new DISCOM selection still has; if none
  // survive, fall back to that selection's own default rather than leaving the page empty.
  function changeDiscoms(next: string[]) {
    const scope = inDiscoms(next);
    const available = new Set(scope.map((r) => r.indicator));
    const kept = selectedIndicators.filter((i) => available.has(i));
    setSelectedDiscoms(next);
    // still on the default picks: move to the new DISCOM selection's own primaries
    const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
    if (sameSet(selectedIndicators, defaultIndicators(name, selectedDiscoms, inDiscoms(selectedDiscoms)))) {
      setSelectedIndicators(defaultIndicators(name, next, scope));
      setFallbackNote(null);
      return;
    }
    if (kept.length > 0 || selectedIndicators.length === 0) {
      setSelectedIndicators(kept);
      setFallbackNote(null);
      return;
    }
    const preferred = defaultIndicators(name, next, scope)[0] ?? null;
    const n = selectedIndicators.length;
    const lost = n === 1 ? selectedIndicators[0] : selectedIndicators.slice(0, -1).join(', ') + ' and ' + selectedIndicators[n - 1];
    const verb = n === 1 ? 'isn’t' : 'aren’t';
    const forWhom = next.length === 1 ? next[0] : 'the selected DISCOMs';
    setSelectedIndicators(preferred ? [preferred] : []);
    setFallbackNote(
      preferred
        ? `${lost} ${verb} in the sheet for ${forWhom}, so we’re showing ${preferred} instead.`
        : `${lost} ${verb} in the sheet for ${forWhom}, and it has no other indicator for it.`,
    );
  }

  // Reset only appears once the view differs from the page-load default (see applyDefaultView)
  const defDiscom = defaultDiscom(name, discoms.map((x) => x.code), stateRows);
  const defaultInds = defaultIndicators(name, defDiscom ? [defDiscom] : [], inDiscoms(defDiscom ? [defDiscom] : []));
  const atDefault =
    (defDiscom ? selectedDiscoms.length === 1 && selectedDiscoms[0] === defDiscom : selectedDiscoms.length === 0) &&
    selectedCategories.length === 0 &&
    selectedIndicators.length === defaultInds.length &&
    selectedIndicators.every((i) => defaultInds.includes(i));
  const shownDiscoms = selectedDiscoms.length ? discoms.filter((d) => selectedDiscoms.includes(d.code)) : discoms;

  // plain counts of what the sheet lists, never a score
  const discomCount = discoms.length;
  const reportedYears = fyRunsLabel(stateReportedYears(master, name), YEARS_ASC) || 'N/A';
  // placeholder ownership label, not real per-DISCOM ownership data, see StateDetail.tsx history
  const ownershipLabel = name === 'Odisha' ? 'All public-private joint venture' : 'All state-government owned';

  return (
    <div className="state-page">
      <div className="state-topbar">
        <button type="button" className="back-btn" onClick={() => router.push(MAP_HREF)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Map
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
        {discoms.length > 0 && (
          <div className="state-hero-discoms">
            {/* one per line: short name (fixed-width column, so the full names line up) then the
                full name. 5+ DISCOMs split into two side-by-side lists to keep the card short. */}
            <div className={`hero-discom-list${discoms.length >= 5 ? ' hero-discom-list--split' : ''}`}>
              {/* the state's regulator heads the list in the same two columns, so it reads as the
                  body the DISCOMs below answer to */}
              {REGULATORS[name] && (
                <div className="hero-regulator" role="note" aria-label="Regulator">
                  <b>{REGULATORS[name].abbr}</b>
                  <span>{REGULATORS[name].name}</span>
                </div>
              )}
              {(discoms.length >= 5 ? [discoms.slice(0, Math.ceil(discoms.length / 2)), discoms.slice(Math.ceil(discoms.length / 2))] : [discoms]).map((col, ci) => (
                <ul key={ci} aria-label="DISCOMs">
                  {/* code then the sheet's discom_name, or discomFullName's where the sheet gives only the code */}
                  {col.map((d) => {
                    const full = discomFullName(d.code, d.name);
                    return (
                      <li key={d.code} className={full === d.code ? 'hero-discom-list-fullonly' : undefined}>
                        {full !== d.code && <b>{d.code}</b>}
                        <span>{full}</span>
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
          <label>Select DISCOM</label>
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

        <div className="toolbar-field">
          <label>Select Category</label>
          <DiscomMultiSelect
            options={categoryOpts}
            selected={selectedCategories}
            label="Category"
            allLabel="All categories"
            summaryText={(sel, opts) => (sel.length === 0 || sel.length === opts.length ? 'All categories' : sel.length === 1 ? sel[0] : `${sel.length} categories`)}
            onChange={changeCategories}
          />
        </div>

        <div className="toolbar-field toolbar-field--indicator">
          <label>Select Indicator</label>
          <IndicatorSelect
            options={indicatorOpts}
            pinned={pinnedIndicators(name, selectedDiscoms)}
            rank={indicatorRank}
            selected={selectedIndicators}
            onChange={(next) => {
              setSelectedIndicators(next);
              setFallbackNote(null);
            }}
          />
        </div>

        {!atDefault && (
          <button type="button" className="toolbar-reset" onClick={() => applyDefaultView(stateRows)}>
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

      {selectedIndicators.length === 0 && <p className="detail-placeholder">Select at least one indicator above to view what the sheet reports for it.</p>}


      {/* one module per selected indicator, never merged across indicators */}
      {selectedIndicators.length > 0 && (
        <div className="im-stack">
          {selectedIndicators.map((ind) => {
            const rows = discomScope.filter((r) => r.indicator === ind);
            return rows.length ? <MasterIndicator key={ind} indicator={ind} rows={rows} discoms={shownDiscoms} yearsAsc={YEARS_ASC} /> : null;
          })}
        </div>
      )}

    </div>
  );
}

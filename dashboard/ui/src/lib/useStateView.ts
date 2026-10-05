'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useData } from './DataContext';
import { stateHasSopData } from './computations';
import { fyLabel } from './format';
import {
  buildUnifiedAtoms,
  buildUnifiedCards,
  buildUnifiedTableRows,
  discomOptions,
  matchesFilters,
  pickDefaultIndicator,
  type UnifiedFilters,
  type UnifiedIndicatorAtom,
} from './unifiedIndicators';
import type { IndicatorOption } from '@/components/IndicatorSelect';

/** Query-string keys the state overview and its Detailed Data page share, so the DISCOM / Indicator
 * / Year filters survive a refresh and the hop between the two pages. Indicators and DISCOMs are
 * repeated keys (`?indicator=A&indicator=B`) rather than one comma-joined value, since several SoP
 * indicator names contain commas themselves. */
const Q_DISCOM = 'discom';
const Q_INDICATOR = 'indicator';
const Q_YEAR = 'year';

/** All filter state and derived data for one state's pages (overview and Detailed Data) — one
 * DISCOM / Indicator / Year filter set driving both the indicator analysis and the source-record
 * table, so the two pages never disagree about what a filter means. Pure state + derivation; no
 * markup. Every hook runs unconditionally — callers branch on `loading`/`error`/`isEmpty` after. */
export function useStateView(name: string) {
  const { discoms, geojson, stateSpecific, loading, error } = useData();
  // the router's view of the URL — unlike window.location, already the *target* URL during the
  // first render after a client-side navigation
  const searchParams = useSearchParams();

  // DISCOM and Indicator are tickable multi-selects; an empty DISCOM list means "no constraint"
  // (all DISCOMs), but an empty `selectedIndicators` means nothing is shown at all until at least
  // one indicator is picked. Indicator Category and Indicator Type aren't filters of their own —
  // every indicator name belongs to exactly one category/type within a state, so they're derived
  // from the picked indicators (see `filters` below).
  const [selectedDiscoms, setSelectedDiscoms] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [showAllYears, setShowAllYears] = useState(true);
  // Set when a DISCOM change left none of the picked indicators available, so the page fell back
  // to that DISCOM selection's own default indicator instead of going empty — says what happened.
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);

  const YEARS_ASC = discoms ? [...discoms.years].reverse() : [];
  const allDs = discoms ? discoms.discoms.filter((d) => d.state === name) : [];
  const atoms = buildUnifiedAtoms(discoms, allDs, stateSpecific, name, YEARS_ASC);
  const isEmpty = !allDs.length && !stateHasSopData(stateSpecific, name);

  // The page-load default — also exactly what Reset returns to: all DISCOMs, the default indicator
  // (SAIDI if reported, else the most-reported one — see pickDefaultIndicator). Reset also returns
  // Year to "All years"; moving to another state's page leaves Year as it was.
  function applyDefaultView(stateAtoms: UnifiedIndicatorAtom[], resetYear: boolean) {
    const preferred = pickDefaultIndicator(stateAtoms);
    setSelectedDiscoms([]);
    setSelectedIndicators(preferred ? [preferred.indicator] : []);
    if (resetYear) {
      setSelectedYear(null);
      setShowAllYears(true);
    }
    setFallbackNote(null);
  }

  /** Restores filters from the URL (a refresh, or arriving from the other page of the pair).
   * Every value is validated against this state's own data — an unknown DISCOM/indicator/year is
   * dropped, and if no valid indicator survives, the normal default applies. Returns false when
   * the URL carries no filter at all. */
  function applyFromUrl(stateAtoms: UnifiedIndicatorAtom[], years: string[]): boolean {
    const params = searchParams;
    if (!params.has(Q_DISCOM) && !params.has(Q_INDICATOR) && !params.has(Q_YEAR)) return false;
    const validDiscoms = new Set(stateAtoms.map((a) => a.discomKey));
    const ds = params.getAll(Q_DISCOM).filter((k) => validDiscoms.has(k));
    const scope = stateAtoms.filter((a) => ds.length === 0 || ds.includes(a.discomKey));
    const validIndicators = new Set(scope.map((a) => a.indicator));
    const inds = params.getAll(Q_INDICATOR).filter((i) => validIndicators.has(i));
    const year = params.get(Q_YEAR);
    setSelectedDiscoms(ds);
    if (inds.length) setSelectedIndicators(inds);
    else {
      const preferred = pickDefaultIndicator(scope);
      setSelectedIndicators(preferred ? [preferred.indicator] : []);
    }
    if (year && years.includes(year)) {
      setSelectedYear(year);
      setShowAllYears(false);
    } else {
      setSelectedYear(null);
      setShowAllYears(true);
    }
    setFallbackNote(null);
    return true;
  }

  // Re-picks (and resets every filter for) a fresh default — or the filters in the URL — each time
  // the viewer lands on a *different* state/UT than `name` last was. Covers both the first mount and
  // a client-side navigation between two state pages, which reuses this same component instance
  // (same dynamic route, just a different `name` prop) rather than remounting it. Done during
  // render (React's "adjust state when a prop changes" pattern) rather than in an effect, so the
  // first painted frame already has the right filters. Guarded on `name`, not on the current
  // filter values, so deliberately clearing a selection never re-triggers this on its own.
  const [appliedFor, setAppliedFor] = useState<string | null>(null);
  if (!loading && (discoms || stateSpecific) && appliedFor !== name) {
    setAppliedFor(name);
    if (!applyFromUrl(atoms, discoms?.years ?? [])) applyDefaultView(atoms, false);
  }

  const activeYear = discoms ? (selectedYear ?? (discoms.years.includes('2023-24') ? '2023-24' : discoms.years[0])) : '';

  const defaultIndicator = pickDefaultIndicator(atoms)?.indicator ?? null;
  // Reset only appears once the view differs from the page-load default (see applyDefaultView)
  const atDefault =
    selectedDiscoms.length === 0 &&
    showAllYears &&
    selectedYear == null &&
    (defaultIndicator ? selectedIndicators.length === 1 && selectedIndicators[0] === defaultIndicator : selectedIndicators.length === 0);

  // The current filters as a query string ('' at the default view) — kept in the address bar so a
  // refresh restores them, and carried on the links between the overview and Detailed Data pages.
  const params = new URLSearchParams();
  if (!atDefault) {
    for (const d of selectedDiscoms) params.append(Q_DISCOM, d);
    for (const i of selectedIndicators) params.append(Q_INDICATOR, i);
    if (!showAllYears) params.set(Q_YEAR, activeYear);
  }
  const queryString = params.toString() ? `?${params.toString()}` : '';

  useEffect(() => {
    // only once this state's own filters have been restored — writing earlier would replace the
    // incoming URL with the previous state's (or empty) filters before they were ever read
    if (appliedFor !== name) return;
    if (window.location.search === queryString) return;
    window.history.replaceState(null, '', window.location.pathname + queryString);
  }, [appliedFor, name, queryString]);

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

  function changeIndicators(next: string[]) {
    setSelectedIndicators(next);
    setFallbackNote(null);
  }

  /** 'all' = every fiscal year; otherwise focus on that one year */
  function changeYear(v: string) {
    if (v === 'all') {
      setShowAllYears(true);
    } else {
      setSelectedYear(v);
      setShowAllYears(false);
    }
  }

  // Nothing shown — indicator analysis or source records — until at least one indicator is
  // explicitly selected: an empty `filteredAtoms` empties both `cards` and `tableRows`.
  const filteredAtoms = selectedIndicators.length === 0 ? [] : atoms.filter((a) => matchesFilters(a, filters));
  const cards = buildUnifiedCards(filteredAtoms);
  const allTableRows = buildUnifiedTableRows(filteredAtoms);
  const tableRows = showAllYears ? allTableRows : allTableRows.filter((r) => r.fy === fyLabel(activeYear) || r.fy === 'All years');

  const fyRange = YEARS_ASC.length > 1 ? `${fyLabel(YEARS_ASC[0])}–${fyLabel(YEARS_ASC[YEARS_ASC.length - 1])}` : YEARS_ASC.length ? fyLabel(YEARS_ASC[0]) : '';

  return {
    discoms,
    geojson,
    stateSpecific,
    loading,
    error,
    isEmpty,
    YEARS_ASC,
    allDs,
    atoms,
    discomOpts,
    indicatorOpts,
    selectedDiscoms,
    selectedIndicators,
    selectedYear,
    showAllYears,
    setShowAllYears,
    activeYear,
    fallbackNote,
    dismissFallbackNote: () => setFallbackNote(null),
    changeDiscoms,
    changeIndicators,
    changeYear,
    reset: () => applyDefaultView(atoms, true),
    atDefault,
    queryString,
    cards,
    tableRows,
    fyRange,
  };
}

export type StateView = ReturnType<typeof useStateView>;

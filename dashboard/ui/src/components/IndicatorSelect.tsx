'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import FilterDropdown from './FilterDropdown';

export interface IndicatorOption {
  indicator: string;
  category: string;
  type: string;
}

interface Props {
  options: IndicatorOption[];
  selected: string[];
  /** key indicators, listed first under their own heading, in this order */
  pinned?: string[];
  /** Strongest first within each category (indicatorStrength); alphabetical when absent or tied. */
  rank?: Map<string, number>;
  onChange: (next: string[]) => void;
}

/** Collapsed value for 2+ indicators: both names ("SAIDI · SAIFI") when two fit the field on one
 * line, otherwise "N indicators selected". Fit is measured, not guessed from character counts,
 * a hidden copy of the joined names is compared with the room the field actually has, and
 * re-checked whenever the field resizes. */
function MultiSummary({ names }: { names: string[] }) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fits, setFits] = useState(false);
  const joined = names.join(' · ');
  const tryNames = names.length === 2;

  useLayoutEffect(() => {
    const box = boxRef.current;
    const measure = measureRef.current;
    if (!tryNames || !box || !measure) return;
    const check = () => setFits(measure.offsetWidth <= box.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(box);
    return () => ro.disconnect();
  }, [tryNames, joined]);

  return (
    <span ref={boxRef} className="filter-value-main filter-value-fill">
      {tryNames && fits ? joined : `${names.length} indicators selected`}
      {tryNames && (
        <span ref={measureRef} className="filter-value-measure" aria-hidden="true">
          {joined}
        </span>
      )}
    </span>
  );
}

/** The State Performance page's one Indicator filter, replaces the old Category → Type →
 * Indicator cascade. Every indicator name belongs to exactly one category/type in every state (see
 * StateDetail), so picking indicators directly loses nothing: the list shows a
 * Category → Indicator hierarchy as headings (only the indicators are selectable), the category
 * being the master sheet's own `category` column. Multi-select (checkbox list) like the other
 * filters, with a type-to-search box that matches the indicator, its family or its category. Deliberately no "select all" at
 * any level, every indicator is its own page section, so all of them at once is never useful;
 * Reset clears the selection. The closed
 * trigger names what's selected: the indicator itself (its type as secondary text) for one, both
 * names or a count for several (see MultiSummary). The trigger/menu shell is the shared
 * FilterDropdown. */
const KEY_GROUP = 'Key indicators';

export default function IndicatorSelect({ options, selected, pinned = [], rank, onChange }: Props) {
  const [query, setQuery] = useState('');
  // a category heading clicked in the list: only that category's indicators show until clicked again
  const [onlyCat, setOnlyCat] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    // the sheet's own category → indicators, categories in the order the options list them
    const byBucket = new Map<string, string[]>();
    for (const o of options) {
      if (onlyCat && o.category !== onlyCat) continue;
      if (q && ![o.indicator, o.category, o.type].some((s) => s.toLowerCase().includes(q))) continue;
      (byBucket.get(o.category) ?? byBucket.set(o.category, []).get(o.category)!).push(o.indicator);
    }
    // the key indicators head the list once, and leave their category groups
    const top = pinned.filter((i) => [...byBucket.values()].some((l) => l.includes(i)));
    const rest = [...byBucket]
      .map(([bucket, indicators]) => ({
        bucket,
        indicators: [...new Set(indicators.filter((i) => !top.includes(i)))].sort(
          (a, b) => (rank?.get(b) ?? 0) - (rank?.get(a) ?? 0) || a.localeCompare(b),
        ),
      }))
      .filter((g) => g.indicators.length);
    return top.length ? [{ bucket: KEY_GROUP, indicators: top }, ...rest] : rest;
  }, [options, query, onlyCat, pinned, rank]);

  const singleCat = new Set(options.map((o) => o.category)).size === 1;

  function toggle(indicator: string) {
    onChange(selected.includes(indicator) ? selected.filter((k) => k !== indicator) : [...selected, indicator]);
  }

  const single = selected.length === 1 ? options.find((o) => o.indicator === selected[0]) : undefined;

  return (
    <FilterDropdown
      value={
        selected.length === 0 ? (
          <span className="filter-value-placeholder">Select an indicator</span>
        ) : single ? (
          <>
            <span className="filter-value-main">{single.indicator}</span>
            <span className="filter-value-sub">{single.category}</span>
          </>
        ) : (
          <MultiSummary names={selected} />
        )
      }
      ariaLabel={`Indicator: ${selected.length === 0 ? 'none selected' : single ? `${single.indicator}, ${single.category}` : selected.join(', ')}`}
      panelClassName="indicator-select-panel"
      maxHeight={340}
      minPanelWidth={260}
      initialFocus={() => searchRef.current}
      onClose={() => {
        setQuery('');
        setOnlyCat(null);
      }}
    >
      <>
        <input
          ref={searchRef}
          type="search"
          className="indicator-select-search"
          placeholder="Search indicators"
          aria-label="Search indicators"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {groups.length === 0 && <p className="indicator-select-empty">No indicator matches “{query}”</p>}
        {groups.map((g) => (
          <div key={g.bucket} role="group" aria-label={g.bucket} className="indicator-select-group">
            {/* one category on offer (the Category filter picked it): its heading would only repeat the filter */}
            {g.bucket === KEY_GROUP ? (
              <div className="indicator-select-category">{KEY_GROUP}</div>
            ) : singleCat ? null : (
            <button
              type="button"
              className={`indicator-select-category indicator-select-category--btn${onlyCat ? ' is-only' : ''}`}
              aria-pressed={onlyCat === g.bucket}
              title={onlyCat ? 'Show all categories' : `Show only ${g.bucket}`}
              onClick={() => setOnlyCat(onlyCat ? null : g.bucket)}
            >
              {onlyCat && <span aria-hidden="true">‹ </span>}
              {g.bucket}
              {onlyCat && <span className="indicator-select-category-all"> · all categories</span>}
            </button>
            )}
            {g.indicators.map((ind) => (
              <label key={ind} className="discom-multiselect-option">
                <input type="checkbox" checked={selected.includes(ind)} onChange={() => toggle(ind)} />
                <span>{ind}</span>
              </label>
            ))}
          </div>
        ))}
      </>
    </FilterDropdown>
  );
}

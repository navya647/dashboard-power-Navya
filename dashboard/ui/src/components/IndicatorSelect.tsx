'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BUCKET_ORDER, UNMAPPED_BUCKET, bucketFor } from '@/lib/indicatorBuckets';
import FilterDropdown from './FilterDropdown';

export interface IndicatorOption {
  indicator: string;
  category: string;
  type: string;
}

interface Props {
  options: IndicatorOption[];
  selected: string[];
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
 * Bucket → Category → Indicator hierarchy as headings (only the indicators are selectable), the
 * bucket (Quality of Supply / Service / Safety) from indicatorBuckets.ts, the category from the
 * data itself (or its raw type, where the category is just the generic "Other"). Multi-select
 * (checkbox list) like the other filters, with a type-to-search box that matches the indicator,
 * type, category or bucket and keeps a match's parent headings. Deliberately no "select all" at
 * any level, every indicator is its own page section, so all of them at once is never useful;
 * Reset clears the selection. The closed
 * trigger names what's selected: the indicator itself (its type as secondary text) for one, both
 * names or a count for several (see MultiSummary). The trigger/menu shell is the shared
 * FilterDropdown. */
export default function IndicatorSelect({ options, selected, onChange }: Props) {
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    // indicator category → indicators
    const byBucket = new Map<string, string[]>();
    for (const o of options) {
      const bucket = bucketFor(o.category, o.type, o.indicator);
      if (q && ![o.indicator, bucket].some((s) => s.toLowerCase().includes(q))) continue;
      (byBucket.get(bucket) ?? byBucket.set(bucket, []).get(bucket)!).push(o.indicator);
    }
    return [...BUCKET_ORDER, UNMAPPED_BUCKET]
      .filter((bucket) => byBucket.has(bucket))
      .map((bucket) => ({
        bucket,
        indicators: [...byBucket.get(bucket)!].sort((a, b) => a.localeCompare(b)),
      }));
  }, [options, query]);

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
            <span className="filter-value-sub">{bucketFor(single.category, single.type, single.indicator)}</span>
          </>
        ) : (
          <MultiSummary names={selected} />
        )
      }
      ariaLabel={`Indicator: ${selected.length === 0 ? 'none selected' : single ? `${single.indicator}, ${bucketFor(single.category, single.type, single.indicator)}` : selected.join(', ')}`}
      panelClassName="indicator-select-panel"
      maxHeight={340}
      minPanelWidth={260}
      initialFocus={() => searchRef.current}
      onClose={() => setQuery('')}
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
            <div className="indicator-select-category" aria-hidden="true">
              {g.bucket}
            </div>
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

'use client';

import type { StateView } from '@/lib/useStateView';
import DiscomMultiSelect from './DiscomMultiSelect';
import IndicatorSelect from './IndicatorSelect';
import YearSelect from './YearSelect';

/** The one DISCOM / Indicator / Year control bar shared by the state overview and its Detailed
 * Data page — a light row on the page background, not a card. All behaviour lives in
 * useStateView; this only renders the controls. */
export default function StateFilters({ view, sticky = false }: { view: StateView; sticky?: boolean }) {
  return (
    <>
      <div className={`so-filters${sticky ? ' so-filters--sticky' : ''}`} role="group" aria-label="Filters">
        <div className="toolbar-field">
          <label>DISCOM</label>
          <DiscomMultiSelect
            options={view.discomOpts}
            selected={view.selectedDiscoms}
            label="DISCOM"
            allLabel="All DISCOMs"
            summaryText={(sel, opts) =>
              sel.length === 0 || sel.length === opts.length ? 'All DISCOMs' : sel.length === 1 ? (opts.find((o) => o.key === sel[0])?.label ?? '1 DISCOM') : `${sel.length} DISCOMs`
            }
            onChange={view.changeDiscoms}
          />
        </div>

        <div className="toolbar-field toolbar-field--indicator">
          <label>Indicator</label>
          <IndicatorSelect options={view.indicatorOpts} selected={view.selectedIndicators} onChange={view.changeIndicators} />
        </div>

        <div className="toolbar-field">
          <label>Year</label>
          <YearSelect years={view.YEARS_ASC} value={view.showAllYears ? 'all' : view.activeYear} onChange={view.changeYear} />
        </div>

        <div className="so-filters-reset">
          {!view.atDefault && (
            <button type="button" className="toolbar-reset" onClick={view.reset}>
              Reset
            </button>
          )}
        </div>
      </div>

      {view.fallbackNote && (
        <p className="filter-fallback-note so-fallback-note" role="status">
          <span>{view.fallbackNote}</span>
          <button type="button" aria-label="Dismiss note" onClick={view.dismissFallbackNote}>
            ×
          </button>
        </p>
      )}
    </>
  );
}

'use client';

import FilterDropdown from './FilterDropdown';

interface Option {
  key: string;
  label: string;
}

interface Props {
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Plural noun for the trigger's summary text ("2 of 5 Indicators") — defaults to the DISCOM
   * picker this component started as. */
  noun?: string;
  /** Overrides the trigger's summary text — the State Performance page names what's selected
   * ("All DISCOMs", "AVVNL", "2 DISCOMs") instead of the default "x of y" counts. */
  summaryText?: (selected: string[], options: Option[]) => string;
  /** accessible name prefix for the trigger, e.g. "DISCOM" → "DISCOM: All DISCOMs" */
  label?: string;
  /** When set, adds an "All …" row at the top of the list — ticked whenever nothing specific is
   * picked (an empty selection already means "all"), and picking it clears the selection. */
  allLabel?: string;
}

/** A tickable dropdown (checkbox list behind a trigger button) for picking any subset of a list of
 * options — originally just the Compare page's per-state DISCOM picker (replacing the old
 * single-choice `<select>`, which only ever picked one DISCOM or a fixed "all DISCOMs" median), now
 * reused for the State Performance page's DISCOM filter too. The trigger/menu shell (portal
 * layering, outside-click and Escape to close, keyboard focus) is the shared FilterDropdown. */
export default function DiscomMultiSelect({ options, selected, onChange, noun = 'DISCOMs', summaryText, label, allLabel }: Props) {
  function toggle(key: string) {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }

  const summary = summaryText
    ? summaryText(selected, options)
    : selected.length === 0
      ? 'None selected'
      : selected.length === options.length
        ? `All ${options.length} ${noun}`
        : `${selected.length} of ${options.length} ${noun}`;

  return (
    <FilterDropdown value={<span className="filter-value-main">{summary}</span>} ariaLabel={label ? `${label}: ${summary}` : undefined} maxHeight={280}>
      <>
        {allLabel && (
          <label className="discom-multiselect-option discom-multiselect-option--all">
            <input type="checkbox" checked={selected.length === 0 || selected.length === options.length} onChange={() => onChange([])} />
            <span>{allLabel}</span>
          </label>
        )}
        {options.map((o) => (
          <label key={o.key} className="discom-multiselect-option">
            <input type="checkbox" checked={selected.includes(o.key)} onChange={() => toggle(o.key)} />
            <span>{o.label}</span>
          </label>
        ))}
      </>
    </FilterDropdown>
  );
}

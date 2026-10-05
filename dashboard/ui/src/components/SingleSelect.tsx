'use client';

import { useRef } from 'react';
import FilterDropdown from './FilterDropdown';

export interface SingleSelectOption {
  value: string;
  label: string;
}

interface Props {
  /** accessible name of the control, e.g. "Year" */
  name: string;
  /** the first option is the "all" row (styled as such) */
  options: SingleSelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** extra class(es) on the menu panel, e.g. to cap its width for long labels */
  panelClassName?: string;
}

/** A single-select filter on the shared FilterDropdown shell, with the same row styling as the
 * DISCOM and Indicator filters instead of a native <select>, whose OS-drawn menu couldn't match
 * them. Picking a row selects it and closes the menu; ↑/↓ move between rows, and the current value
 * carries a tick in the same slot the other menus use for checkboxes. */
export default function SingleSelect({ name, options, value, onChange, panelClassName }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  function onListKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const rows = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])];
    const i = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
    rows[next]?.focus();
  }

  return (
    <FilterDropdown
      value={<span className="filter-value-main">{current.label}</span>}
      ariaLabel={`${name}: ${current.label}`}
      panelClassName={panelClassName}
      initialFocus={() => listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')}
    >
      <div ref={listRef} role="listbox" aria-label={name} onKeyDown={onListKeyDown}>
        {options.map((o, i) => {
          const isSelected = o.value === current.value;
          return (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`discom-multiselect-option year-select-option${i === 0 ? ' discom-multiselect-option--all' : ''}`}
              data-close-menu
              onClick={() => {
                if (!isSelected) onChange(o.value);
              }}
            >
              <span className="year-select-tick" aria-hidden="true" />
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
    </FilterDropdown>
  );
}

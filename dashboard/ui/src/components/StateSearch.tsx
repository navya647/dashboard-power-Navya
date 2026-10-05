'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MAP_STATUS_LABEL, stateMapStatus, type StateMapStatus } from '@/lib/computations';
import type { Discom, StateSpecificData } from '@/lib/types';

interface Props {
  /** every state/UT on the map (the geojson's own names), in any order — sorted here */
  names: string[];
  discoms: Discom[];
  stateSpecific?: StateSpecificData | null;
  compareMode: boolean;
  compareSet: string[];
  /** same handler a map click goes through — navigates, or toggles the comparison in compare mode */
  onSelect: (name: string) => void;
  /** the option currently hovered / keyboard-active, so the map can highlight that region */
  onHighlight: (name: string | null) => void;
  /** id of the hint line the card renders under the input */
  describedBy?: string;
}

const STATUS_DOT: Record<StateMapStatus, string> = {
  tracked: 'map-legend-dot--tracked',
  'no-data': 'map-legend-dot--no-data',
  idle: 'map-legend-dot--none',
};

/** "&" and "and" are interchangeable in the geojson's names (Jammu & Kashmir vs. Dadra and Nagar
 * Haveli and Daman and Diu), so a search for either spelling matches both. */
function norm(s: string) {
  return s.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
}

/** A by-name alternative to clicking the map: an ARIA 1.2 combobox (editable input + listbox
 * popup, aria-activedescendant focus) listing every state/UT with its map-legend status dot.
 * Selecting an option goes through exactly the same handler as a map click, and the hovered /
 * keyboard-active option is reported up so the map highlights that region while browsing. */
export default function StateSearch({ names, discoms, stateSpecific, compareMode, compareSet, onSelect, onHighlight, describedBy }: Props) {
  const uid = useId().replace(/:/g, '');
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const items = useMemo(
    () =>
      [...names]
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ name, status: stateMapStatus(discoms, name, stateSpecific) })),
    [names, discoms, stateSpecific],
  );
  const filtered = useMemo(() => {
    const q = norm(query);
    return q ? items.filter((it) => norm(it.name).includes(q)) : items;
  }, [items, query]);

  // in compare mode a "Coming soon" jurisdiction can't be compared — same rule HeroMap applies
  const isDisabled = (status: StateMapStatus) => compareMode && status === 'idle';
  const activeItem = open && active >= 0 ? filtered[active] : undefined;

  // drive the map highlight off whichever option is active (hover and arrow keys both set it)
  const activeName = activeItem?.name ?? null;
  useEffect(() => {
    onHighlight(activeName);
  }, [activeName, onHighlight]);
  useEffect(() => () => onHighlight(null), [onHighlight]);

  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`#${uid}-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, uid]);

  function choose(index: number) {
    const it = filtered[index];
    if (!it || isDisabled(it.status)) return;
    onSelect(it.name);
    if (compareMode) {
      // stay open so several jurisdictions can be added in a row
      setActive(index);
      return;
    }
    setQuery(it.name);
    setOpen(false);
    setActive(-1);
  }

  function move(delta: number) {
    if (!filtered.length) return;
    setOpen(true);
    setActive((i) => {
      if (!open || i < 0) return delta > 0 ? 0 : filtered.length - 1;
      return (i + delta + filtered.length) % filtered.length;
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (e.altKey) setOpen(true);
        else move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Enter':
        if (open && active >= 0) {
          e.preventDefault();
          choose(active);
        }
        break;
      case 'Escape':
        e.preventDefault();
        if (open) {
          setOpen(false);
          setActive(-1);
        } else {
          setQuery('');
        }
        break;
      case 'Tab':
        setOpen(false);
        setActive(-1);
        break;
    }
  }

  return (
    <div className="state-search-field">
      <svg className="state-search-icon" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        id={inputId}
        className="state-search-input"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeItem ? `${uid}-opt-${active}` : undefined}
        aria-label="Search a state or UT"
        aria-describedby={describedBy}
        autoComplete="off"
        spellCheck={false}
        placeholder="Select a state or UT"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(e.target.value ? 0 : -1);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="state-search-toggle"
        tabIndex={-1}
        aria-label={open ? 'Close list' : 'Open list'}
        // keep focus in the input so the combobox stays the one focus target
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setOpen((o) => !o);
          inputRef.current?.focus();
        }}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" data-open={open}>
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="States and union territories"
        className="state-search-list"
        hidden={!open}
        onMouseLeave={() => setActive(-1)}
      >
        {filtered.map((it, i) => {
          const disabled = isDisabled(it.status);
          const inCompare = compareMode && compareSet.includes(it.name);
          return (
            <li
              key={it.name}
              id={`${uid}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              aria-disabled={disabled || undefined}
              className={`state-search-option${i === active ? ' active' : ''}${disabled ? ' disabled' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(i)}
            >
              <span className={`map-legend-dot ${STATUS_DOT[it.status]}`} aria-hidden="true" />
              <span className="state-search-name">{it.name}</span>
              <span className="sr-only">
                , {MAP_STATUS_LABEL[it.status]}
                {disabled && ', not available for comparison'}
                {inCompare && ', in comparison'}
              </span>
              {inCompare && (
                <svg className="state-search-check" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="state-search-empty" role="presentation">
            No state or UT matches “{query}”
          </li>
        )}
      </ul>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';

interface Option {
  key: string;
  label: string;
}

interface Props {
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
}

/** A tickable dropdown (checkbox list behind a trigger button) for picking any subset of one
 * state's DISCOMs on the Compare page — replaces the old single-choice `<select>` (which only ever
 * picked one DISCOM, or a fixed "all DISCOMs" median). Outside-click-to-close mirrors Sidebar's own
 * pointerdown handling, the only other dismissible panel in this codebase. */
export default function DiscomMultiSelect({ options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  function toggle(key: string) {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }

  const summary = selected.length === 0 ? 'None selected' : selected.length === options.length ? `All ${options.length} DISCOMs` : `${selected.length} of ${options.length} DISCOMs`;

  return (
    <div className="discom-multiselect" ref={rootRef}>
      <button type="button" className="discom-multiselect-trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{summary}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="discom-multiselect-panel">
          {options.map((o) => (
            <label key={o.key} className="discom-multiselect-option">
              <input type="checkbox" checked={selected.includes(o.key)} onChange={() => toggle(o.key)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

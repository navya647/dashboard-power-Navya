'use client';

import { useId } from 'react';
import type { ReactNode } from 'react';

interface Props {
  /** the state/UT combobox (StateSearch) — the card's one input, shared by both modes */
  renderSearch: (hintId: string) => ReactNode;
  /** dot color per selected region — the same hue the map tints it with */
  colorOf: (name: string) => string | null;
  compareSet: string[];
  onRemove: (name: string) => void;
  onCompare: () => void;
  onClearAll: () => void;
  compareMode: boolean;
  onCompareModeChange: (on: boolean) => void;
}

/** The home page's one map tool, "Explore the data". A View / Compare segmented control decides
 * what a pick does — from the search list or a map click alike: View opens that region's page,
 * Compare adds/removes it from the comparison set. The chips + Compare footer exists only in
 * Compare mode (collapsed away in View so the card stays compact), and the selection survives
 * switching back to View so it's never lost by accident. */
export default function ComparePanel({ renderSearch, colorOf, compareSet, onRemove, onCompare, onClearAll, compareMode, onCompareModeChange }: Props) {
  const uid = useId().replace(/:/g, '');
  const hintId = `${uid}-hint`;
  const n = compareSet.length;

  const hint = compareMode
    ? 'Select two or more states or UTs from the dropdown above or by clicking on the map to compare the performance of their DISCOMs.'
    : 'Select a state or UT from the dropdown above, or click one on the map, to explore the performance of its DISCOMs.';
  // one polite live region covers both announcements: it changes on a mode switch, and on every
  // add/remove while comparing
  const status = compareMode
    ? `Compare mode. ${n === 0 ? 'No regions' : n === 1 ? '1 region' : `${n} regions`} selected${n < 2 ? '; select at least 2 to compare' : ''}.`
    : 'View mode. Selecting a region opens its page.';

  return (
    <aside className="control-panel explore-panel" aria-labelledby={`${uid}-title`}>
      <h3 className="explore-title" id={`${uid}-title`}>
        Explore the data
      </h3>

      <div className="explore-mode" role="radiogroup" aria-label="Mode">
        {[
          { on: false, label: 'View' },
          { on: true, label: 'Compare' },
        ].map((m) => (
          <label key={m.label} className="explore-mode-option" data-checked={compareMode === m.on}>
            <input
              type="radio"
              name={`${uid}-mode`}
              className="explore-mode-input"
              checked={compareMode === m.on}
              onChange={() => onCompareModeChange(m.on)}
            />
            <span>{m.label}</span>
          </label>
        ))}
      </div>

      {renderSearch(hintId)}
      <p className="control-hint explore-hint" id={hintId}>
        {hint}
      </p>

      <p className="sr-only" aria-live="polite">
        {status}
      </p>

      {/* collapsed (and inert, so nothing inside is focusable) in View mode */}
      <div className="explore-footer-wrap" data-open={compareMode} inert={!compareMode}>
        <div className="explore-footer">
          {n > 0 && (
            <ul className="multiselect-chips explore-chips" aria-label="Selected for comparison">
              {compareSet.map((name) => (
                <li className="multiselect-chip" key={name}>
                  <span className="dot" style={{ background: colorOf(name) ?? '#999' }} aria-hidden="true" />
                  {name}
                  <button type="button" aria-label={`Remove ${name}`} onClick={() => onRemove(name)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="explore-actions">
            <button type="button" className="control-compare-btn" disabled={n < 2} onClick={onCompare}>
              {n < 2 ? 'Select at least 2 to compare' : `Compare (${n})`}
            </button>
            {n > 0 && (
              <button type="button" className="explore-clear" onClick={onClearAll}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

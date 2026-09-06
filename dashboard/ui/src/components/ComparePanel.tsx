'use client';

interface Props {
  stateHue: Record<string, string>;
  compareSet: string[];
  onRemove: (name: string) => void;
  onCompare: () => void;
  onClearAll: () => void;
  compareMode: boolean;
  onToggleCompareMode: () => void;
}

/** A dedicated box for building a multi-state comparison — kept separate from the
 * "click one state" single-state popup so the two workflows (single-state lookup vs.
 * building a comparison set) don't compete for the same space. The map-selection toggle
 * decides what a map click does: off, clicking a state opens its popup (single-state lookup);
 * on, clicking adds/removes it from this comparison set instead. Map clicks are the only way to
 * build the set — no dropdown/search alternative — so the chips below are read-only (remove
 * only), just reflecting what's been clicked. */
export default function ComparePanel({ stateHue, compareSet, onRemove, onCompare, onClearAll, compareMode, onToggleCompareMode }: Props) {
  const n = compareSet.length;

  return (
    <aside className="control-panel">
      <div className="control-panel-head">
        <span className="control-panel-eyebrow">Analysis</span>
        <h3>Compare performance across jurisdictions</h3>
      </div>

      <button type="button" className="toggle-row" role="switch" aria-checked={compareMode} onClick={onToggleCompareMode}>
        <span className="toggle-switch" data-on={compareMode}>
          <span className="toggle-thumb" />
        </span>
        <span>Select states or UTs on the map</span>
      </button>

      {n > 0 && (
        <div className="multiselect-chips">
          {compareSet.map((name) => (
            <span className="multiselect-chip" key={name}>
              <span className="dot" style={{ background: stateHue[name] || '#999' }} />
              {name}
              <button type="button" aria-label={`Remove ${name}`} onClick={() => onRemove(name)}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <p className="control-hint">
        {n === 0 && 'Turn on map selection above, then click on jurisdictions to compare their performance.'}
        {n === 1 && 'Select at least one more jurisdiction to compare.'}
        {n >= 2 && `${n} jurisdictions selected.`}
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="control-compare-btn" disabled={n < 2} onClick={onCompare}>
          Compare {n >= 2 ? `(${n})` : ''}
        </button>
        <button type="button" className="control-ghost-btn" disabled={n === 0} onClick={onClearAll}>
          Clear
        </button>
      </div>
    </aside>
  );
}

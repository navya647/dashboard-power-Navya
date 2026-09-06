import { machineReadableDisplayStatus, type StateAccessibilityCoverage } from '@/lib/computations';
import type { DiscomAccessibility } from '@/lib/types';

interface StateRow {
  state: string;
  color: string;
  discoms: DiscomAccessibility[];
  coverage: StateAccessibilityCoverage;
}

interface Props {
  rows: StateRow[];
  activeState: string | null;
  onSelectState: (state: string | null) => void;
}

function DotRow({ discoms, pick }: { discoms: DiscomAccessibility[]; pick: (d: DiscomAccessibility) => boolean | null }) {
  return (
    <span className="dot-row" aria-hidden="true">
      {discoms.map((d, i) => {
        const status = pick(d);
        const cls = status === true ? 'dot-cell dot-cell-on' : status === false ? 'dot-cell dot-cell-off' : 'dot-cell dot-cell-na';
        return <span key={i} className={cls} />;
      })}
    </span>
  );
}

/** One continuous comparative visual across every currently tracked jurisdiction — never one card
 * per jurisdiction, so it grows with the dataset rather than needing a redesign. Each dot is one
 * DISCOM (filled = accessible, hollow = gap, muted = N/A); the two rows per jurisdiction make
 * publication and machine-readability both visible without collapsing them into a single score.
 * A jurisdiction's name is a plain text button (no card chrome) that applies it as the DISCOM
 * matrix's filter. */
export default function StateAccessibilityChart({ rows, activeState, onSelectState }: Props) {
  return (
    <div className="dot-matrix">
      <div className="dot-matrix-legend">
        <span className="dot-cell dot-cell-on" aria-hidden="true" /> accessible &nbsp;&nbsp;
        <span className="dot-cell dot-cell-off" aria-hidden="true" /> gap
      </div>
      {rows.map(({ state, color, discoms, coverage }) => {
        const n = coverage.licenseeCount;
        const isActive = activeState === state;
        return (
          <div key={state} className={`dot-matrix-row${isActive ? ' active' : ''}`}>
            <button type="button" className="dot-matrix-state" onClick={() => onSelectState(isActive ? null : state)} aria-pressed={isActive}>
              <span className="dot" style={{ background: color }} />
              {state}
            </button>
            {n > 0 ? (
              <div className="dot-matrix-lines">
                <div className="dot-matrix-line">
                  <span className="dot-matrix-line-label">Published</span>
                  <DotRow discoms={discoms} pick={(d) => d.available_on_serc} />
                  <span className="dot-matrix-line-value" aria-label={`Published: ${coverage.publishedCount} of ${n} DISCOMs`}>
                    {coverage.publishedCount}/{n}
                  </span>
                </div>
                <div className="dot-matrix-line">
                  <span className="dot-matrix-line-label">Machine-readable</span>
                  <DotRow discoms={discoms} pick={machineReadableDisplayStatus} />
                  <span className="dot-matrix-line-value" aria-label={`Machine-readable: ${coverage.machineReadableCount} of ${n} DISCOMs`}>
                    {coverage.machineReadableCount}/{n}
                  </span>
                </div>
              </div>
            ) : (
              <span className="dot-matrix-na">No DISCOMs tracked</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

import Collapsible from './Collapsible';
import StatusIcon from './StatusIcon';
import type { StateAccessibility } from '@/lib/types';

interface Props {
  states: StateAccessibility[];
  stateOrder: string[];
  stateHue: Record<string, string>;
}

/** Sits directly in the page flow — a flowing line of state identity dots, not a card, not a
 * 12-row table where every row says the same thing. The full record-level table (still exactly
 * as extracted) stays reachable behind a disclosure for anyone who needs it. */
export default function RegulationCoverageGrid({ states, stateOrder, stateHue }: Props) {
  const byState = new Map(states.map((s) => [s.state, s.regulation_available]));
  const availableCount = stateOrder.filter((s) => byState.get(s) === true).length;
  const allAvailable = stateOrder.length > 0 && availableCount === stateOrder.length;

  return (
    <div>
      <p className="reg-coverage-flow">
        {stateOrder.map((s, i) => (
          <span className="reg-coverage-item" key={s}>
            <span className="dot" style={{ background: stateHue[s] }} />
            {s}
            {i < stateOrder.length - 1 && <span className="reg-coverage-sep"> · </span>}
          </span>
        ))}
      </p>
      <p className="reg-coverage-summary">
        {allAvailable
          ? `Full coverage — all currently tracked jurisdictions have their SoP regulations available online.`
          : `${availableCount} of ${stateOrder.length} currently tracked jurisdictions have their SoP regulations available online.`}
      </p>

      <Collapsible label="View source detail">
        <div style={{ overflowX: 'auto' }}>
          <table className="std-table">
            <thead>
              <tr>
                <th>Jurisdiction</th>
                <th>Regulation Published Online</th>
              </tr>
            </thead>
            <tbody>
              {stateOrder.map((s) => (
                <tr key={s}>
                  <td style={{ fontWeight: 500 }}>
                    <span className="discom-chip" style={{ padding: 0 }}>
                      <span className="dot" style={{ background: stateHue[s] }} />
                      <span className="name">{s}</span>
                    </span>
                  </td>
                  <td>
                    <StatusIcon status={byState.get(s) ?? null} yesLabel="Published" noLabel="Not published" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Collapsible>
    </div>
  );
}

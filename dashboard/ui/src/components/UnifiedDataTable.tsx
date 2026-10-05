import type { UnifiedTableRow } from '@/lib/unifiedIndicators';

function MetPill({ met }: { met: boolean | null }) {
  if (met === true) return <span className="status-pill status-met">✓ Met</span>;
  if (met === false) return <span className="status-pill status-missed">✕ Not met</span>;
  return <span className="status-pill status-none">○ Not assessable</span>;
}

/** The single Excel-like source-data view for the whole State Performance page — one row per
 * matching source record from either dataset (a DISCOM's reported indicator in one FY, or a
 * state's notified framework indicator where no DISCOM ever reported one), driven by the same
 * DISCOM / Indicator Category / Indicator Type / Indicator filters as the chart cards above it.
 * Every field is lifted straight from the workbook — no derived score, grade, or percentage of any
 * kind; this table is the underlying data, the charts are the interpretive layer. */
export default function UnifiedDataTable({ rows }: { rows: UnifiedTableRow[] }) {
  if (!rows.length) {
    return <p className="detail-placeholder">No source records match the current filters.</p>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="detail-table">
        <thead>
          <tr>
            <th>DISCOM</th>
            <th>FY</th>
            <th>Indicator Category</th>
            <th>Indicator Type</th>
            <th>Indicator</th>
            <th>Standard Specified</th>
            <th>Benchmark</th>
            <th>Reported</th>
            <th>Standard Met?</th>
            <th>Regulation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td style={{ fontWeight: 500 }}>{r.discom}</td>
              <td>{r.fy}</td>
              <td>{r.category}</td>
              <td>{r.type || 'N/A'}</td>
              <td style={{ fontWeight: 500 }}>{r.indicator || 'N/A'}</td>
              <td>
                <div className="meaning">{r.standardSpecified || 'N/A'}</div>
              </td>
              <td>
                {r.benchmarkText ?? 'N/A'}
                <div className="meaning">{r.benchmarkMeaning || 'N/A'}</div>
              </td>
              <td>
                {r.reportedText ?? 'N/A'}
                <div className="meaning">{r.reportedMeaning || 'N/A'}</div>
                {r.note && <div className="meaning value-note">Note: {r.note}</div>}
              </td>
              <td>
                <MetPill met={r.standardMet} />
              </td>
              <td>
                <div className="meaning">{r.regulation || 'N/A'}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

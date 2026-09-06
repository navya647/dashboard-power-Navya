interface Limitation {
  title: string;
  statement: string;
}

/** Four general, structural limitations of the evidence-gathering process itself — never a
 * specific dated count ("6 of 12 states...") or a named jurisdiction, both of which would drift
 * out of date the moment new evidence is captured. Each statement stays true regardless of how
 * much the dataset has grown since it was written. */
const LIMITATIONS: Limitation[] = [
  { title: 'Data Availability', statement: 'Reported performance data is not currently available or captured for every jurisdiction and DISCOM.' },
  { title: 'Reporting Quality', statement: 'File formats, readability, reporting structure and volume vary across sources.' },
  { title: 'Benchmark Availability', statement: 'Regulatory benchmarks or directly comparable standards are not available for every indicator.' },
  { title: 'Comparability', statement: 'Similar indicator names may use different definitions, units, time periods or reporting bases.' },
];

/** Four quadrants separated by rules, not four raised/shadowed scorecards — one concise statement
 * per limitation, no dated specifics that could go stale. */
export default function MethodologyLimitations() {
  return (
    <div className="limitations-grid">
      {LIMITATIONS.map((item) => (
        <div className="limitation-cell" key={item.title}>
          <div className="limitation-title">{item.title}</div>
          <p className="limitation-statement">{item.statement}</p>
        </div>
      ))}
    </div>
  );
}

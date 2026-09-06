const STAGES = ['Extract', 'Cross-check', 'Structure', 'Dashboard'];

interface Props {
  jurisdictionCount: number;
}

/** One compact flow from source evidence to dashboard view — Sources, Data Compilation, and
 * Quality Assurance used to be three separate sections; here they're one continuous pipeline, since
 * a viewer scanning "where did this come from" cares about the whole path, not which internal
 * project phase produced which step. Every record is independently re-checked field-by-field
 * against its source before publication — row-count matching alone was never treated as
 * sufficient — but that's stated as one sentence, not a wall of field-name chips. */
export default function SourcesAndQuality({ jurisdictionCount }: Props) {
  return (
    <div>
      <div className="compilation-flow">
        <span className="sources-list-inline">Regulations / Tariff Orders / DISCOM Reports</span>
        <span className="compilation-arrow" aria-hidden="true" />
        {STAGES.map((s, i) => (
          <div className="compilation-node-wrap" key={s}>
            <div className="compilation-node">{s}</div>
            {i < STAGES.length - 1 && <span className="compilation-arrow" aria-hidden="true" />}
          </div>
        ))}
      </div>
      <p className="sources-note">Reviewed for {jurisdictionCount} currently tracked jurisdictions from official regulator and DISCOM sources.</p>
      <p className="method-context" style={{ fontSize: 12.5 }}>
        Reported values, definitions, standards, benchmarks, comparability decisions and regulatory citations are checked against the source
        evidence before publication.
      </p>
    </div>
  );
}

const TREND_STATES = ['Improved', 'Declined', 'No change', 'Not assessable'];

/** Comparability is the decision point that determines whether a "standard met?" question is even
 * asked — this is the direct visual explanation for why the dashboard shows "Not comparable"
 * instead of inferring compliance across incompatible metrics. Trend assessment is a separate
 * question from regulatory compliance (a reported value can improve year-over-year while still
 * missing its standard, or vice versa), governed by its own explicit rules so "better" is never
 * assumed from a value simply going up. Missing-data handling closes out the section: the one rule
 * every other rule here depends on — a gap in the source is never quietly filled in. */
export default function DataRules() {
  return (
    <div>
      <div className="data-rules-subhead">Comparability</div>
      <div className="comparability-tree">
        <div className="comparability-inputs">
          <span>Reported value</span>
          <span className="comparability-plus" aria-hidden="true">
            +
          </span>
          <span>Regulatory standard</span>
        </div>
        <span className="comparability-arrow" aria-hidden="true" />
        <div className="comparability-question">Defined on the same basis?</div>
        <div className="comparability-branches">
          <div className="comparability-branch comparability-branch--yes">
            <div className="comparability-branch-label">Yes</div>
            <span className="comparability-arrow" aria-hidden="true" />
            <div className="comparability-branch-outcome">Assess Met / Not met</div>
          </div>
          <div className="comparability-branch comparability-branch--no">
            <div className="comparability-branch-label">No</div>
            <span className="comparability-arrow" aria-hidden="true" />
            <div className="comparability-branch-outcome">Not comparable + record reason</div>
          </div>
        </div>
        <p className="comparability-principle">
          A standard is assessed only when the reported metric and regulatory standard are defined on a compatible basis.
        </p>
      </div>

      <div className="data-rules-subhead">Trend Assessment</div>
      <div className="indicator-chip-row" style={{ marginBottom: 10 }}>
        {TREND_STATES.map((s) => (
          <span className="indicator-chip" key={s}>
            {s}
          </span>
        ))}
      </div>
      <ul className="data-rules-list">
        <li>Compares the earliest and latest usable observations in the displayed period.</li>
        <li>
          Indicator direction must be explicitly defined as <code>higher_is_better</code>, <code>lower_is_better</code>, or{' '}
          <code>direction_unknown</code> — the dashboard never assumes higher means better.
        </li>
        <li>Fewer than two usable observations, an unknown direction, or a materially changed metric → Not assessable.</li>
        <li>Equal earliest and latest values → No change.</li>
        <li>Trend is assessed separately from regulatory compliance.</li>
        <li>Source units are never converted for trend comparison.</li>
      </ul>

      <div className="data-rules-subhead">Missing Data</div>
      <div className="missing-data-rule">
        <p className="missing-data-rule-note" style={{ margin: 0 }}>
          Missing means missing. N/A is never converted to zero, missing years are never interpolated, and synthetic values are never created.
        </p>
      </div>
      <p className="section-note" style={{ marginTop: 8, maxWidth: 640 }}>
        Use the source unit exactly as captured; units are never self-converted for display or comparison.
      </p>
    </div>
  );
}

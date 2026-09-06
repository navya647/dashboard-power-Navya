interface Props {
  tracked: number;
  published: number;
  machineReadable: number;
  /** N = tracked - published, and M = published - machineReadable — passed in from
   * `accessibilityGaps()` (the single shared source for these two figures, see
   * `lib/computations.ts`) rather than re-derived here, so this component and the Accessibility
   * Matrix's own gap count never disagree. */
  notPublished: number;
  publishedNotMachineReadable: number;
}

/** The DISCOM-level funnel only — tracked → published → machine-readable. Regulation publication
 * is a jurisdiction-level measure, not a DISCOM one, and deliberately does not appear here; it has
 * its own KPI card and coverage grid instead of being folded into a funnel whose denominator is
 * DISCOMs. Bar widths are scaled against `tracked` so the narrowing itself is the visualization —
 * this is the one place a progress-bar-style fill is used for something other than a single
 * jurisdiction/DISCOM's own percentage. */
export default function AccessibilityPipeline({ tracked, published, machineReadable, notPublished, publishedNotMachineReadable }: Props) {
  const widthPct = (n: number) => (tracked ? Math.round((100 * n) / tracked) : 0);

  const stages = [
    { label: 'Tracked DISCOMs', count: tracked, tone: 'muted' as const },
    { label: 'Published', count: published, tone: 'accent' as const },
    { label: 'Machine-Readable', count: machineReadable, tone: 'good' as const },
  ];

  return (
    <div className="pipeline">
      {stages.map((stage, i) => (
        <div key={stage.label}>
          <div className="pipeline-stage">
            <div className="pipeline-stage-label">
              {stage.count} {stage.label.toUpperCase()}
            </div>
            <div className="pipeline-stage-track">
              <div className={`pipeline-stage-fill pipeline-stage-fill--${stage.tone}`} style={{ width: `${widthPct(stage.count)}%` }} />
            </div>
          </div>
          {i === 0 && notPublished > 0 && (
            <div className="pipeline-gap">
              {notPublished} DISCOM{notPublished === 1 ? '' : 's'} do{notPublished === 1 ? 'es' : ''} not publish performance data
            </div>
          )}
          {i === 1 && publishedNotMachineReadable > 0 && (
            <div className="pipeline-gap">
              {publishedNotMachineReadable} additional DISCOM{publishedNotMachineReadable === 1 ? '' : 's'} publish data, but not in a machine-readable
              format
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

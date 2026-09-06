interface Props {
  stateOrder: string[];
  discomCount: number;
  fyRange: string;
  categoryCount: number;
  stateHue: Record<string, string>;
}

/** The evidence base's *current* coverage as one integrated statistics strip (typography +
 * separators), not a KPI-card grid — followed by a compact wrapping list of the currently tracked
 * jurisdictions rather than a map dependency or one card per jurisdiction. Every number here is
 * computed from the live dataset, so this section can never silently drift from what the rest of
 * the app shows, and — per the page's core rule — never presents the current, still-growing
 * research scope as some fixed, permanent boundary of the dashboard. */
export default function CurrentCoverage({ stateOrder, discomCount, fyRange, categoryCount, stateHue }: Props) {
  return (
    <div>
      <p className="scope-ribbon">
        <b>{stateOrder.length}</b> tracked jurisdiction{stateOrder.length === 1 ? '' : 's'} <span className="scope-sep">·</span> <b>{discomCount}</b>{' '}
        tracked DISCOM{discomCount === 1 ? '' : 's'} <span className="scope-sep">·</span> <b>{fyRange}</b> <span className="scope-sep">·</span>{' '}
        <b>{categoryCount}</b> indicator categor{categoryCount === 1 ? 'y' : 'ies'}
      </p>
      <p className="section-note" style={{ maxWidth: 640 }}>
        This dashboard began with an initial evidence-building exercise and expands as additional regulatory and reported performance evidence is
        captured and verified.
      </p>

      <ol className="scope-state-list">
        {stateOrder.map((s, i) => (
          <li key={s}>
            <span className="scope-state-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="dot" style={{ background: stateHue[s] }} />
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

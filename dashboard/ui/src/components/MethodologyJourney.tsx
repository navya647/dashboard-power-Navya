const STEPS = [
  { n: '01', title: 'Identify Standards', body: 'Review applicable electricity regulator Standards of Performance regulations, tariff orders and amendments where relevant.' },
  { n: '02', title: 'Collect Reported Data', body: 'Gather reported performance data from official regulator and DISCOM sources.' },
  { n: '03', title: 'Check Accessibility', body: 'Record whether performance data is publicly available and machine-readable.' },
  { n: '04', title: 'Check Comparability', body: 'Assess whether reported values and regulatory standards are defined on a compatible basis.' },
  { n: '05', title: 'Assess Standards', body: 'Where comparison is valid, assess reported performance against the applicable standard or benchmark.' },
  { n: '06', title: 'Build Dashboard Views', body: 'Structure verified evidence into jurisdiction-, DISCOM-, indicator- and year-level views.' },
];

/** The central visual of the page: a connected six-step research process rather than six ordinary
 * cards. Renders as one continuous line on desktop (wrapping 3+3), collapsing to a vertical
 * numbered journey on mobile — the connectors between steps are the point, not the boxes. */
export default function MethodologyJourney() {
  return (
    <ol className="journey">
      {STEPS.map((s, i) => (
        <li className="journey-step" key={s.n}>
          <div className="journey-marker">{s.n}</div>
          <div className="journey-title">{s.title}</div>
          <p className="journey-body">{s.body}</p>
          {i < STEPS.length - 1 && <span className="journey-connector" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

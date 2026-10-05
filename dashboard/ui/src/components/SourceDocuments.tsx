import { fyLabel } from '@/lib/format';
import { regulationTitle } from '@/lib/regulationTitles';
import type { DiscomAccessibility, ReportedDataLink, StateAccessibility } from '@/lib/types';

/** The source-document links as the Accessibility page's state card presents them — shared with
 * the state page's indicator modules so both read the same. Styles: the acm-* rules in
 * accessibility.css. */

export const Arrow = () => (
  <svg className="acm-arrow" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M4.5 2.5h5v5M9.5 2.5 3 9" />
  </svg>
);

function YearLinks({ links, who }: { links: ReportedDataLink[]; who: string }) {
  if (!links.length) return <span className="acm-muted">N/A</span>;
  return (
    <span className="acm-years">
      {links.map((l) => (
        <a key={l.year} href={l.url} target="_blank" rel="noopener noreferrer">
          {fyLabel(l.year)}
          <span className="sr-only"> {who} reported data (opens in a new tab)</span>
        </a>
      ))}
    </span>
  );
}

/** One row per DISCOM with its year-wise reported-data links. When they all have the same entry —
 * one set of year folders for the whole state (Madhya Pradesh, Odisha), all unpublished, or all
 * without links — it's written once in a cell spanning the rows rather than repeated on each. */
export function ReportedDataTable({ state, discoms }: { state: string; discoms: DiscomAccessibility[] }) {
  const entryKey = (d: DiscomAccessibility) => (d.available_on_serc !== true ? 'none' : JSON.stringify(d.data_links));
  const merged = discoms.length > 1 && discoms.every((d) => entryKey(d) === entryKey(discoms[0]));
  const entry = (d: DiscomAccessibility, who: string) =>
    d.available_on_serc !== true ? <span className="acm-muted">Not published</span> : <YearLinks links={d.data_links} who={who} />;
  return (
    <table className={`acm-reports${merged ? ' is-merged' : ''}`}>
      <tbody>
        {discoms.map((d, i) => (
          <tr key={d.abbreviation}>
            <th scope="row" title={d.discom}>
              {d.abbreviation}
            </th>
            {!merged ? (
              <td>{entry(d, d.abbreviation)}</td>
            ) : (
              i === 0 && (
                <td rowSpan={discoms.length} className="acm-merged">
                  {entry(d, `${state} DISCOMs`)}
                </td>
              )
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The state's SoP regulation documents, each linked to its copy. */
export function RegulationDocs({ state, regulation }: { state: string; regulation: StateAccessibility | undefined }) {
  const docs = regulation?.regulation_documents ?? [];
  if (!docs.length) return <p className="acm-muted">N/A</p>;
  return (
    <ul className="acm-docs">
      {docs.map((doc) => (
        <li key={doc.url}>
          <a href={doc.url} target="_blank" rel="noopener noreferrer">
            <span className="acm-doc-title">{regulationTitle(state, doc)}</span>
            <Arrow />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

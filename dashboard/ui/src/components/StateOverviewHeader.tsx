import Link from 'next/link';
import type { Discom, IndiaGeoJSON } from '@/lib/types';
import StateShape from './StateShape';

interface Props {
  name: string;
  geojson: IndiaGeoJSON | null;
  color: string;
  discoms: Discom[];
  fyRange: string;
  /** set on the overview page (links through to the Detailed Data page); omitted there */
  dataHref?: string;
  /** small line under the name — the Detailed Data page's own description */
  description?: string;
  eyebrow?: string;
}

/** The editorial state masthead: a small silhouette, the state name, one line of plain counts
 * (number of DISCOMs, data period) and the DISCOM list as a compact inline row — sitting on the
 * page background rather than inside a card. Only facts already in the data appear here. */
export default function StateOverviewHeader({ name, geojson, color, discoms, fyRange, dataHref, description, eyebrow }: Props) {
  const count = discoms.length;
  return (
    <header className="so-header">
      <div className="so-header-main">
        <div className="so-header-identity">
          {geojson && (
            <div className="so-header-shape" aria-hidden="true">
              <StateShape geojson={geojson} name={name} size={52} color={color} />
            </div>
          )}
          <div className="so-header-text">
            {eyebrow && <span className="so-eyebrow">{eyebrow}</span>}
            <h1>{name}</h1>
            <p className="so-header-meta">
              <span>{count ? `${count} DISCOM${count === 1 ? '' : 's'}` : 'No DISCOMs tracked'}</span>
              {fyRange && <span>Data {fyRange}</span>}
            </p>
          </div>
        </div>
        {description && <p className="so-header-desc">{description}</p>}
        {count > 0 && (
          <ul className="so-discoms" aria-label="DISCOMs">
            {discoms.map((d) => {
              const short = d.short_name?.trim();
              return (
                <li key={d.full_name}>
                  {short && <b>{short}</b>}
                  <span>{d.full_name}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {dataHref && (
        <Link href={dataHref} className="so-data-link">
          View detailed data <span aria-hidden="true">→</span>
        </Link>
      )}
    </header>
  );
}

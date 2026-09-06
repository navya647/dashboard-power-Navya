'use client';

import { Fragment, useState } from 'react';
import { hasAccessibilityGap, machineReadableDisplayStatus } from '@/lib/computations';
import StatusIcon from './StatusIcon';
import type { DiscomAccessibility } from '@/lib/types';

interface Props {
  discoms: DiscomAccessibility[];
  stateOrder: string[];
  stateHue: Record<string, string>;
  stateFilter: string;
  onStateFilterChange: (state: string) => void;
}

type PublicationFilter = 'all' | 'published' | 'not-published';
type FormatFilter = 'all' | 'machine-readable' | 'not-machine-readable' | 'na';

/** Every tracked DISCOM in one shared surface — one header row, subtle jurisdiction-group
 * dividers, rather than a repeated mini-table per jurisdiction. Jurisdiction grouping and each
 * jurisdiction's own DISCOM order are always preserved (`stateOrder`, source order) regardless of
 * which filters are active — filtering only hides non-matching rows/groups, it never reorders
 * anything. */
export default function AccessibilityMatrix({ discoms, stateOrder, stateHue, stateFilter, onStateFilterChange }: Props) {
  const [publicationFilter, setPublicationFilter] = useState<PublicationFilter>('all');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [search, setSearch] = useState('');
  const [gapsOnly, setGapsOnly] = useState(false);

  const q = search.trim().toLowerCase();

  const matches = (d: DiscomAccessibility) => {
    if (stateFilter !== 'all' && d.state !== stateFilter) return false;
    if (publicationFilter === 'published' && d.available_on_serc !== true) return false;
    if (publicationFilter === 'not-published' && d.available_on_serc === true) return false;
    // Derived from `machineReadableDisplayStatus`, never the raw `d.machine_readable` field, so
    // "Not machine-readable" can only ever mean published-but-not-machine-readable — an
    // unpublished DISCOM belongs under "N/A", not here (see CLAUDE.md / spec §14).
    const mrStatus = machineReadableDisplayStatus(d);
    if (formatFilter === 'machine-readable' && mrStatus !== true) return false;
    if (formatFilter === 'not-machine-readable' && mrStatus !== false) return false;
    if (formatFilter === 'na' && mrStatus !== null) return false;
    if (gapsOnly && !hasAccessibilityGap(d)) return false;
    if (q && !d.abbreviation.toLowerCase().includes(q) && !d.discom.toLowerCase().includes(q)) return false;
    return true;
  };

  const filtered = discoms.filter(matches);
  const gapCount = discoms.filter(hasAccessibilityGap).length;

  return (
    <div className="access-matrix-surface">
      <div className="toolbar access-matrix-toolbar">
        <div className="toolbar-field">
          <label htmlFor="access-matrix-jurisdiction">Jurisdiction</label>
          <select id="access-matrix-jurisdiction" value={stateFilter} onChange={(e) => onStateFilterChange(e.target.value)}>
            <option value="all">All jurisdictions</option>
            {stateOrder.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar-field">
          <label htmlFor="access-matrix-publication">Publication</label>
          <select id="access-matrix-publication" value={publicationFilter} onChange={(e) => setPublicationFilter(e.target.value as PublicationFilter)}>
            <option value="all">All</option>
            <option value="published">Published</option>
            <option value="not-published">Not published</option>
          </select>
        </div>
        <div className="toolbar-field">
          <label htmlFor="access-matrix-format">Format</label>
          <select id="access-matrix-format" value={formatFilter} onChange={(e) => setFormatFilter(e.target.value as FormatFilter)}>
            <option value="all">All</option>
            <option value="machine-readable">Machine-readable</option>
            <option value="not-machine-readable">Not machine-readable</option>
            <option value="na">N/A</option>
          </select>
        </div>
        <input type="search" className="sop-search-input" placeholder="Search DISCOM…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search DISCOMs" />
        <label className="access-gaps-toggle">
          <input type="checkbox" checked={gapsOnly} onChange={(e) => setGapsOnly(e.target.checked)} />
          Show gaps only
        </label>
      </div>

      <div className="access-matrix-count">
        {gapsOnly
          ? `${filtered.length} DISCOM${filtered.length === 1 ? '' : 's'} with accessibility gaps`
          : `Showing ${filtered.length} of ${discoms.length} DISCOMs · ${gapCount} accessibility gap${gapCount === 1 ? '' : 's'} overall`}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="access-matrix">
          <thead>
            <tr>
              <th>DISCOM</th>
              <th>Data Published</th>
              <th>Machine-Readable</th>
            </tr>
          </thead>
          <tbody>
            {stateOrder.map((state) => {
              const group = filtered.filter((d) => d.state === state);
              if (!group.length) return null;
              return (
                <Fragment key={state}>
                  <tr className="access-matrix-group-row">
                    <th colSpan={3} scope="colgroup">
                      <span className="dot" style={{ background: stateHue[state] }} />
                      {state}
                    </th>
                  </tr>
                  {group.map((d) => (
                    <tr key={d.abbreviation}>
                      <td data-th="DISCOM">
                        <span className="access-matrix-abbr">{d.abbreviation}</span>
                        {d.discom && <span className="access-matrix-full"> · {d.discom}</span>}
                      </td>
                      <td data-th="Data Published">
                        <StatusIcon status={d.available_on_serc} yesLabel="Published" noLabel="Not published" />
                      </td>
                      <td data-th="Machine-Readable">
                        <StatusIcon status={machineReadableDisplayStatus(d)} yesLabel="Machine-readable" noLabel="Not machine-readable" />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="detail-placeholder">
                  No DISCOMs match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

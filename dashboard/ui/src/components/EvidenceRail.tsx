'use client';

import { fyLabel } from '@/lib/format';
import { evidenceStatus, STATUS_META } from '@/lib/evidenceStatus';
import { assessYearOverYear, YOY_META } from '@/lib/trend';
import type { CardPoint } from './IndicatorVisualCard';

const YOY_TOOLTIP =
  "Each year's reported performance is compared with the immediately preceding financial year. Whether an increase or decrease represents improvement depends on the indicator.";

interface Props {
  points: CardPoint[];
  unitSuffix: (v: number) => string;
  seriesLabel: string;
  color?: string;
  hoverYear: string | null;
  focusYear: string;
  onHoverYear: (year: string | null) => void;
}

/** One row of the year-wise values matrix (see IndicatorVisualCard, which owns the shared
 * `<thead>` of fiscal years every row aligns against) — a DISCOM/jurisdiction identity cell
 * followed by one compact cell per year: reported value, its year-on-year assessment (top-right
 * corner chip — always a distinct signal from compliance status, never merged with it), and its
 * regulatory-compliance status (bottom pill). Hovering/focusing a cell becomes the connective
 * tissue between "this point on the chart" and "this year's regulatory evidence": it drives the
 * chart's enlarged point and vertical guide line via `onHoverYear`, falling back to the page-level
 * Focus Year (`focusYear`) once the pointer leaves. */
export default function EvidenceRail({ points, unitSuffix, seriesLabel, color, hoverYear, focusYear, onHoverYear }: Props) {
  const activeYear = hoverYear ?? focusYear;

  return (
    <tr className="matrix-row">
      <th scope="row" className="matrix-row-head">
        {color && <span className="matrix-row-dot" style={{ background: color }} aria-hidden="true" />}
        {seriesLabel}
      </th>
      {points.map((p, i) => {
        const status = evidenceStatus(p);
        const meta = STATUS_META[status];
        const isActive = p.year === activeYear;
        // Year-on-year is always against the immediately preceding *displayed* fiscal-year slot,
        // never an earlier one found by skipping past a missing year — see lib/trend.ts. The
        // first displayed year has no preceding slot at all, so it gets a dash, not "Not
        // assessable" (that's reserved for a real but unusable/incomparable prior year).
        const prev = i > 0 ? points[i - 1] : null;
        const yoy = prev ? assessYearOverYear(prev, p) : null;
        const yoyMeta = yoy ? YOY_META[yoy.status] : null;
        return (
          <td key={p.year} className={`matrix-cell${isActive ? ' active' : ''}`}>
            <button
              type="button"
              className={`matrix-cell-btn ${meta.cls}`}
              onMouseEnter={() => onHoverYear(p.year)}
              onMouseLeave={() => onHoverYear(null)}
              onFocus={() => onHoverYear(p.year)}
              onBlur={() => onHoverYear(null)}
              title={`${fyLabel(p.year)} · ${meta.text}`}
            >
              <span
                className={`matrix-cell-yoy${yoyMeta ? ` ${yoyMeta.cls}` : ' yoy-first-year'}`}
                title={yoy ? `${yoyMeta!.text} vs FY${fyLabel(points[i - 1].year).slice(2)} · ${YOY_TOOLTIP}` : YOY_TOOLTIP}
              >
                {yoy ? yoy.arrow : '—'}
              </span>
              <span className="matrix-cell-v">{p.value == null ? '–' : unitSuffix(p.value)}</span>
              <span className="matrix-cell-status">{meta.short}</span>
            </button>
          </td>
        );
      })}
    </tr>
  );
}

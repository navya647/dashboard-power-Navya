'use client';

import { fyLabel } from '@/lib/format';
import { evidenceStatus, STATUS_META } from '@/lib/evidenceStatus';
import { assessYearOverYear, YOY_META } from '@/lib/trend';
import type { CardSeries } from '@/lib/indicatorContext';

const YOY_TOOLTIP =
  "Each year's reported performance is compared with the immediately preceding financial year. Whether an increase or decrease represents improvement depends on the indicator.";

const KEY_TOOLTIP =
  '↑/↓ show the raw year-on-year change; the colour (green = improved, red = declined, grey = no change or not assessable) accounts for whether higher or lower is better for this specific indicator. ✓ standard met · ✕ not met · ⚠ not comparable with the standard · – no benchmark specified · ○ no reported value. Hover any value for details.';

interface Props {
  series: CardSeries[];
  yearsAsc: string[];
  unitSuffix: (v: number) => string;
  hoverYear: string | null;
  focusYear: string | null;
  onHoverYear: (year: string | null) => void;
}

/** The year-wise reported values beneath the chart, as a quiet supporting table: one row per
 * DISCOM, one column per fiscal year, each cell the reported value with its year-on-year chip and
 * its standard-met status glyph beside it. Same per-cell logic as before (evidenceStatus,
 * assessYearOverYear — always against the immediately preceding displayed year, the first year
 * getting "—"); hovering a cell drives the chart's guide line via `onHoverYear`. */
export default function ReportedValuesStrip({ series, yearsAsc, unitSuffix, hoverYear, focusYear, onHoverYear }: Props) {
  const activeYear = hoverYear ?? focusYear;
  return (
    <div className="so-values">
      <div className="so-values-head">
        <span className="so-label">Reported values by year</span>
        <span className="so-values-key" title={KEY_TOOLTIP} tabIndex={0} aria-label={`Key: ${KEY_TOOLTIP}`}>
          <span className="so-values-key-item">
            <span className="so-yoy yoy-improved" aria-hidden="true">↕</span>Improved
          </span>
          <span className="so-values-key-item">
            <span className="so-yoy yoy-declined" aria-hidden="true">↕</span>Declined
          </span>
          <span className="so-values-key-sep" aria-hidden="true" />
          <span className="so-values-key-item">
            <span className="so-ev eviq-met" aria-hidden="true">✓</span>Met
          </span>
          <span className="so-values-key-item">
            <span className="so-ev eviq-not-met" aria-hidden="true">✕</span>Not met
          </span>
          <span className="so-values-key-item">
            <span className="so-ev eviq-not-comparable" aria-hidden="true">⚠</span>Not comparable
          </span>
          <span className="so-values-key-info" aria-hidden="true">ⓘ</span>
        </span>
      </div>
      <div className="so-values-scroll">
        <table className="so-values-table">
          <thead>
            <tr>
              <th scope="col" className="so-values-rowhead">
                <span className="sr-only">DISCOM</span>
              </th>
              {yearsAsc.map((y) => (
                <th key={y} scope="col" className={y === activeYear ? 'active' : undefined}>
                  {fyLabel(y)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.label}>
                <th scope="row" className="so-values-rowhead">
                  <span className="so-values-dot" style={{ background: s.color }} aria-hidden="true" />
                  {s.label}
                </th>
                {s.points.map((p, i) => {
                  const meta = STATUS_META[evidenceStatus(p)];
                  const prev = i > 0 ? s.points[i - 1] : null;
                  const yoy = prev ? assessYearOverYear(prev, p) : null;
                  const yoyMeta = yoy ? YOY_META[yoy.status] : null;
                  return (
                    <td key={p.year} className={p.year === activeYear ? 'active' : undefined}>
                      <button
                        type="button"
                        className="so-values-cell"
                        onMouseEnter={() => onHoverYear(p.year)}
                        onMouseLeave={() => onHoverYear(null)}
                        onFocus={() => onHoverYear(p.year)}
                        onBlur={() => onHoverYear(null)}
                        title={`${s.label} · ${fyLabel(p.year)} · ${meta.text}`}
                      >
                        <span className={`so-values-v${p.value == null ? ' none' : ''}`}>{p.value == null ? '–' : unitSuffix(p.value)}</span>
                        <span
                          className={`so-yoy ${yoyMeta ? yoyMeta.cls : 'yoy-first-year'}`}
                          title={yoy ? `${yoyMeta!.text} vs ${fyLabel(prev!.year)} · ${YOY_TOOLTIP}` : YOY_TOOLTIP}
                        >
                          {yoy ? yoy.arrow : '—'}
                        </span>
                        <span className={`so-ev ${meta.cls}`} aria-label={meta.text}>
                          {meta.short}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import { useId, useState } from 'react';
import { fyLabel } from '@/lib/format';
import { formatGroupedLabel, type CardSeries, type IndicatorContext } from '@/lib/indicatorContext';

/** Extraction joins multiple citations for the same year/DISCOM with ' | ' (see
 * extraction_common.py / extraction_state_specific.py) — split back on that exact delimiter so
 * each citation reads on its own line, never guessing at structure within one citation's text. */
function citationParts(text: string): string[] {
  return text
    .split(' | ')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "Source regulation" as a disclosure rather than a permanent full-width row: closed, it's one
 * quiet line; opened, it lists every regulation text cited for this indicator and which DISCOMs
 * (and, where it varies year to year, which years) it applies to. Same grouping as before —
 * `constantRegulations` / `variantRegulations` from lib/indicatorContext. Renders nothing when the
 * source cites no regulation at all. */
export default function RegulatoryContext({ ctx, series }: { ctx: IndicatorContext; series: CardSeries[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const total = ctx.constantRegulations.length + ctx.variantRegulations.reduce((n, v) => n + v.texts.length, 0);
  if (total === 0) return null;
  const multi = series.length > 1;

  return (
    <div className={`so-source${open ? ' open' : ''}`}>
      <button type="button" className="so-source-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
        <span>Source regulation</span>
        <span className="so-source-count">{total === 1 ? '1 citation' : `${total} citations`}</span>
        <svg className="so-source-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div className="so-source-panel" id={panelId} role="region" aria-label="Source regulation" hidden={!open}>
        {ctx.constantRegulations.map((g) => (
          <div key={g.text} className="so-source-item">
            <span className="so-source-applies">{multi ? `Applies to ${formatGroupedLabel(g.labels)}` : `Applies to ${g.labels[0]}`}</span>
            {citationParts(g.text).map((part, i) => (
              <p key={i}>{part}</p>
            ))}
          </div>
        ))}
        {ctx.variantRegulations.map((v) => {
          const s = series.find((x) => x.label === v.label);
          return v.texts.map((text) => {
            const years = s ? s.points.filter((p) => p.regulation === text).map((p) => fyLabel(p.year)) : [];
            return (
              <div key={`${v.label}::${text}`} className="so-source-item">
                <span className="so-source-applies">
                  Applies to {v.label}
                  {years.length > 0 && ` · ${years.join(', ')}`}
                </span>
                {citationParts(text).map((part, i) => (
                  <p key={i}>{part}</p>
                ))}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}

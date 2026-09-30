'use client';

import { useState } from 'react';

interface Props {
  text: string | null | undefined;
  label?: string;
}

/** Extraction joins multiple citations for the same year/DISCOM with ' | ' (see
 * extraction_common.py / extraction_state_specific.py) — split back on that exact delimiter to
 * preview just the first citation, never guessing at sentence structure within one citation's own
 * text. Renders every citation, split onto its own line, once expanded — full source wording. */
function citationParts(text: string): string[] {
  return text
    .split(' | ')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** A "governed by" provenance line — quiet by default (a source footnote, not another panel
 * competing with the chart), expanding in place to the full citation text. Renders nothing when
 * there's no citation, rather than an empty footer. The collapsed header's own preview text (the
 * first citation) is dropped once expanded, rather than left showing above the same citation
 * repeated as the expanded body's first line — expanded, the header carries only the icon, label
 * and chevron. */
export default function RegulationBadge({ text, label = 'Source regulation' }: Props) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const parts = citationParts(text);
  const [first, ...rest] = parts;

  return (
    <div className="provenance">
      <button type="button" className="provenance-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <svg className="provenance-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
        <span className="provenance-label">{label}</span>
        {!open && (
          <span className="provenance-preview">
            {first}
            {rest.length > 0 ? ` +${rest.length} more` : ''}
          </span>
        )}
        <svg className={`provenance-chevron${open ? ' open' : ''}`} width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="provenance-text">
          {parts.map((part, i) => (
            <p key={i}>{part}</p>
          ))}
        </div>
      )}
    </div>
  );
}

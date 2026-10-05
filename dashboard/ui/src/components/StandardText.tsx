'use client';

import { useState } from 'react';

function truncated(text: string, max = 130): { short: string; needsMore: boolean } {
  if (text.length <= max) return { short: text, needsMore: false };
  return { short: text.slice(0, max).trimEnd() + '…', needsMore: true };
}

/** The Regulatory Standard column's own qualitative-text presentation — truncated with a
 * view-more toggle for a long, multi-condition standard. No separate label/"·" separator (unlike
 * the metadata lenses this replaced), since the column already carries a "Regulatory Standard"
 * heading of its own; repeating a label here would say the same
 * thing twice. `groupLabel`, when given (a DISCOM/jurisdiction name or group), reads as its own
 * small heading above the text — used only when different DISCOMs on one card have genuinely
 * different standards specified and each needs attributing to whom it applies. */
export default function StandardText({ text, groupLabel, size = 'lg' }: { text: string; groupLabel?: string; size?: 'lg' | 'sm' }) {
  const [expanded, setExpanded] = useState(false);
  const { short, needsMore } = truncated(text, size === 'lg' ? 200 : 130);
  return (
    <div className={`reg-standard-text reg-standard-text--${size}`}>
      {groupLabel && <span className="reg-standard-text-group">{groupLabel}</span>}
      <span>{expanded ? text : short}</span>
      {needsMore && (
        <button type="button" className="lens-more-btn" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : 'View full standard'}
        </button>
      )}
    </div>
  );
}


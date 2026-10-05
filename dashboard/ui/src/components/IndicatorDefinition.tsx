"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { bucketFor } from "@/lib/indicatorBuckets";
import { directionForMeaning, type Direction } from "@/lib/indicatorDirection";
import type { CardSeries } from "@/lib/indicatorContext";
import { isNA, textKey } from "@/lib/regulationSources";

const DIRECTION_TEXT: Record<Direction, string> = {
  higher_is_better: "Higher is better",
  lower_is_better: "Lower is better",
  direction_unknown: "Not established",
};

/** A definition with its reporting period removed ("…experienced by a consumer in a month" →
 * "…experienced by a consumer") — the period belongs to how a figure was reported, not to what the
 * indicator is, and it's what made otherwise-identical definitions differ between DISCOMs. */
export function definitionWithoutPeriod(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/, "")
    .replace(
      /,?\s+(in|per|during|over|for)\s+(a|the|each|one|any)?\s*(given\s+)?(calendar\s+|financial\s+|reporting\s+)?(month|mont|year|quarter|annum|period|two quarters|six months)$/i,
      "",
    )
    .trim();
}

/** The definition most of the shown DISCOMs' sheets use (after removing the period); null if none. */
function leadDefinition(series: CardSeries[]): string | null {
  const counts = new Map<string, { text: string; n: number }>();
  for (const s of series) {
    if (!s.meaning || isNA(s.meaning)) continue;
    const text = definitionWithoutPeriod(s.meaning);
    const k = textKey(text);
    const e = counts.get(k);
    if (e) e.n += 1;
    else counts.set(k, { text, n: 1 });
  }
  let best: { text: string; n: number } | null = null;
  for (const e of counts.values()) if (!best || e.n > best.n) best = e;
  return best
    ? best.text.charAt(0).toUpperCase() + best.text.slice(1) + "."
    : null;
}

/** "Lower is better" etc. from the reported-metric descriptions (lib/indicatorDirection); where
 * DISCOMs' figures point different ways, each direction is listed with whom it applies to. */
function interpretation(series: CardSeries[]): string {
  const byDir = new Map<Direction, Set<string>>();
  for (const s of series)
    for (const p of s.points) {
      if (isNA(p.reportedMeaning)) continue;
      const d = directionForMeaning(p.reportedMeaning);
      if (d === "direction_unknown") continue;
      if (!byDir.has(d)) byDir.set(d, new Set());
      byDir.get(d)!.add(s.label);
    }
  if (byDir.size === 0) return DIRECTION_TEXT.direction_unknown;
  if (byDir.size === 1) return DIRECTION_TEXT[[...byDir.keys()][0]];
  return [...byDir]
    .map(([d, who]) => `${DIRECTION_TEXT[d]} (${[...who].join(", ")})`)
    .join(" · ");
}

interface Props {
  open: boolean;
  onClose: () => void;
  indicator: string;
  category: string;
  type: string;
  series: CardSeries[];
}

/** Pop-up opened from an indicator's name: what the indicator is (definition without a reporting
 * period), which bucket and category it belongs to, and which way is an improvement. */
export default function IndicatorDefinition({
  open,
  onClose,
  indicator,
  category,
  type,
  series,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const definition = leadDefinition(series);

  return createPortal(
    <div className="idef-root" role="presentation">
      <div className="idef-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="idef-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="idef-title"
      >
        <header className="idef-head">
          <h2 id="idef-title">{indicator}</h2>
          <button
            ref={closeRef}
            type="button"
            className="idef-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <p className="idef-definition">{definition ?? "N/A"}</p>
        <dl className="idef-meta">
          <div>
            <dt>Bucket</dt>
            <dd>{bucketFor(category, type, indicator)}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{category}</dd>
          </div>
          <div>
            <dt>Interpretation</dt>
            <dd>{interpretation(series)}</dd>
          </div>
        </dl>
      </div>
    </div>,
    document.body,
  );
}

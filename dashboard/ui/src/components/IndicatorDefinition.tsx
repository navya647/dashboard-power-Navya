"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { bucketFor } from "@/lib/indicatorBuckets";
import { groupReadings } from "@/lib/indicatorReading";
import type { CardSeries } from "@/lib/indicatorContext";
import { isNA, textKey } from "@/lib/regulationSources";

/** A definition with its reporting period removed ("…experienced by a consumer in a month" →
 * "…experienced by a consumer"), the period belongs to how a figure was reported, not to what the
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

/** What the reported figure is, and how to read it, both from the same source wording (see
 * lib/indicatorReading). Where DISCOMs report on different bases, each basis is listed with the
 * DISCOMs it applies to, so the measure and its interpretation stay paired line for line. */
function readings(series: CardSeries[]) {
  const items = series.flatMap((s) => s.points.map((p) => ({ meaning: p.reportedMeaning, who: s.label })));
  return groupReadings(items);
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
 * period), which indicator category it belongs to, and which way is an improvement. */
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
  const rs = readings(series);
  const labelled = (who: string[]) => (rs.length > 1 && who.length ? ` (${who.join(", ")})` : "");

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
            <dt>Indicator category</dt>
            <dd>{bucketFor(category, type, indicator)}</dd>
          </div>
          <div>
            <dt>Reported as</dt>
            <dd>
              {rs.length === 0
                ? "N/A"
                : rs.map((r) => (
                    <span className="idef-line" key={r.reading.measure}>
                      {r.reading.measure}
                      {labelled(r.who)}
                    </span>
                  ))}
            </dd>
          </div>
          <div>
            <dt>Interpretation</dt>
            <dd>
              {rs.length === 0
                ? "Not established."
                : rs.map((r) => (
                    <span className="idef-line" key={r.reading.measure}>
                      {r.reading.interpretation}
                      {labelled(r.who)}
                    </span>
                  ))}
            </dd>
          </div>
        </dl>
      </div>
    </div>,
    document.body,
  );
}

"use client";

import { useMemo } from "react";
import { useData } from "@/lib/DataContext";
import { buildGlossary } from "@/lib/glossary";
import { useNoScrollbar } from "@/lib/useNoScrollbar";
import GlossaryList from "./GlossaryList";

/** The About page: a glossary of every indicator in the two performance datasets (bucket, category,
 * name, definition as the source sheets give it), under the Methodology page's heading typography
 * (.methodology-page/.kicker/.method-hero-title), as one searchable, filterable list. */
export default function AboutView() {
  const { discoms, stateSpecific, loading, error } = useData();
  const glossary = useMemo(() => buildGlossary(discoms, stateSpecific), [discoms, stateSpecific]);
  useNoScrollbar();

  return (
    <div className="methodology-page about-page">
      <div className="kicker" style={{ marginTop: 0 }}>
        <span className="bar" />
        <span className="label">About</span>
      </div>
      <h1 className="method-hero-title">Glossary</h1>

      <div id="glossary" className="glossary-body">
        {loading ? (
          <p className="detail-placeholder">Loading dashboard data…</p>
        ) : error ? (
          <p className="detail-placeholder">Could not load dashboard data: {error}</p>
        ) : (
          <GlossaryList entries={glossary} />
        )}
      </div>
    </div>
  );
}

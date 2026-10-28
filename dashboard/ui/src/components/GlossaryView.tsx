"use client";

import { useMemo } from "react";
import { useData } from "@/lib/DataContext";
import { buildGlossary } from "@/lib/glossary";
import { useNoScrollbar } from "@/lib/useNoScrollbar";
import AboutKicker from "./AboutKicker";
import GlossaryList from "./GlossaryList";

/** The Glossary page (/about/glossary, reached from the About page): every indicator in
 * DISCOM_SoP_master.xlsx (category, name, definition as the sheet gives it), under the
 * Methodology page's heading typography (.methodology-page/.kicker/.method-hero-title), as one
 * searchable, filterable list. */
export default function GlossaryView() {
  const { master, loading, error } = useData();
  const glossary = useMemo(() => buildGlossary(master), [master]);
  useNoScrollbar();

  return (
    <div className="methodology-page about-page">
      <AboutKicker here="Glossary" />
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

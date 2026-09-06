'use client';

import { useData } from '@/lib/DataContext';
import { stateHueMap } from '@/lib/colors';
import { fyLabel } from '@/lib/format';
import { SOP_CATEGORY_ORDER } from '@/lib/sopCategories';
import CurrentCoverage from './CurrentCoverage';
import DataRules from './DataRules';
import MethodologyJourney from './MethodologyJourney';
import MethodologyLimitations from './MethodologyLimitations';
import MethodologyNav from './MethodologyNav';
import MethodologyPrinciples from './MethodologyPrinciples';
import SourcesAndQuality from './SourcesAndQuality';
import WhatWeTrack from './WhatWeTrack';

/** The Methodology page. Every section separates two things the core rule insists stay distinct:
 * *permanent methodology* (how evidence is always handled — Method, Data Rules, Sources & Data
 * Quality, Methodological Principles) from *current coverage* (what evidence happens to be
 * included right now — Current Coverage, and every count threaded through from `discoms`). Nothing
 * here hard-codes a jurisdiction count, DISCOM count, FY range, or jurisdiction list — all of it is
 * read live off the dataset, so the page never needs a rewrite as the evidence base grows. */
export default function MethodologyView() {
  const { discoms, loading, error } = useData();

  if (loading) return <p className="detail-placeholder">Loading dashboard data…</p>;
  if (error || !discoms) return <p className="detail-placeholder">Could not load dashboard data: {error}</p>;

  const stateHue = stateHueMap(discoms.state_order);
  const yearsAsc = [...discoms.years].reverse();
  const fyRange = `${fyLabel(yearsAsc[0])}–${fyLabel(yearsAsc[yearsAsc.length - 1])}`;

  return (
    <div className="methodology-page">
      <MethodologyNav />

      <div id="m-purpose">
        <div className="kicker" style={{ marginTop: 0 }}>
          <span className="bar" />
          <span className="label">Methodology</span>
        </div>
        <h1 className="method-hero-title">How the Evidence Base Was Built</h1>
        <p className="section-note" style={{ marginTop: 4, marginBottom: 14, maxWidth: 640 }}>
          From regulatory standards and reported DISCOM performance data to a structured evidence base for assessing performance, comparability and
          reporting gaps.
        </p>
        <p className="method-context">
          The dashboard brings regulatory standards and reported performance data together to support transparency, valid comparison and informed
          dialogue.
        </p>
      </div>

      <div id="m-scope">
        <div className="section-header">
          <span className="section-label">Coverage</span>
          <span className="section-title">Current Coverage</span>
        </div>
        <CurrentCoverage
          stateOrder={discoms.state_order}
          discomCount={discoms.discoms.length}
          fyRange={fyRange}
          categoryCount={SOP_CATEGORY_ORDER.length}
          stateHue={stateHue}
        />

        <div className="section-header">
          <span className="section-label">Taxonomy</span>
          <span className="section-title">What We Track</span>
        </div>
        <WhatWeTrack />
      </div>

      <div id="m-method">
        <div className="section-header">
          <span className="section-label">Approach</span>
          <span className="section-title">Method</span>
          <span className="section-sub">From regulatory standards to a comparable performance dashboard — a six-step process</span>
        </div>
        <MethodologyJourney />
      </div>

      <div id="m-data-rules">
        <div className="section-header">
          <span className="section-label">Rules</span>
          <span className="section-title">Data Rules</span>
        </div>
        <DataRules />
      </div>

      <div id="m-sources">
        <div className="section-header">
          <span className="section-label">Evidence Base</span>
          <span className="section-title">Sources &amp; Data Quality</span>
        </div>
        <SourcesAndQuality jurisdictionCount={discoms.state_order.length} />
      </div>

      <div id="m-limitations">
        <div className="section-header">
          <span className="section-label">Honest Accounting</span>
          <span className="section-title">Limitations</span>
        </div>
        <MethodologyLimitations />

        <div className="data-rules-subhead">Map Status</div>
        <p className="section-note" style={{ maxWidth: 700, marginTop: 0 }}>
          Map colouring reflects dashboard evidence coverage, not a judgment of jurisdiction or DISCOM performance.
        </p>
        <div className="coverage-semantics">
          <div className="coverage-semantics-item">
            <span className="map-legend-dot map-legend-dot--tracked" aria-hidden="true" />
            <b>Reported data available</b> — an actual reported figure exists in at least one dataset.
          </div>
          <div className="coverage-semantics-item">
            <span className="map-legend-dot map-legend-dot--no-data" aria-hidden="true" />
            <b>Framework captured, performance not reported</b> — a regulatory framework or source record exists, but no reported figure yet.
          </div>
          <div className="coverage-semantics-item">
            <span className="map-legend-dot map-legend-dot--none" aria-hidden="true" />
            <b>Not yet captured</b> — outside the dashboard&rsquo;s current evidence base.
          </div>
        </div>
      </div>

      <div>
        <div className="section-header">
          <span className="section-label">Governing Rules</span>
          <span className="section-title">Methodological Principles</span>
        </div>
        <MethodologyPrinciples />
      </div>
    </div>
  );
}

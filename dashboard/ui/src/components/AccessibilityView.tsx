'use client';

import { useMemo, useState } from 'react';
import { useData } from '@/lib/DataContext';
import { stateHueMap } from '@/lib/colors';
import { accessibilityByState, accessibilityGaps, sortStatesForComparison } from '@/lib/computations';
import AccessibilityMatrix from './AccessibilityMatrix';
import AccessibilityPipeline from './AccessibilityPipeline';
import RegulationCoverageGrid from './RegulationCoverageGrid';
import StateAccessibilityChart from './StateAccessibilityChart';

/** An editorial statistics row, not a grid of KPI cards — large numbers and typography carry the
 * hierarchy, thin rules separate the three figures instead of borders/shadows around each one. */
function StatStripItem({ count, total, label }: { count: number; total: number; label: string }) {
  const pct = total ? Math.round((100 * count) / total) : 0;
  return (
    <div className="stat-strip-item">
      <div className="stat-strip-frac">
        {count} / {total}
      </div>
      <div className="stat-strip-pct">{pct}%</div>
      <div className="stat-strip-label">{label}</div>
    </div>
  );
}

export default function AccessibilityView() {
  const { accessibility, loading, error } = useData();
  const [stateFilter, setStateFilter] = useState('all');

  const coverage = useMemo(() => (accessibility ? accessibilityByState(accessibility) : []), [accessibility]);
  const sortedCoverage = useMemo(() => sortStatesForComparison(coverage), [coverage]);
  const gaps = useMemo(() => (accessibility ? accessibilityGaps(accessibility) : null), [accessibility]);

  if (loading) return <p className="detail-placeholder">Loading dashboard data…</p>;
  if (error || !accessibility) return <p className="detail-placeholder">Could not load dashboard data: {error}</p>;

  const { summary, states, discoms, state_order } = accessibility;
  const stateHue = stateHueMap(state_order);

  // Every field below reads off `summary`/`state_order`/`discoms` — the currently assessed
  // evidence base, whatever size it happens to be — rather than any fixed expectation of how many
  // jurisdictions or DISCOMs the dashboard "should" have. A jurisdiction or DISCOM that hasn't been
  // researched yet simply isn't in these arrays, so it never enters a denominator or gets treated
  // as a negative result; adding one to the underlying dataset is the only thing that ever changes
  // these numbers.
  const allRegulationsOnline = summary.states_total > 0 && summary.states_regulation_available === summary.states_total;
  const regulationsSentence = summary.states_total === 0
    ? null
    : allRegulationsOnline
      ? `All ${summary.states_total} currently tracked jurisdictions have SoP regulations available online.`
      : `${summary.states_regulation_available} of ${summary.states_total} currently tracked jurisdictions have SoP regulations available online.`;

  const chartRows = sortedCoverage.map((c) => ({
    state: c.state,
    color: stateHue[c.state],
    discoms: discoms.filter((d) => d.state === c.state),
    coverage: c,
  }));

  const handleSelectState = (state: string | null) => setStateFilter(state ?? 'all');

  return (
    <div>
      <div className="kicker" style={{ marginTop: 0 }}>
        <span className="bar" />
        <span className="label">Accessibility</span>
      </div>
      <h1 style={{ fontSize: 26, color: 'var(--ink)', marginBottom: 4 }}>Regulatory &amp; Data Transparency</h1>
      <p className="section-note" style={{ marginTop: 0, marginBottom: 12, maxWidth: 640 }}>
        This page tracks whether Standards of Performance regulations and reported DISCOM performance data are publicly accessible, and whether
        published performance data is available in a machine-readable format.
      </p>
      <p className="access-coverage-note">
        Current dashboard coverage: {summary.states_total} jurisdiction{summary.states_total === 1 ? '' : 's'} · {summary.discoms_total} DISCOM
        {summary.discoms_total === 1 ? '' : 's'}
        <br />
        Coverage expands as additional jurisdictions and DISCOMs are incorporated into the evidence base.
      </p>

      <div className="stat-strip">
        <StatStripItem count={summary.states_regulation_available} total={summary.states_total} label="Regulations Online" />
        <StatStripItem count={summary.discoms_available_on_serc} total={summary.discoms_total} label="Data Published" />
        <StatStripItem count={summary.discoms_machine_readable} total={summary.discoms_total} label="Machine-Readable" />
      </div>

      {regulationsSentence && (
        <p className="access-takeaway">
          {regulationsSentence}
          <br />
          Of {summary.discoms_total} tracked DISCOMs, {summary.discoms_available_on_serc} publish performance data and {summary.discoms_machine_readable}{' '}
          make it available in a machine-readable format.
        </p>
      )}

      <div className="section-header">
        <span className="section-label">Overview</span>
        <span className="section-title">Accessibility Pipeline</span>
        <span className="section-sub">Where DISCOM data is lost between being tracked, published, and made reusable</span>
      </div>
      {gaps && (
        <AccessibilityPipeline
          tracked={summary.discoms_total}
          published={summary.discoms_available_on_serc}
          machineReadable={summary.discoms_machine_readable}
          notPublished={gaps.notPublished}
          publishedNotMachineReadable={gaps.publishedNotMachineReadable}
        />
      )}

      <div className="section-header">
        <span className="section-label">Regulatory Coverage</span>
        <span className="section-title">SoP Regulations Online</span>
        <span className="section-title-figure">
          {summary.states_regulation_available} / {summary.states_total}
        </span>
      </div>
      <RegulationCoverageGrid states={states} stateOrder={state_order} stateHue={stateHue} />

      <div className="section-header">
        <span className="section-label">Jurisdiction Coverage</span>
        <span className="section-title">Publication &amp; Reusability by Jurisdiction</span>
        <span className="section-sub">
          Each dot represents one DISCOM. Jurisdictions are sorted by machine-readable share, followed by publication share. Click a jurisdiction to
          filter the matrix below.
        </span>
      </div>
      <StateAccessibilityChart rows={chartRows} activeState={stateFilter === 'all' ? null : stateFilter} onSelectState={handleSelectState} />

      <div className="section-header">
        <span className="section-label">DISCOM Detail</span>
        <span className="section-title">Accessibility Matrix</span>
      </div>
      <AccessibilityMatrix discoms={discoms} stateOrder={state_order} stateHue={stateHue} stateFilter={stateFilter} onStateFilterChange={setStateFilter} />
    </div>
  );
}

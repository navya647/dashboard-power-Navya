'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { Line } from 'react-chartjs-2';
import type { Chart as ChartJS } from 'chart.js';
import { cssVar, useThemeTick } from '@/lib/chartTheme';
import { fyLabel } from '@/lib/format';
import { quarterVerdicts, standardParts, timeSpecs, type MasterDiscom } from '@/lib/master';
import { plotBenchmark, plotFigure, quarterFigures, standardLimit, type PlotBenchmark } from '@/lib/plotFigures';
import { isQuarterly, unitOf } from '@/lib/glance';
import { FAMILY_DEFINITIONS } from '@/lib/familyDefinitions';
import { compareColor } from '@/lib/computations';
import type { MasterRow } from '@/lib/types';

/** One indicator on the State page, read straight from DISCOM_SoP_master.xlsx, with no table,
 * everything full width:
 *  - a trend chart (only where lib/plotFigures finds figures), its y-axis a fixed width so its
 *    year columns line up with
 *  - the DISCOM tracks: one line per DISCOM, one stop per FY (two small stops where the sheet
 *    splits a year by regulation period), filled by the sheet's own Standard met, the figure
 *    under it where there is one;
 *  - the evidence flow: the selected row as five linked steps left to right (regulation →
 *    standard → reported → standardised → verdict), each with its headline text and an ⓘ
 *    pop-over holding the full wording and the step's notes, every column of the row, verbatim.
 * Clicking a stop or a chart point selects that row. */

const NA = 'N/A';

/** The "Assessed against" step: the standard's threshold sentence(s), verbatim (the time limits
 * are under the indicator name); a standard with no separate threshold sentence, whole. */
const assessedAgainst = (r: MasterRow): string | null => {
  const th = standardParts(r).filter((p) => p.threshold).map((p) => p.text);
  return th.length ? th.join(' ') : r.standard;
};
const show = (v: string | null | undefined) => (v == null || v === '' ? NA : v);
/** chart y-axis width = track label column, so chart years and track stops share columns */
const LABEL_COL = 92;
// the name column widens for longer track names (Compare's "AVVNL · service line"), so none is cut
// short; ~7.8px a character at the tracks' 12.5px bold
const labelColFor = (discoms: MasterDiscom[]) => Math.max(LABEL_COL, ...discoms.map((d) => Math.ceil(d.code.length * 7.8) + 10));

/** "Q1: Yes · Q2: No · Q3: not reported · …", the quarters exactly as the sheet gives them */
function quartersText(q: (string | null)[]): string {
  return q.map((v, i) => `Q${i + 1}: ${v ?? 'not reported'}`).join(' · ');
}

/** Four quarter marks: green = met, red = not met, grey = not reported. */
function QuarterPips({ q }: { q: (string | null)[] }) {
  return (
    <span className="mi-qpips" aria-hidden="true">
      {q.map((v, i) => (
        <span key={i} className={`mi-qpip${v == null ? ' is-none' : verdictMod(v)}`} />
      ))}
    </span>
  );
}

function verdictMod(v: string | null): string {
  return v === 'Yes' ? ' is-yes' : v === 'No' ? ' is-no' : '';
}

interface Props {
  indicator: string;
  /** this indicator's rows for the selected DISCOMs, in sheet order */
  rows: MasterRow[];
  discoms: MasterDiscom[];
  yearsAsc: string[];
  /** Compare page: rows span several states, whose time limits differ, so the header's merged
   * time-limit list is left out (each row's own standard is still on its evidence trail) */
  hideTimes?: boolean;
  /** Compare page: chart each row's year figure only, never the Q1–Q4 slots (user, 28 Oct 2026:
   * "lose granularity and use annual data where defensibly possible"); no figure is annualised */
  annualOnly?: boolean;
  /** Compare page: no per-DISCOM tracks under the chart, the data is read on the chart alone (user,
   * 28 Oct 2026); a colour key names each line and a point click selects the row */
  chartOnly?: boolean;
  /** Compare: the selected states, so each gets its own benchmark line in its map colour */
  states?: string[];
}

export default function MasterIndicator({ indicator, rows, discoms, yearsAsc, hideTimes = false, annualOnly = false, chartOnly = false, states }: Props) {
  const uid = useId();
  const present = discoms.filter((d) => rows.some((r) => r.discom_code === d.code));
  // stops per DISCOM per year, sheet order within a year
  const grid = present.map((d) => ({ d, years: yearsAsc.map((y) => rows.filter((r) => r.discom_code === d.code && r.financial_year === y)) }));

  // default: the latest row with a figure, else the latest row with a verdict, else the first row
  const pickDefault = () => {
    const latestFirst = [...rows].sort((a, b) => b.financial_year.localeCompare(a.financial_year));
    return (latestFirst.find((r) => plotFigure(r)) ?? latestFirst.find((r) => quarterVerdicts(r) || r.standard_met === 'Yes' || r.standard_met === 'No') ?? rows[0])?.id ?? null;
  };
  const [selectedId, setSelectedId] = useState<string | null>(pickDefault);
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0];

  const first = rows[0];
  if (!first || !selected) return null;
  const categories = [...new Set(rows.map((r) => r.category))];
  const units = [...new Set(rows.map((r) => r.unit).filter((u): u is string => !!u))];
  const definitions = [...new Set(rows.map((r) => r.definition).filter((d): d is string => !!d))];
  // the chart is always annual (user, 28 Oct 2026: "the graph should be annual and below that the
  // quarterly data should be there as it is now"): year figures only; the tracks keep the quarters
  const plotted = rows.some((r) => plotFigure(r) != null);
  const hasBench = rows.some((r) => plotBenchmark(r, plotFigure(r)) != null);
  const selDiscom = present.find((d) => d.code === selected.discom_code);
  // annual-only (Compare): every row reads as its year verdict, never Q1–Q4
  const qVerdicts = (r: MasterRow) => (annualOnly ? null : quarterVerdicts(r));
  const hasQuarterly = rows.some((r) => qVerdicts(r));
  const times = timeSpecs(rows);
  const hasYearVerdict = rows.some((r) => !qVerdicts(r));
  const selQ = qVerdicts(selected);

  return (
    <article className="im mi animate-in" aria-labelledby={`${uid}-title`}>
      <header className="mi-head">
        <p className="im-eyebrow">
          {categories.join(' / ')}
        </p>
        <h3 id={`${uid}-title`} className="mi-name">
          {indicator}
        </h3>
        {/* the time limits the state's standards set, as written, one sentence per line; standards
            are state-level, so no DISCOM tag even where only one DISCOM's row spells them out */}
        {!hideTimes && times.length > 0 && (
          <div className="mi-time">
            <svg className="mi-time-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Time specified">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <ul>
              {times.map((t) => (
                <li key={t.text}>
                  {t.text.split(/(?<=[.;])\s+/).map((line, i) => (
                    <span key={i} className="mi-time-line">
                      {line}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* once here when every row words it the same; otherwise on the Regulation step */}
        {definitions.length === 1 && <p className="mi-def">{definitions[0]}</p>}
        {/* the signed-off plain definition for the indicator family, where there is one */}
        {FAMILY_DEFINITIONS[first.indicator_family] && (
          <p className="mi-short">
            <span>In short</span> {FAMILY_DEFINITIONS[first.indicator_family]}
          </p>
        )}
      </header>

      {plotted && <MasterTrend annualOnly yearVerdicts={annualOnly} table={chartOnly} benchStates={states} rows={rows} discoms={present} yearsAsc={yearsAsc} sheetUnit={units.length === 1 ? units[0] : null} selectedId={selected.id} onSelect={setSelectedId} />}

      {!(chartOnly && plotted) && (
      <div className="mi-tracks" role="group" aria-label="Rows by DISCOM and year" style={{ ['--cols' as string]: yearsAsc.length, ['--label-col' as string]: `${labelColFor(present)}px` }}>
        {!plotted && (
          <div className="mi-track mi-track--axis" aria-hidden="true">
            <span />
            {yearsAsc.map((y) => (
              <span key={y} className="mi-year">
                {fyLabel(y)}
              </span>
            ))}
          </div>
        )}
        {grid.map(({ d, years }) => {
          const yearsWithRows = years.map((rs, i) => (rs.length ? i : -1)).filter((i) => i >= 0);
          const from = yearsWithRows[0] ?? 0;
          const to = yearsWithRows[yearsWithRows.length - 1] ?? 0;
          return (
            <div key={d.code} className="mi-track" style={{ ['--key' as string]: d.color, ['--from' as string]: from, ['--to' as string]: to }}>
              <span className="mi-track-name" title={d.name !== d.code ? d.name : undefined}>
                {d.code}
              </span>
              <span className="mi-rail" aria-hidden="true" />
              {years.map((rs, yi) => (
                <span key={yi} className="mi-cell">
                  {rs.map((r) => {
                    const fig = plotFigure(r);
                    const q = qVerdicts(r);
                    const on = r.id === selected.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className={`mi-stop${q ? ' is-quarterly' : verdictMod(r.standard_met)}${on ? ' is-on' : ''}${rs.length > 1 ? ' is-split' : ''}`}
                        aria-pressed={on}
                        aria-label={`${d.code}, ${fyLabel(r.financial_year)}${rs.length > 1 ? `, ${show(r.standard)}` : ''}: ${q ? quartersText(q) : `standard met ${show(r.standard_met)}`}${fig ? `, ${fig.text}` : ''}`}
                        onClick={() => setSelectedId(r.id)}
                      >
                        {q ? <QuarterPips q={q} /> : <span className="mi-stop-dot" aria-hidden="true" />}
                        {fig && rs.length === 1 && (annualOnly || !isQuarterly(r)) && <span className="mi-stop-fig">{fig.text}</span>}
                      </button>
                    );
                  })}
                </span>
              ))}
            </div>
          );
        })}
      </div>
      )}

      <p className="mi-key" aria-hidden="true">
        {chartOnly &&
          plotted &&
          present.map((d) => (
            <span key={d.code} className="mi-key-discom" style={{ ['--key' as string]: d.color }}>
              <span className="mi-key-line" /> {d.code}
            </span>
          ))}
        {hasYearVerdict && (
          <>
            <span className="mi-stop-dot is-yes" /> Standard met: Yes
            <span className="mi-stop-dot is-no" /> No
            <span className="mi-stop-dot" /> N/A
          </>
        )}
        {hasQuarterly && !(chartOnly && plotted) && (
          <>
            <QuarterPips q={['Yes', 'No', null, 'Yes']} /> Assessed each quarter (Q1–Q4; grey = not reported)
          </>
        )}
        {hasBench && (
          <>
            <span className="mi-dash" /> Benchmark, from the standard
          </>
        )}
        <span className="mi-key-hint">Select a point to follow its evidence</span>
      </p>

      {/* the selected row, left to right: where the rule comes from → what it asks → what was
          reported → how it was standardised → the sheet's verdict */}
      <section className="mi-flow-wrap" aria-live="polite" aria-label="Evidence for the selected point" style={{ ['--key' as string]: selDiscom?.color }}>
        <p className="mi-flow-head">
          <span className="mi-trail-swatch" aria-hidden="true" />
          <b>{selected.discom_code}</b>
          <span>{fyLabel(selected.financial_year)}</span>
        </p>
        <ol className="mi-flow">
          <Step label="Regulation" text={selected.applicable_regulation} more={definitions.length > 1 ? [{ label: 'Definition', text: selected.definition }] : []} />
          {/* the threshold sentence(s) only, the time limits being under the indicator name; a
              standard with no separate threshold sentence is shown whole. Full standard in the ⓘ. */}
          <Step label="Assessed against" text={assessedAgainst(selected)} more={[{ label: 'Standard', text: selected.standard }]} />
          <Step
            label="Reported data"
            text={selected.reported_data}
            more={[
              { label: 'Source', text: selected.reported_data_source },
              { label: 'File', text: selected.source_file },
            ]}
          />
          <Step label="Standardised data" text={selected.standardised_data} more={[{ label: 'Documentation', text: selected.documentation }]} />
          <Step
            label={selQ ? 'Met each quarter' : 'Standard met'}
            verdict={selQ ? null : selected.standard_met}
            quarters={selQ}
            text={`Comparison possible: ${show(selected.comparison_possible)}`}
            more={[
              // for quarterly rows the detail's trailing "(FY: …)" is the year verdict, not shown
              ...(selQ ? [] : [{ label: 'Detail', text: selected.standard_met_detail }]),
              ...(selected.why_not_comparable ? [{ label: 'Why not comparable', text: selected.why_not_comparable }] : []),
              { label: 'Interpretation', text: selected.interpretation },
            ]}
          />
        </ol>
      </section>
    </article>
  );
}

/** One link in the evidence flow: its headline text (cut to three lines), and an ⓘ that opens the
 * full wording plus the step's notes in a pop-over, so every column is there without a text wall. */
function Step({ label, text, body, verdict, quarters, more = [] }: { label: string; text: string | null; body?: ReactNode; verdict?: string | null; quarters?: (string | null)[] | null; more?: { label: string; text: string | null }[] }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <li className={`mi-step${verdict !== undefined ? ` mi-step--verdict${verdictMod(verdict)}` : ''}`} onMouseLeave={() => setOpen(false)}>
      <span className="mi-step-node" aria-hidden="true" />
      <div className="mi-step-top">
        <p className="mi-step-label">{label}</p>
        <button type="button" className="mi-step-info" aria-expanded={open} aria-controls={id} aria-label={`${label}: full text and notes`} onClick={() => setOpen((o) => !o)}>
          i
        </button>
      </div>
      {quarters ? (
        <span className="mi-quarters">
          {quarters.map((v, i) => (
            <span key={i} className={`mi-verdict${v == null ? '' : verdictMod(v)}`}>
              Q{i + 1} {v ?? 'Not reported'}
            </span>
          ))}
        </span>
      ) : (
        verdict !== undefined && <span className={`mi-verdict${verdictMod(verdict)}`}>{show(verdict)}</span>
      )}
      {body ?? <p className="mi-step-text">{show(text)}</p>}
      {open && (
        <div className="mi-pop" id={id} role="note">
          {verdict === undefined && more[0]?.text !== text && <p>{show(text)}</p>}
          {more.map((m) => (
            <p key={m.label}>
              <b>{m.label}:</b> {show(m.text)}
            </p>
          ))}
        </div>
      )}
    </li>
  );
}

/** The trend: one line per DISCOM over the figures lib/plotFigures reads from the sheet, on their
 * own unit, never converted. Filled point = the sheet says Yes (met) / No (not met); hollow = the
 * sheet's verdict is anything else. The tooltip shows the cell's text, not the number. Benchmark:
 * one neutral dotted stepped line where every DISCOM's standard gives the same number for a year,
 * otherwise one dotted line per DISCOM in its colour; labelled on the line itself. */
function MasterTrend({ rows, discoms, yearsAsc, sheetUnit, selectedId, onSelect, annualOnly = false, yearVerdicts = false, table = false, benchStates }: { annualOnly?: boolean; yearVerdicts?: boolean; table?: boolean; benchStates?: string[]; rows: MasterRow[]; discoms: MasterDiscom[]; yearsAsc: string[]; sheetUnit: string | null; selectedId: string; onSelect: (id: string) => void }) {
  useThemeTick();
  const good = cssVar('--good', '#2f8f4e');
  const critical = cssVar('--critical', '#c8432f');
  const panel = cssVar('--panel', '#fff');
  const gridColor = cssVar('--chart-grid', 'rgba(18,23,42,0.05)');
  const tooltipBg = cssVar('--chart-tooltip-bg', '#1c2127');
  const benchColor = cssVar('--chart-benchmark', 'rgba(17,17,17,0.72)');

  // Figures are charted in the period their standard is set for, never annualised (user, 28 Oct
  // 2026): rows assessed quarter by quarter (or held to a per-quarter limit) plot their four quarter
  // figures against the per-quarter limit; other rows their year figure. One period and one unit
  // per chart, whichever most of this indicator's rows use.
  const quarterRows = annualOnly ? [] : rows.filter(isQuarterly);
  const annualRows = rows.filter((x) => (annualOnly || !isQuarterly(x)) && plotFigure(x));
  const quarterMode = quarterRows.length > 0 && quarterRows.length >= annualRows.length;
  const pool = quarterMode ? quarterRows : annualRows;
  const unitCounts = new Map<string, number>();
  for (const r of pool) {
    const u = (quarterMode ? unitOf(r) : plotFigure(r)?.unit) ?? '';
    unitCounts.set(u, (unitCounts.get(u) ?? 0) + 1);
  }
  const chartUnit = [...unitCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  const inUnit = (x: MasterRow) => ((quarterMode ? unitOf(x) : plotFigure(x)?.unit) ?? '') === chartUnit;

  // x positions: one per year, or four per year (Q1–Q4)
  const slots = quarterMode ? yearsAsc.flatMap((y) => [0, 1, 2, 3].map((q) => ({ y, q }))) : yearsAsc.map((y) => ({ y, q: -1 }));
  const yesNo = (v: string | null | undefined) => (v === 'Yes' ? 'Yes' : v === 'No' ? 'No' : null);
  const perQuarter = (v: number) => `${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}${chartUnit === '%' ? '%' : ` ${chartUnit} per quarter`}`;

  const lines = discoms
    .map((d) => {
      const at = slots.map(({ y, q }) => {
        const r = pool.find((x) => x.discom_code === d.code && x.financial_year === y && inUnit(x));
        if (!r) return null;
        if (q < 0) {
          const fig = plotFigure(r)!;
          // a quarter-assessed row has no yearly verdict on the State page (its quarters are on the track); Compare shows it
          return { r, q, value: fig.value, text: r.standardised_data, bench: plotBenchmark(r, fig), verdict: isQuarterly(r) && !yearVerdicts ? null : yesNo(r.standard_met) };
        }
        const value = quarterFigures(r)?.[q];
        if (value == null) return null;
        const share = chartUnit === '%' ? plotBenchmark(r, { value, unit: '%', text: '' }) : null;
        const lim = chartUnit === '%' ? null : standardLimit(r, chartUnit);
        const bench = share ?? (lim?.period === 'quarter' ? { value: lim.value, label: perQuarter(lim.value) } : null);
        return { r, q, value, text: `Q${q + 1}: ${perQuarter(value)}`, bench, verdict: yesNo(quarterVerdicts(r)?.[q]) };
      });
      return { d, at };
    })
    .filter((l) => l.at.some((p) => p != null));

  const axisUnit = chartUnit ? (chartUnit === '%' ? '%' : quarterMode ? `${chartUnit} per quarter` : chartUnit) : sheetUnit;

  // one shared line when, slot by slot, every DISCOM with a benchmark gives the same number
  const benchBySlot = slots.map((_, i) => [...new Set(lines.map((l) => l.at[i]?.bench?.value).filter((v): v is number => v != null))]);
  type BenchLine = { label: string; color: string; points: (PlotBenchmark | null)[]; byState?: boolean };
  const perDiscom = (ls: typeof lines): BenchLine[] => ls.map((l) => ({ label: `${l.d.code} benchmark`, color: l.d.color, points: l.at.map((p) => p?.bench ?? null) }));
  let shared = benchBySlot.every((vals) => vals.length <= 1);
  let benchLines: BenchLine[];
  if (benchStates) {
    // Compare: one line per state, in its map colour, labelled with the state (user, 28 Oct 2026);
    // a state whose DISCOMs disagree keeps one line per DISCOM; states with the same value share one line
    shared = false;
    benchLines = [];
    for (const st of benchStates) {
      const ls = lines.filter((l) => l.at.some((p) => p?.r.state === st));
      const vals = slots.map((_, i) => [...new Set(ls.map((l) => l.at[i]?.bench?.value).filter((v): v is number => v != null))]);
      if (!vals.every((v) => v.length <= 1)) {
        benchLines.push(...perDiscom(ls));
        continue;
      }
      const points = slots.map((_, i) => ls.map((l) => l.at[i]?.bench).find((b) => b) ?? null);
      if (!points.some((p) => p)) continue;
      // another state's line holding the same single value (over whatever years each covers): one
      // line named for both, "Telangana, Odisha benchmark" (user, 28 Oct 2026)
      const only = [...new Set(points.filter((p) => p).map((p) => p!.value))];
      const same =
        only.length === 1
          ? benchLines.find((b) => b.byState && new Set(b.points.filter((p) => p).map((p) => p!.value)).size === 1 && b.points.find((p) => p)!.value === only[0])
          : undefined;
      if (same) {
        same.label = same.label.replace(/ benchmark$/, `, ${st} benchmark`);
        same.points = same.points.map((p, i) => p ?? points[i]);
      } else benchLines.push({ label: `${st} benchmark`, color: compareColor(benchStates, st) ?? benchColor, points, byState: true });
    }
  } else {
    benchLines = shared ? [{ label: 'Benchmark', color: benchColor, points: slots.map((_, i) => lines.map((l) => l.at[i]?.bench).find((b) => b) ?? null) }] : perDiscom(lines);
  }
  const drawnBench = benchLines.filter((b) => b.points.some((p) => p));
  const sharedBenchLabel = 'Benchmark';

  // filled only where there is a benchmark to judge the figure against; otherwise hollow (N/A),
  // never "not met" (user, 28 Oct 2026)
  const fill = (p: { bench: PlotBenchmark | null; verdict: string | null } | null, color: string) =>
    (p?.bench && p.verdict === 'Yes' ? good : p?.bench && p.verdict === 'No' ? critical : panel) || color;

  // writes each benchmark line's label just above its last drawn point. react-chartjs-2 keeps the
  // plugin from the first render, so it reads this render's lines through a ref: otherwise a DISCOM
  // or indicator change leaves it counting the old lines and the label disappears
  // Compare: room right of the plot for the benchmark labels (~6.6px a character at 11px bold)
  const benchPad = table && drawnBench.length ? Math.ceil(Math.max(...drawnBench.map((b) => Math.max(b.label.length - 10, 16))) * 6.6) + 16 : 0;
  const benchNow = useRef({ drawnBench, lineCount: lines.length, shared, sharedBenchLabel, offChart: table });
  benchNow.current = { drawnBench, lineCount: lines.length, shared, sharedBenchLabel, offChart: table };
  const benchLabels = {
    id: 'miBenchLabels',
    afterDatasetsDraw(chart: ChartJS) {
      const { ctx } = chart;
      const { drawnBench, lineCount, shared, sharedBenchLabel } = benchNow.current;
      const usedY: number[] = [];
      chart.data.datasets.forEach((ds, di) => {
        const b = drawnBench[di - lineCount];
        if (!b || !chart.isDatasetVisible(di)) return;
        const meta = chart.getDatasetMeta(di);
        let last = -1;
        b.points.forEach((p, i) => p && (last = i));
        const el = meta.data[last];
        if (!el) return;
        if (benchNow.current.offChart) {
          // Compare: in the margin right of the plot, level with the line's end, so no point or line
          // is covered; the state name(s) on one line, "benchmark: 95%" under it; close labels stack
          let y = el.y;
          while (usedY.some((u) => Math.abs(u - y) < 28)) y = Math.max(...usedY) + 28;
          usedY.push(y);
          ctx.save();
          ctx.fillStyle = typeof ds.borderColor === 'string' ? ds.borderColor : benchColor;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          const x = chart.chartArea.right + 10;
          ctx.font = `700 11px ${cssVar('--font-sans', 'system-ui, sans-serif')}`;
          ctx.fillText(b.label.replace(/ benchmark$/, ''), x, y - 7);
          ctx.font = `600 11px ${cssVar('--font-sans', 'system-ui, sans-serif')}`;
          ctx.fillText(`benchmark: ${b.points[last]!.label}`, x, y + 7);
          ctx.restore();
          return;
        }
        // centred between the last two year columns, so the label never sits on a data point
        const prev = meta.data[last - 1];
        const lx = prev ? (prev.x + el.x) / 2 : el.x;
        ctx.save();
        ctx.font = `600 11px ${cssVar('--font-sans', 'system-ui, sans-serif')}`;
        ctx.fillStyle = typeof ds.borderColor === 'string' ? ds.borderColor : benchColor;
        ctx.textAlign = prev ? 'center' : 'right';
        ctx.textBaseline = 'bottom';
        // two labels at nearly the same height: the later one moves below its line
        let y = el.y - 6;
        if (usedY.some((u) => Math.abs(u - y) < 14)) {
          y = el.y + 18;
        }
        usedY.push(y);
        const text = `${shared ? sharedBenchLabel : b.label}: ${b.points[last]!.label}`;
        // a panel-coloured backing so the label reads where it crosses the data lines
        const w = ctx.measureText(text).width;
        const tx = prev ? lx : el.x + 10;
        const left = prev ? lx - w / 2 : tx - w;
        ctx.fillStyle = panel;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(left - 4, y - 13, w + 8, 15);
        ctx.globalAlpha = 1;
        ctx.fillStyle = typeof ds.borderColor === 'string' ? ds.borderColor : benchColor;
        ctx.fillText(text, tx, y);
        ctx.restore();
      });
    },
  };

  return (
    <div className="mi-chart-block">
      {axisUnit && <p className="mi-axis-unit">{axisUnit}</p>}
      <div className="mi-chart">
        <Line
          data={{
            labels: slots.map(({ y, q }) => (q < 0 ? fyLabel(y) : q === 0 ? ['Q1', fyLabel(y)] : [`Q${q + 1}`, ''])),
            datasets: [
              ...lines.map(({ d, at }) => ({
                label: d.code,
                data: at.map((p) => p?.value ?? null),
                borderColor: d.color,
                backgroundColor: d.color,
                borderWidth: 2,
                spanGaps: true,
                pointRadius: at.map((p) => (p?.r.id === selectedId ? 8 : 5)),
                pointHoverRadius: 8,
                pointBorderWidth: at.map((p) => (p?.r.id === selectedId ? 3 : 2)),
                pointBorderColor: d.color,
                pointBackgroundColor: at.map((p) => fill(p, d.color)),
              })),
              ...drawnBench.map((b) => ({
                label: b.label,
                data: b.points.map((p) => p?.value ?? null),
                borderColor: b.color,
                backgroundColor: b.color,
                borderWidth: 1.5,
                borderDash: [3, 4],
                stepped: 'middle' as const,
                spanGaps: false,
                pointRadius: 0,
                pointHoverRadius: 0,
              })),
            ],
          }}
          plugins={[benchLabels]}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500 },
            interaction: { mode: 'nearest', intersect: true },
            layout: { padding: { top: 18, right: benchPad, left: 0 } },
            // a point selects its row in the evidence trail
            onClick: (_e, els) => {
              const el = els.find((x) => x.datasetIndex < lines.length);
              const p = el ? lines[el.datasetIndex]?.at[el.index] : null;
              if (p) onSelect(p.r.id);
            },
            onHover: (e, els) => {
              const t = e.native?.target as HTMLElement | undefined;
              if (t) t.style.cursor = els.some((x) => x.datasetIndex < lines.length) ? 'pointer' : 'default';
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: tooltipBg,
                displayColors: false,
                // the benchmark is labelled on its line, never a tooltip of its own
                filter: (item) => item.datasetIndex < lines.length,
                callbacks: {
                  title: (items) => {
                    const sl = items[0] ? slots[items[0].dataIndex] : null;
                    return sl ? `${items[0].dataset.label} · ${sl.q < 0 ? fyLabel(sl.y) : `Q${sl.q + 1} ${fyLabel(sl.y)}`}` : '';
                  },
                  label: (c) => {
                    const p = lines[c.datasetIndex]?.at[c.dataIndex];
                    return p ? (p.q < 0 ? `Standardised data: ${show(p.text)}` : p.text ?? NA) : NA;
                  },
                  afterLabel: (c) => {
                    const p = lines[c.datasetIndex]?.at[c.dataIndex];
                    if (!p) return '';
                    const met = p.bench ? (p.verdict ?? 'N/A') : 'N/A';
                    return [`Standard met${p.q < 0 ? '' : ` (Q${p.q + 1})`}: ${met}`, `Standard: ${show(p.r.standard)}`].flatMap((t) => wrap(t, 60));
                  },
                },
              },
            },
            scales: {
              y: {
                border: { display: false },
                grid: { color: gridColor },
                grace: '8%',
                // figures are never negative: start at zero; a share's axis reaches at least 100%
                beginAtZero: true,
                min: 0,
                ...(chartUnit === '%' ? { suggestedMax: 100 } : {}),
                // fixed width = the tracks' name column, so chart years sit over the track stops
                afterFit: (scale) => {
                  scale.width = labelColFor(discoms);
                },
                ticks: { font: { size: 11 }, maxTicksLimit: 6 },
              },
              x: { border: { display: false }, grid: { display: false }, offset: true, ticks: { font: { size: 11.5, weight: 600 } } },
            },
          }}
        />
      </div>

      {/* Compare: the charted figures as a table, DISCOM × year, each as the sheet writes it; a cell
          selects its row like a point does */}
      {table && (
        <div className="mi-table-wrap">
          <table className="mi-table">
            <thead>
              <tr>
                <th scope="col">DISCOM</th>
                {slots.map(({ y }) => (
                  <th key={y} scope="col">
                    {fyLabel(y)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map(({ d, at }) => (
                <tr key={d.code}>
                  <th scope="row" style={{ color: d.color }}>
                    {d.code}
                  </th>
                  {at.map((p, i) => (
                    <td key={i} className={p && p.r.id === selectedId ? 'is-on' : undefined}>
                      {p ? (
                        <button type="button" onClick={() => onSelect(p.r.id)}>
                          {plotFigure(p.r)?.text ?? p.value.toLocaleString('en-IN')}
                        </button>
                      ) : (
                        NA
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Splits tooltip text into lines of at most `n` characters, on spaces. */
function wrap(text: string, n: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    if (line && line.length + w.length + 1 > n) {
      out.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}

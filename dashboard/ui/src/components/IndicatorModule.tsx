"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import { Interaction, type InteractionModeFunction, type Plugin } from "chart.js";
import { getRelativePosition } from "chart.js/helpers";
import { cssVar, useThemeTick } from "@/lib/chartTheme";
import { hexToRgba } from "@/lib/colors";
import { useData } from "@/lib/DataContext";
import { evidenceStatus, type EvidenceStatus } from "@/lib/evidenceStatus";
import { fmt, fyLabel, fyRunsLabel } from "@/lib/format";
import { type CardPoint, type CardSeries } from "@/lib/indicatorContext";
import {
  axisTitleForUnit,
  displayUnitForMeaning,
  formatInUnit,
  type DisplayUnit,
} from "@/lib/indicatorUnits";
import { benchmarkLine } from "@/lib/benchmarkLine";
import {
  collectRegulationSources,
  isNA,
  textKey,
} from "@/lib/regulationSources";
import {
  REGULATION_TIMELINE,
  eraDateRange,
  erasInYear,
  formatDate,
  type RegulationEra,
} from "@/lib/regulationTimeline";
import { statesStandard, type UnifiedCard } from "@/lib/unifiedIndicators";
import { movementAt } from "@/lib/yearMovement";
import {
  UNMAPPED_BUCKET,
  bucketFor,
} from "@/lib/indicatorBuckets";
import { OTHER_CATEGORY } from "@/lib/sopCategories";
import type { DiscomAccessibility } from "@/lib/types";
import IndicatorDefinition from "./IndicatorDefinition";
import { RegulationDocs, ReportedDataTable } from "./SourceDocuments";

const NO_UNIT = "__none__";
const SEP = "␟";

const unitOf = (p: CardPoint): DisplayUnit | null =>
  displayUnitForMeaning(p.reportedMeaning);
const unitKey = (p: CardPoint) => unitOf(p)?.label ?? NO_UNIT;
const withUnit = (v: number | null, unit: DisplayUnit | null) =>
  `${formatInUnit(v, unit)}${v != null && unit && unit.format !== "percent" ? ` ${unit.label}` : ""}`;
/** a point the source has a record for (a year row exists), whether or not it reports a figure */
const hasRecord = (p: CardPoint) =>
  (p as { exists?: boolean }).exists !== false;

/** Point colour = the source's own compliance verdict ("Standard met?" / "Comparison possible?"),
 * never re-derived from the numbers. */
type Status = "met" | "missed" | "no-benchmark" | "not-comparable";
const STATUS_OF: Partial<Record<EvidenceStatus, Status>> = {
  met: "met",
  "not-met": "missed",
  "no-benchmark": "no-benchmark",
  "not-comparable": "not-comparable",
  unavailable: "not-comparable",
};
const STATUS_LABEL: Record<Status, string> = {
  met: "Met",
  missed: "Missed",
  "no-benchmark": "No benchmark",
  "not-comparable": "Not comparable",
};
const STATUS_ORDER: Status[] = [
  "met",
  "missed",
  "no-benchmark",
  "not-comparable",
];

function useStatusColors(): Record<Status, string> {
  return {
    met: cssVar("--good", "#2f8f4e"),
    missed: cssVar("--critical", "#c8432f"),
    "no-benchmark": cssVar("--warning", "#d08a1e"),
    "not-comparable": cssVar("--muted", "#8a8780"),
  };
}

const statusOf = (p: CardPoint): Status | null =>
  p.value == null ? null : (STATUS_OF[evidenceStatus(p)] ?? null);

/** The benchmark as the sheet gives it: its own wording where it's text, else the number with
 * its meaning. null when the sheet has none. */
function benchmarkText(p: CardPoint): string | null {
  if (
    p.benchmarkRaw &&
    !isNA(p.benchmarkRaw) &&
    Number.isNaN(Number(p.benchmarkRaw))
  )
    return p.benchmarkRaw.replace(/\s+/g, " ").trim();
  if (p.benchmark != null)
    return `${fmt(p.benchmark, 2)}${p.benchmarkMeaning && !isNA(p.benchmarkMeaning) ? ` · ${p.benchmarkMeaning.trim()}` : ""}`;
  if (p.benchmarkRaw && !isNA(p.benchmarkRaw)) return p.benchmarkRaw.trim();
  return null;
}

interface Regime {
  tag: string;
  standard: string | null;
  benchmark: string | null;
  years: string[];
}

/** The most common non-empty text among values that should all be the same, by grouping key. */
function consensus(values: (string | null)[]): string | null {
  const counts = new Map<string, { text: string; n: number }>();
  for (const v of values) {
    if (!v) continue;
    const k = textKey(v);
    const e = counts.get(k);
    if (e) e.n += 1;
    else counts.set(k, { text: v, n: 1 });
  }
  let best: { text: string; n: number } | null = null;
  for (const e of counts.values()) if (!best || e.n > best.n) best = e;
  return best?.text ?? null;
}

/** Standards and benchmarks are set by the state's regulation, so they never differ between
 * DISCOMs — only (possibly) between years. Each year gets one standard and one benchmark (the
 * DISCOM sheets' shared text; where their copies differ in wording, the most common copy), and
 * years with the same pair form one column. The workbooks record the standard per year but not
 * the date a regulation took effect, so a column is labelled with the years it covers. */
function regimesOf(series: CardSeries[], yearsAsc: string[]): Regime[] {
  const out = new Map<string, Regime>();
  for (const year of yearsAsc) {
    const pts = series
      .map((s) => s.points.find((p) => p.year === year))
      .filter((p): p is CardPoint => !!p && hasRecord(p));
    if (!pts.length) continue;
    const standard = consensus(
      pts.map((p) =>
        p.standardSpecified && !isNA(p.standardSpecified)
          ? p.standardSpecified
              .replace(/\s+/g, " ")
              .replace(/\s+([.,;:])/g, "$1")
              .trim()
          : null,
      ),
    );
    const benchmark = consensus(pts.map(benchmarkText));
    const k = `${textKey(standard ?? "")}${SEP}${textKey(benchmark ?? "")}`;
    if (!out.has(k)) out.set(k, { tag: "", standard, benchmark, years: [] });
    out.get(k)!.years.push(year);
  }
  const regimes = [...out.values()];
  regimes.forEach((r, i) => (r.tag = String.fromCharCode(65 + i)));
  return regimes;
}

const BENCH_LABEL = "Benchmark";

declare module "chart.js" {
  interface InteractionModeMap {
    imNearestFigure: InteractionModeFunction;
  }
}

/** Hover picks the single reported figure nearest the cursor — never several DISCOMs at once, and
 * never the benchmark line (it's explained beside the chart). */
Interaction.modes.imNearestFigure = (chart, e) => {
  const pos = getRelativePosition(e, chart);
  let best: { element: never; datasetIndex: number; index: number } | null = null;
  let bestD = Infinity;
  chart.data.datasets.forEach((ds, di) => {
    if (ds.label === BENCH_LABEL || !chart.isDatasetVisible(di)) return;
    chart.getDatasetMeta(di).data.forEach((el, i) => {
      if (ds.data[i] == null) return;
      const d = Math.hypot(el.x - pos.x, el.y - pos.y);
      if (d < bestD) {
        bestD = d;
        best = { element: el as never, datasetIndex: di, index: i };
      }
    });
  });
  return best ? [best] : [];
};

/** Splits text into lines of at most `width` characters at word breaks (canvas tooltips don't wrap). */
function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/* ------------------------------------------------------------------ */
/* Trend chart                                                         */
/* ------------------------------------------------------------------ */

function TrendChart({
  series,
  yearsAsc,
  unit,
  hidden,
  yearTags,
  bench,
  axisTitle,
}: {
  series: CardSeries[];
  yearsAsc: string[];
  unit: DisplayUnit | null;
  hidden: Set<string>;
  yearTags: (string | null)[] | null;
  bench: (number | null)[];
  /** the unit is already in the module header when every figure shares it */
  axisTitle: boolean;
}) {
  useThemeTick();
  const colors = useStatusColors();
  const gridColor = cssVar("--chart-grid", "rgba(18,23,42,0.05)");
  const axisTitleColor = cssVar("--chart-axis-title", "#666662");
  const tooltipBg = cssVar("--chart-tooltip-bg", "#1c2127");
  const ink = cssVar("--ink", "#1c1b19");
  const panel = cssVar("--panel", "#fff");
  // neutral, so the line never reads as the red "Missed" verdict; its own token per theme
  const benchColor = cssVar("--chart-benchmark", "rgba(17,17,17,0.72)");
  const visible = series.filter((s) => !hidden.has(s.label));
  const single = series.length === 1;
  const showLabels = visible.length <= 2;

  const fmtV = (v: number) => formatInUnit(v, unit);
  const hasBench = bench.some((v) => v != null);
  // minutes, counts and rates can't go below zero — keep the axis from inventing negative room
  const nonNegative = [...series.flatMap((s) => s.points.map((p) => p.value)), ...bench].every(
    (v) => v == null || v >= 0,
  );

  const lineColor = (s: CardSeries) =>
    single ? cssVar("--accent", "#3b82c4") : s.color;
  const datasets = series.map((s) => ({
    label: s.label,
    data: s.points.map((p) => p.value),
    hidden: hidden.has(s.label),
    borderColor: lineColor(s),
    borderWidth: 2.5,
    fill: single,
    spanGaps: false,
    tension: 0,
    backgroundColor: lineColor(s).startsWith("#")
      ? hexToRgba(lineColor(s), 0.08)
      : "transparent",
    pointRadius: 4.5,
    pointHoverRadius: 6.5,
    // a verdict fills the point; no verdict leaves it hollow
    pointBackgroundColor: s.points.map((p) => {
      const st = statusOf(p) ?? "not-comparable";
      return st === "not-comparable" ? panel : colors[st];
    }),
    pointBorderColor: lineColor(s),
    pointBorderWidth: 2,
    pointHoverBorderWidth: 2.5,
  }));
  // the benchmark: a dotted line, stepped so a change of regulation shows as a step
  const benchDataset = {
    label: BENCH_LABEL,
    data: bench,
    hidden: false,
    borderColor: benchColor,
    borderWidth: 1.75,
    borderDash: [3, 4],
    borderCapStyle: "round" as const,
    fill: false,
    spanGaps: false,
    tension: 0,
    stepped: "middle" as const,
    backgroundColor: "transparent",
    pointRadius: 0,
    pointHoverRadius: 0,
    pointBackgroundColor: benchColor,
    pointBorderColor: benchColor,
    pointBorderWidth: 0,
  };
  const allDatasets = hasBench ? [...datasets, benchDataset] : datasets;

  // figure written above each point (the mockup's value labels); skipped when 3+ lines would overlap.
  // react-chartjs-2 registers a plugin once, when the chart is created, so the plugin reads this
  // render's values from a ref — otherwise the label colours and toggled lines would stay stale.
  const drawState = useRef({ hasBench, bench, benchColor, ink, showLabels, series, fmtV });
  drawState.current = { hasBench, bench, benchColor, ink, showLabels, series, fmtV };
  const valueLabels = useRef<Plugin<"line">>({
    id: "imValueLabels",
    afterDatasetsDraw(chart) {
      const { hasBench, bench, benchColor, ink, showLabels, series, fmtV } =
        drawState.current;
      const { ctx } = chart;
      ctx.save();
      if (hasBench) {
        const meta = chart.getDatasetMeta(series.length);
        const last = bench.reduce<number>(
          (acc, v, i) => (v != null ? i : acc),
          -1,
        );
        const el = meta.data[last];
        if (el) {
          ctx.font = `600 10.5px ${Chart_fontFamily()}`;
          ctx.fillStyle = benchColor;
          ctx.textAlign = "right";
          ctx.textBaseline = "bottom";
          ctx.fillText(
            `Benchmark ${fmtV(bench[last] as number)}`,
            el.x,
            el.y - 6,
          );
        }
      }
      if (!showLabels) {
        ctx.restore();
        return;
      }
      ctx.font = `600 11px ${Chart_fontFamily()}`;
      ctx.fillStyle = ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      chart.data.datasets.forEach((ds, di) => {
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden || di >= series.length) return;
        meta.data.forEach((el, i) => {
          const v = ds.data[i] as number | null;
          if (v == null) return;
          const note = series[di]?.points[i]?.note ? "*" : "";
          ctx.fillText(`${fmtV(v)}${note}`, el.x, el.y - 9);
        });
      });
      ctx.restore();
    },
  }).current;

  const labels = yearsAsc.map((y, i) =>
    yearTags?.[i] ? [fyLabel(y), yearTags[i] as string] : fyLabel(y),
  );

  return (
    <div className="im-chart">
      <Line
        data={{ labels, datasets: allDatasets }}
        plugins={[valueLabels]}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 600, easing: "easeOutQuart" },
          interaction: { mode: "imNearestFigure", intersect: false },
          layout: { padding: { top: 24, right: 8, left: 0 } },
          plugins: {
            legend: { display: false },
            // one figure at a time: DISCOM · year, the figure, its verdict and change on one line,
            // and the source's note (if any) in small print — the benchmark is explained beside
            // the chart, so it never takes a tooltip of its own
            tooltip: {
              backgroundColor: tooltipBg,
              padding: { x: 12, y: 10 },
              cornerRadius: 8,
              displayColors: false,
              titleFont: { size: 12, weight: 700 },
              titleMarginBottom: 4,
              bodyFont: { size: 12 },
              bodySpacing: 3,
              footerFont: { size: 11, weight: 400 },
              footerColor: "rgba(255,255,255,0.72)",
              footerMarginTop: 6,
              callbacks: {
                title: (items) =>
                  items[0]
                    ? `${items[0].dataset.label} · ${fyLabel(yearsAsc[items[0].dataIndex])}`
                    : "",
                label: (c) =>
                  c.raw == null ? "N/A" : withUnit(c.raw as number, unit),
                afterLabel: (c) => {
                  const s = series[c.datasetIndex];
                  const p = s?.points[c.dataIndex];
                  if (!p || p.value == null) return "";
                  const bits: string[] = [];
                  const st = statusOf(p);
                  if (st) bits.push(STATUS_LABEL[st]);
                  const mv = movementAt(s.points, c.dataIndex);
                  if (mv.kind === "moved" && mv.arrow !== "○")
                    bits.push(
                      `${mv.arrow} ${fmt(Math.abs(mv.delta), 2)} vs ${fyLabel(mv.prevYear)}`,
                    );
                  return bits.join("  ·  ");
                },
                footer: (items) => {
                  const it = items[0];
                  const note = it
                    ? series[it.datasetIndex]?.points[it.dataIndex]?.note
                    : null;
                  return note ? wrapText(`* ${note}`, 52) : [];
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: nonNegative,
              grace: "12%",
              border: { display: false },
              grid: { color: gridColor },
              ticks: {
                font: { size: 11 },
                maxTicksLimit: 5,
                padding: 10,
                callback: (v) => fmtV(Number(v)),
              },
              title: {
                display: axisTitle,
                text: axisTitleForUnit(unit),
                font: { size: 10.5, weight: 600 },
                color: axisTitleColor,
              },
            },
            x: {
              border: { display: false },
              grid: { display: false },
              offset: true,
              ticks: { font: { size: 11.5, weight: 600 }, padding: 6 },
            },
          },
        }}
      />
    </div>
  );
}

function Chart_fontFamily(): string {
  return cssVar("--font-sans", "system-ui, sans-serif");
}

/* ------------------------------------------------------------------ */
/* The module                                                        */
/* ------------------------------------------------------------------ */

/** One selected indicator on the state page. Header: bucket · category, the name (opens the
 * definition pop-up), the unit, and one toggle key per DISCOM (its line colour). Body: a side column with the standard and benchmark in force
 * (one block per distinct standard) and the source documents, presented exactly as on the
 * Accessibility page (shared SourceDocuments: per-DISCOM year links, the SoP regulation list); the trend chart takes the rest, each point filled by the
 * source's own compliance verdict (hollow = no verdict), with a one-line legend of only the
 * verdicts present.
 *
 * Units: one chart. When figures are reported in more than one display unit, the chart plots the
 * unit most figures use and leaves the rest off it (never converted here, never on a shared axis);
 * a one-line note says so. */
export default function IndicatorModule({
  card,
  yearsAsc,
  state,
}: {
  card: UnifiedCard;
  yearsAsc: string[];
  state: string;
}) {
  const { accessibility } = useData();
  const [defOpen, setDefOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const uid = useId();
  const closeDef = useCallback(() => setDefOpen(false), []);
  const colors = useStatusColors();

  const series = card.series;
  const isFramework = series.length > 0 && series.every((s) => s.isFramework);
  // reported figures but no standard in words for this state — the card gets its own tint
  const noStandard =
    !isFramework &&
    !series.some((s) => s.points.some((p) => statesStandard(p.standardSpecified)));
  const hasNumeric = series.some((s) => s.points.some((p) => p.value != null));

  // ---- display units among reported values; the most-used one is plotted ----
  const unitCounts = new Map<string, { unit: DisplayUnit | null; n: number }>();
  for (const s of series)
    for (const p of s.points) {
      if (p.value == null) continue;
      const k = unitKey(p);
      const e = unitCounts.get(k);
      if (e) e.n += 1;
      else unitCounts.set(k, { unit: unitOf(p), n: 1 });
    }
  const unitGroups = [...unitCounts].map(([key, v]) => ({ key, ...v }));
  const plotted = unitGroups.reduce<(typeof unitGroups)[number] | null>(
    (best, g) => (!best || g.n > best.n ? g : best),
    null,
  );
  const offChart =
    unitGroups.length > 1 && plotted
      ? unitGroups
          .filter((g) => g.key !== plotted.key)
          .reduce((n, g) => n + g.n, 0)
      : 0;
  const headerUnit =
    unitGroups.length === 1 ? (unitGroups[0].unit?.label ?? null) : null;
  const chartSeries = plotted
    ? series.map((s) => ({
        ...s,
        points: s.points.map((p) =>
          p.value != null && unitKey(p) === plotted.key
            ? p
            : {
                ...p,
                value: null,
                benchmark: null,
                comparisonPossible: null,
                standardMet: null,
              },
        ),
      }))
    : series;

  // ---- regulation panel ----
  // Standards are state-level: the same for every DISCOM, changing only when a regulation does.
  // Where the source dates a change (lib/regulationTimeline), one column per regulation with its
  // dates; otherwise one column per distinct standard as recorded, labelled by its years.
  const SUP = ["¹", "²", "³", "⁴"];
  const timeline = isFramework ? null : (REGULATION_TIMELINE[state] ?? null);
  const pointsIn = (years: string[]) =>
    series.flatMap((s) =>
      s.points.filter((p) => years.includes(p.year) && hasRecord(p)),
    );
  const standardOf = (p: CardPoint) =>
    p.standardSpecified && !isNA(p.standardSpecified)
      ? p.standardSpecified
              .replace(/\s+/g, " ")
              .replace(/\s+([.,;:])/g, "$1")
              .trim()
      : null;
  let columns: {
    key: string;
    title: string;
    sub: string;
    standard: string | null;
    benchmark: string | null;
  }[];
  let yearTags: (string | null)[] | null = null;
  const footnotes: string[] = [];
  if (timeline) {
    const eras = timeline.filter((e) =>
      yearsAsc.some((y) => erasInYear(state, y).includes(e)),
    );
    columns = eras.map((e) => {
      const only = yearsAsc.filter((y) => {
        const es = erasInYear(state, y);
        return es.length === 1 && es[0] === e;
      });
      const years = only.length
        ? only
        : yearsAsc.filter((y) => erasInYear(state, y).includes(e));
      const pts = pointsIn(years);
      return {
        key: e.name,
        title: e.name,
        sub: eraDateRange(e),
        standard: consensus(pts.map(standardOf)),
        benchmark: consensus(pts.map(benchmarkText)),
      };
    });
    let n = 0;
    const tags = yearsAsc.map((y) => {
      const es = erasInYear(state, y);
      if (es.length < 2) return es[0]?.short ?? null;
      const mark = SUP[n] ?? "*";
      for (let i = 1; i < es.length; i++) {
        const prev: RegulationEra = es[i - 1];
        const next: RegulationEra = es[i];
        footnotes.push(
          `${mark} Regulation changed on ${formatDate(next.from!)}: ${prev.name} applied up to ${formatDate(prev.to!)}; ${next.name} from ${formatDate(next.from!)}.`,
        );
      }
      n += 1;
      return es.map((e) => e.short.replace(/ regs$/, "")).join(" / ") + mark;
    });
    if (eras.length > 1) yearTags = tags;
    const first = eras[0];
    if (
      eras.length === 1 &&
      first.from &&
      yearsAsc[0] &&
      first.from > `${yearsAsc[0].slice(0, 4)}-04-01`
    )
      footnotes.push(
        `${first.name} came into force on ${formatDate(first.from)}, during ${fyLabel(yearsAsc[0])}.`,
      );
  } else {
    const regimes = regimesOf(series, yearsAsc);
    const multi = regimes.length > 1 && !isFramework;
    const cited = collectRegulationSources(series).filter(
      (r) => r.role === "Regulation",
    );
    columns = regimes.map((r) => ({
      key: r.tag,
      title: multi
        ? `Standard ${r.tag}`
        : cited.length === 1
          ? cited[0].title
          : "Standard in force",
      sub: isFramework ? "All years" : fyRunsLabel(r.years, yearsAsc),
      standard: r.standard,
      benchmark: r.benchmark,
    }));
    if (multi) {
      yearTags = yearsAsc.map((y) => {
        const r = regimes.find((x) => x.years.includes(y));
        return r ? `Standard ${r.tag}` : null;
      });
      footnotes.push(
        "The standard recorded in the source differs between years; no date for the change is recorded.",
      );
    }
  }

  // ---- benchmark line (dotted), on the plotted unit's scale only ----
  const bench = benchmarkLine(series, yearsAsc, plotted?.unit ?? null);
  const hasBenchLine = bench.values.some((v) => v != null);

  // ---- documents: the accessibility workbook's links, for the DISCOMs on this chart ----
  const stateAcc = accessibility?.states.find((s) => s.state === state);
  const accDiscoms = isFramework
    ? []
    : series
        .map((s) =>
          accessibility?.discoms.find(
            (d) => d.abbreviation === s.label && d.state === state,
          ),
        )
        .filter((d): d is DiscomAccessibility => d != null);

  const toggleSeries = (label: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  const statuses = new Set(
    chartSeries
      .flatMap((s) => s.points.map(statusOf))
      .filter((x): x is Status => x != null),
  );
  // value labels sit on the chart only while ≤2 lines are visible (see TrendChart)
  const labelsOnChart =
    series.filter((s) => !hidden.has(s.label)).length <= 2;
  const hasNotes = chartSeries.some((s) =>
    s.points.some((p) => p.value != null && p.note),
  );

  // ---- header: where the indicator sits, and each DISCOM's key ----
  const bucket = bucketFor(card.category, card.type, card.indicator);
  const section =
    card.category === OTHER_CATEGORY ? card.type : card.category;
  const eyebrow = [bucket === UNMAPPED_BUCKET ? null : bucket, section]
    .filter((x, i, a) => x && a.indexOf(x) === i)
    .join(" · ");
  return (
    <article
      className={`im animate-in${noStandard ? " im--no-standard" : ""}`}
      aria-labelledby={`${uid}-title`}
    >
      <header className="im-head">
        <p className="im-eyebrow">
          {eyebrow}
          {noStandard && <span className="im-flag">No standard specified</span>}
        </p>
        <span className="im-dl-wrap">
          <button
            type="button"
            className="im-dl"
            aria-disabled="true"
            aria-label="Download — this feature is coming soon"
            aria-describedby={`${uid}-dl`}
            onClick={(e) => e.preventDefault()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
            </svg>
          </button>
          <span role="tooltip" id={`${uid}-dl`} className="im-tip">
            This feature is coming soon
          </span>
        </span>

        <div className="im-title">
          <div className="im-title-row">
            <h3 id={`${uid}-title`} className="im-name">
              <button
                type="button"
                onClick={() => setDefOpen(true)}
                title={`What is ${card.indicator}?`}
              >
                {card.indicator}
              </button>
            </h3>
            <button
              type="button"
              className="im-info"
              onClick={() => setDefOpen(true)}
              aria-label={`Definition of ${card.indicator}`}
              title="Definition"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9.5" />
                <path d="M12 11v6M12 7.5v.01" />
              </svg>
            </button>
          </div>
          {headerUnit && <p className="im-meta">{headerUnit}</p>}
        </div>

        {series.length > 1 && !isFramework && (
          <ul className="im-keys" aria-label="DISCOMs — click to show or hide">
            {series.map((s) => {
              const off = hidden.has(s.label);
              return (
                <li key={s.label}>
                  <button
                    type="button"
                    className={`im-key${off ? " off" : ""}`}
                    aria-pressed={!off}
                    onClick={() => toggleSeries(s.label)}
                    title={off ? `Show ${s.label}` : `Hide ${s.label}`}
                    style={{ ["--key" as string]: s.color }}
                  >
                    <span className="im-key-swatch" aria-hidden="true" />
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </header>

      <div className="im-body">
        {/* ---------- side: the standard in force, then every source document ---------- */}
        <aside className="im-side" aria-label="Regulatory standard and sources">
          {columns.length === 0 ? (
            <section className="im-reg">
              <p className="im-label">Standard</p>
              <p className="im-na">N/A</p>
              <p className="im-label">Benchmark</p>
              <p className="im-na">N/A</p>
            </section>
          ) : (
            columns.map((r, i) => (
              <section key={r.key} className="im-reg">
                <div className="im-reg-head">
                  <b>{r.title}</b>
                  <span>{r.sub}</span>
                </div>
                <p className="im-label">Standard</p>
                {r.standard ? (
                  <blockquote className="im-std">{r.standard}</blockquote>
                ) : (
                  <p className="im-na">N/A</p>
                )}
                <p className="im-label">Benchmark</p>
                <p className={r.benchmark ? "im-bench" : "im-na"}>
                  {r.benchmark ?? "N/A"}
                </p>
                {bench.note && i === columns.length - 1 && (
                  <p className="im-bench-note">{bench.note}</p>
                )}
              </section>
            ))
          )}

          {/* the documents exactly as the Accessibility page's state card presents them */}
          <section className="im-sources" aria-label="Sources">
            {accDiscoms.length > 0 && (
              <div className="acm-block">
                <h3>DISCOMs · reported data</h3>
                <ReportedDataTable state={state} discoms={accDiscoms} />
              </div>
            )}
            <div className="acm-block">
              <h3>SoP regulation</h3>
              <RegulationDocs state={state} regulation={stateAcc} />
            </div>
          </section>
        </aside>

        {/* ---------- main: the trend ---------- */}
        <div className="im-main">
          {isFramework ? (
            <p className="im-empty">
              N/A — the state’s SoP regulation lists this indicator, but no
              figures are reported.
            </p>
          ) : !hasNumeric ? (
            <p className="im-empty">N/A — no reported figures.</p>
          ) : (
            <>
              <TrendChart
                series={chartSeries}
                yearsAsc={yearsAsc}
                unit={plotted?.unit ?? null}
                hidden={hidden}
                yearTags={yearTags}
                bench={bench.values}
                axisTitle={!headerUnit}
              />
              <footer className="im-foot">
                <ul className="im-legend" aria-label="Legend">
                  {STATUS_ORDER.filter((s) => statuses.has(s)).map((s) => (
                    <li key={s}>
                      <span
                        className={`im-dot${s === "not-comparable" ? " im-dot--hollow" : ""}`}
                        style={s === "not-comparable" ? undefined : { background: colors[s] }}
                        aria-hidden="true"
                      />
                      {STATUS_LABEL[s]}
                    </li>
                  ))}
                  {hasBenchLine && (
                    <li>
                      <span className="im-dash" aria-hidden="true" />
                      Benchmark
                    </li>
                  )}
                </ul>
                {(footnotes.length > 0 || hasNotes || offChart > 0) && (
                  <div className="im-foot-notes">
                    {footnotes.map((f) => (
                      <p key={f}>{f}</p>
                    ))}
                    {offChart > 0 && (
                      <p>
                        Unit varies — {offChart} figure{offChart === 1 ? "" : "s"}{" "}
                        reported in another unit {offChart === 1 ? "is" : "are"} left
                        off the chart.
                      </p>
                    )}
                    {hasNotes && (
                      <p>
                        {labelsOnChart
                          ? "* Adjusted or annotated figure — hover the point for the note."
                          : "Some figures carry a source note — hover the points to read it."}
                      </p>
                    )}
                  </div>
                )}
              </footer>
            </>
          )}
        </div>
      </div>

      <IndicatorDefinition
        open={defOpen}
        onClose={closeDef}
        indicator={card.indicator}
        category={card.category}
        type={card.type}
        series={series}
      />
    </article>
  );
}

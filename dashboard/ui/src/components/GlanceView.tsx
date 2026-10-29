"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useData } from "@/lib/DataContext";
import { fyLabel } from "@/lib/format";
import { FAMILY_DEFINITIONS } from "@/lib/familyDefinitions";
import { slugify } from "@/lib/slug";
import { useNoScrollbar } from "@/lib/useNoScrollbar";
import {
  basisLabel,
  formatValue,
  qcRecords,
  QC_INDICATORS,
  QC_YEARS,
  type Period,
  type QcRecord,
} from "@/lib/quickCompare";

/** Quick comparison (/glance), rebuilt 29 Oct 2026 on the approved shortlist (lib/quickCompare.ts).
 * Pick an indicator, a reporting period (annual / quarterly), a year and, for quarterly figures,
 * a quarter. One chart per measurement basis, so figures in different units never share an axis;
 * each line is one DISCOM and category (Urban / Rural / Overall…), in a fixed order so lines can be
 * followed from year to year, with a scale fixed across the years. Where a line has no figure for
 * the chosen year it reads "Unavailable", never zero. Bars are coloured only by the sheet's own
 * verdict, and only where a benchmark in the same unit and period is drawn. The panel beside the
 * charts shows the selected line's record verbatim and the line across all five years. */

interface Props {
  initialIndicator: string | null;
  initialYear: string | null;
}

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const VERDICT_TEXT = {
  met: "Met",
  missed: "Not met",
  none: "No verdict",
} as const;

interface Line {
  series: string;
  code: string;
  state: string;
  category: string;
  /** first line of its DISCOM in the chart: the DISCOM is written once */
  first: boolean;
}

export default function GlanceView({ initialIndicator, initialYear }: Props) {
  const { master, loading, error } = useData();
  const rows = useMemo(() => master?.rows ?? [], [master]);

  const [indKey, setIndKey] = useState(
    () =>
      QC_INDICATORS.find(
        (i) => i.family === initialIndicator || i.label === initialIndicator,
      )?.family ?? QC_INDICATORS[0].family,
  );
  const ind = QC_INDICATORS.find((i) => i.family === indKey)!;
  const records = useMemo(() => qcRecords(rows, ind), [rows, ind]);
  const periods = (["annual", "quarterly"] as Period[]).filter((p) =>
    records.some((r) => r.period === p),
  );

  const [periodPick, setPeriod] = useState<Period>("annual");
  const period = periods.includes(periodPick)
    ? periodPick
    : (periods[0] ?? "annual");
  const [yearPick, setYear] = useState<string | null>(
    initialYear && QC_YEARS.includes(initialYear) ? initialYear : null,
  );
  // only the years with figures for this indicator and period are offered
  const years = QC_YEARS.filter((y) =>
    records.some((r) => r.period === period && r.fy === y),
  );
  // with no year picked (or one without figures here), open on the year that compares the most
  // DISCOMs, the latest of those if several tie
  const fullest = () => {
    let best = years[years.length - 1] ?? QC_YEARS[QC_YEARS.length - 1];
    let most = -1;
    for (const y of years) {
      const n = new Set(records.filter((r) => r.period === period && r.fy === y).map((r) => r.series)).size;
      if (n >= most) {
        most = n;
        best = y;
      }
    }
    return best;
  };
  const year = yearPick && years.includes(yearPick) ? yearPick : fullest();
  const [quarter, setQuarter] = useState(3);
  const [selected, setSelected] = useState<string | null>(null);
  useNoScrollbar();

  // desktop: the page never scrolls. The stage (chart card + record card) takes the height left in
  // the window, and every chart row gets one height, worked out for the longest chart any indicator
  // has, so all indicators, periods and years look the same.
  const stageRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fit = () => {
      const detail = el.querySelector<HTMLElement>(".qc-detail");
      el.style.height = "";
      el.style.removeProperty("--qc-row-h");
      el.style.removeProperty("--qc-row-gap");
      detail?.classList.remove("is-compact", "is-tight", "is-tighter");
      if (window.innerWidth <= 1100) return;
      // the stage takes the room left in the window, less the page's own padding under it
      const box = el.getBoundingClientRect();
      // the page's own padding under the stage (not the shell's empty space, which is only there
      // because the shell is at least one window tall)
      let below = 0;
      for (let e = el.parentElement; e && e !== document.body; e = e.parentElement)
        below += parseFloat(getComputedStyle(e).paddingBottom) || 0;
      const room = Math.floor(Math.max(260, window.innerHeight - box.top - Math.max(8, below)));
      const size = (h: number) => {
      el.style.height = `${h}px`;
      // one row height for every view: the longest chart (9 rows) fits the chart card
      const card = el.querySelector<HTMLElement>(".qc-chartcard");
      const head = el.querySelector<HTMLElement>(".qc-chart-head");
      const axis = el.querySelector<HTMLElement>(".qc-axis");
      const pad = card ? parseFloat(getComputedStyle(card).paddingTop) * 2 + 2 : 42;
      const chrome = pad + (head?.offsetHeight ?? 60) + 8 + (axis?.offsetHeight ?? 20) + 6;
      // never taller than nine full-size rows need, so a tall window doesn't leave the cards empty
      const cap = Math.ceil(chrome + 9 * 44 + 8 * 6);
      if (h > cap) {
        h = cap;
        el.style.height = `${h}px`;
      }
      // nine rows and eight gaps; on a short window the gaps narrow before the rows do
      let gap = 6;
      let row = Math.floor((h - chrome - 8 * gap) / 9);
      if (row < 28) {
        gap = 3;
        row = Math.floor((h - chrome - 8 * gap) / 9);
      }
      el.style.setProperty("--qc-row-gap", `${gap}px`);
      el.style.setProperty("--qc-row-h", `${Math.max(20, Math.min(44, row))}px`);
      };
      size(room);
      // whatever still runs below the window comes off the stage, so the page never scrolls
      const over = document.documentElement.scrollHeight - window.innerHeight;
      if (over > 0) size(Math.max(260, room - over - 2));
      // a short window: the record card tightens in steps, never scaled
      for (const step of ["is-compact", "is-tight", "is-tighter"]) {
        if (!detail || detail.offsetHeight <= el.clientHeight) break;
        detail.classList.add(step);
      }
    };
    fit();
    const raf = requestAnimationFrame(fit);
    document.fonts?.ready.then(fit);
    window.addEventListener("resize", fit);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
    };
  }, [master, ind, period, year, quarter, selected]);

  useEffect(() => {
    const qs = new URLSearchParams({ indicator: ind.family, year }).toString();
    window.history.replaceState(null, "", `${window.location.pathname}?${qs}`);
  }, [ind, year]);

  // the charts: one per measurement basis in this period, its lines every series seen in any year
  const charts = useMemo(() => {
    const inPeriod = records.filter((r) => r.period === period);
    const bases = [...new Set(inPeriod.map((r) => r.basis))];
    return bases.map((basis) => {
      const recs = inPeriod.filter((r) => r.basis === basis);
      const seen = new Map<string, QcRecord>();
      for (const r of recs) if (!seen.has(r.series)) seen.set(r.series, r);
      const order = (r: QcRecord) =>
        ind.discoms.indexOf(r.code) * 10 +
        [
          "Overall",
          "All feeders",
          "Excl. agricultural feeders",
          "Urban",
          "Cities & towns",
          "Rural",
        ].indexOf(r.category);
      const lines: Line[] = [...seen.values()]
        .sort((a, b) => order(a) - order(b))
        .map((r, i, all) => ({
          series: r.series,
          code: r.code,
          state: r.state,
          category: r.category,
          first: i === 0 || all[i - 1].code !== r.code,
        }));
      const max =
        basis === "%"
          ? 100
          : niceMax(
              Math.max(...recs.map((r) => Math.max(r.value, r.benchmark ?? 0))),
            );
      return { basis, lines, max, recs };
    });
  }, [records, period, ind]);

  const at = (series: string, fy: string, q: number) =>
    records.find(
      (r) =>
        r.series === series &&
        r.fy === fy &&
        (r.quarter == null || r.quarter === q),
    ) ?? null;

  // only lines with a figure for the chosen year (and quarter) are drawn; a chart left with none isn't
  const shown = charts
    .map((c) => {
      const lines = c.lines.filter((l) => at(l.series, year, quarter));
      return { ...c, lines: lines.map((l, i) => ({ ...l, first: i === 0 || lines[i - 1].code !== l.code })) };
    })
    .filter((c) => c.lines.length > 0);
  const allLines = shown.flatMap((c) => c.lines);
  const sel =
    allLines.find((l) => l.series === selected) ??
    allLines[0] ??
    null;

  if (loading)
    return <p className="detail-placeholder">Loading dashboard data…</p>;
  if (error || !master)
    return (
      <p className="detail-placeholder">
        Could not load dashboard data: {error}
      </p>
    );

  const when =
    period === "quarterly"
      ? `${fyLabel(year)} ${QUARTERS[quarter]}`
      : fyLabel(year);

  return (
    <div className="methodology-page about-page qc">
      <h1 className="method-hero-title abt-title ic-title">
        Quick Comparison Across DISCOMs
      </h1>
      <p
        className="ic-lede"
        style={{ marginTop: 10, marginBottom: 22, cursor: "auto" }}
      >
        Every DISCOM&rsquo;s figure for one reliability indicator in one year,
        set beside its state&rsquo;s standard, compared in the period each
        standard is set for, never annualised.
      </p>

      <nav className="qc-tabs" aria-label="Indicator">
        {QC_INDICATORS.map((i) => (
          <button
            key={i.family}
            type="button"
            className={`qc-tab${i.family === ind.family ? " is-on" : ""}`}
            aria-pressed={i.family === ind.family}
            onClick={() => {
              setIndKey(i.family);
              setSelected(null);
            }}
          >
            {i.label}
            {FAMILY_DEFINITIONS[i.family] && (
              <span className="qc-info" tabIndex={0} aria-label={FAMILY_DEFINITIONS[i.family]}>
                i<span className="qc-tip" role="tooltip">{FAMILY_DEFINITIONS[i.family]}</span>
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="qc-toolbar">
        <Seg label="Period">
          {(["annual", "quarterly"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`qc-seg-btn${p === period ? " is-on" : ""}`}
              aria-pressed={p === period}
              disabled={!periods.includes(p)}
              onClick={() => {
                setPeriod(p);
                setSelected(null);
              }}
            >
              {p === "annual" ? "Annual" : "Quarterly"}
            </button>
          ))}
        </Seg>
        <Seg label="Year">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              className={`qc-seg-btn${y === year ? " is-on" : ""}`}
              aria-pressed={y === year}
              onClick={() => setYear(y)}
            >
              {fyLabel(y)}
            </button>
          ))}
        </Seg>
        {/* always present so the bar never changes shape; only used for quarterly figures */}
        <Seg label="Quarter">
          {QUARTERS.map((q, i) => (
            <button
              key={q}
              type="button"
              className={`qc-seg-btn${period === "quarterly" && i === quarter ? " is-on" : ""}`}
              aria-pressed={period === "quarterly" && i === quarter}
              disabled={period !== "quarterly"}
              onClick={() => setQuarter(i)}
            >
              {q}
            </button>
          ))}
        </Seg>
        <p className="qc-legend" aria-label="Legend">
          <span className="qc-key qc-v-met">Met</span>
          <span className="qc-key qc-v-missed">Not met</span>
          <span className="qc-key qc-v-none">No verdict</span>
          <span className="qc-key qc-key--bench">Benchmark</span>
        </p>
      </div>

      <div className="qc-stage" ref={stageRef}>
        <div className="qc-card qc-chartcard">
          {shown.map((c) => (
            <section key={c.basis} className="qc-chart" aria-label={`${basisLabel(c.basis)}, ${when}`}>
              <header className="qc-chart-head">
                <h2>
                  {basisLabel(c.basis)}
                </h2>
              </header>
              <div className="qc-rows">
                {c.lines.map((l) => {
                  const r = at(l.series, year, quarter)!;
                  const on = sel?.series === l.series;
                  return (
                    <button
                      key={l.series}
                      type="button"
                      className={`qc-row${l.first ? " is-first" : ""}${on ? " is-on" : ""} qc-v-${r.verdict}`}
                      aria-pressed={on}
                      title={r.indicator}
                      onClick={() => setSelected(l.series)}
                    >
                      <span className="qc-who" title={r.name}>
                        {l.first && (
                          <>
                            <b>{l.code}</b> <small>{l.state}</small>
                          </>
                        )}
                      </span>
                      <span className="qc-cat">{l.category}</span>
                      <span className="qc-track">
                        <i className="qc-bar" style={{ width: `${(r.value / c.max) * 100}%` }} />
                        {r.benchmark != null && (
                          <i
                            className="qc-bench"
                            style={{ left: `${(r.benchmark / c.max) * 100}%` }}
                            title={`Benchmark ${formatValue(r.benchmark, c.basis)}`}
                          />
                        )}
                      </span>
                      <span className="qc-val">{formatValue(r.value, c.basis)}</span>
                    </button>
                  );
                })}
              </div>
              <div className="qc-axis" aria-hidden="true">
                <span />
                <span />
                <span className="qc-axis-scale">
                  <span>0</span>
                  <span>{formatValue(c.max / 2, c.basis)}</span>
                  <span>{formatValue(c.max, c.basis)}</span>
                </span>
                <span />
              </div>
            </section>
          ))}
          {shown.length === 0 && <p className="qc-empty">N/A</p>}
        </div>

        {sel ? (
          <Detail line={sel} rec={at(sel.series, year, quarter)} when={when} />
        ) : (
          <div className="qc-card qc-detail" />
        )}
      </div>
    </div>
  );
}

function Seg({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="qc-seg">
      <span className="qc-seg-label">{label}</span>
      <div className="qc-seg-btns" role="group" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

function Detail({
  line,
  rec,
  when,
}: {
  line: Line;
  rec: QcRecord | null;
  when: string;
}) {
  return (
    <aside className="qc-card qc-detail" aria-label="Selected record">
      <header>
        <h2 title={rec?.name}>
          {line.code}
          {line.category && <span> · {line.category}</span>}
        </h2>
        <p>
          {rec?.name} · {line.state}
        </p>
      </header>

      {rec && (
        <div className="qc-figure">
          <b>{formatValue(rec.value, rec.basis)}</b>
          <span>
            {basisLabel(rec.basis)}, {when}
          </span>
          <p>
            <span
              className={`mj-chip ${rec.verdict === "met" ? "mj-chip--met" : rec.verdict === "missed" ? "mj-chip--missed" : ""}`}
            >
              {VERDICT_TEXT[rec.verdict]}
            </span>
            {rec.benchmark != null
              ? `Benchmark ${formatValue(rec.benchmark, rec.basis)}`
              : "No benchmark"}
          </p>
        </div>
      )}

      <dl className="qc-facts">
        <dt>Standard</dt>
        <dd title={rec?.standard ?? undefined}>{rec?.standard ?? "N/A"}</dd>
        {rec && rec.timeLimits.length > 0 && (
          <>
            <dt>Time limit</dt>
            {rec.timeLimits.map((t) => (
              <dd key={t.area}>
                {t.area}: {t.text}
              </dd>
            ))}
          </>
        )}
      </dl>

      <Link className="qc-link" href={`/state/${slugify(line.state)}`}>
        Open {line.state}
        <svg className="acm-arrow" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M4.5 2.5h5v5M9.5 2.5 3 9" />
        </svg>
      </Link>
    </aside>
  );
}

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * p >= max) ?? 10;
  return step * p;
}

import type { CardPoint, CardSeries } from "./indicatorContext";
import { displayUnitForMeaning, type DisplayUnit } from "./indicatorUnits";

/** Benchmarks the sheets word per quarter while the figures are per year, restated onto the
 * figures' annual basis with the same method signed off for the figures themselves (Oct 2026:
 * annual = 4 × the per-quarter value; hours × 60 for minutes). Keyed by the normalized text. */
const BENCHMARK_RESTATED: Record<
  string,
  { value: number; unit: string; note: string }
> = {
  "15 hours per consumer per quarter (or 30 hours per six months)": {
    value: 3600,
    unit: "minutes / consumer / year",
    note: "Benchmark restated from 15 hours per consumer per quarter (× 4 quarters × 60 minutes).",
  },
  "10 interruptions per consumer per quarter (or 20 per six months)": {
    value: 40,
    unit: "interruptions / consumer / year",
    note: "Benchmark restated from 10 interruptions per consumer per quarter (× 4 quarters).",
  },
};

const norm = (t: string) =>
  t.trim().replace(/\s+/g, " ").replace(/\.+$/, "").toLowerCase();

/** a benchmark the sheet gives as a bare number (SoP sheets always; reliability sheets sometimes) */
function numericBenchmark(p: CardPoint): number | null {
  if (p.benchmark == null) return null;
  if (
    p.benchmarkRaw != null &&
    Number.isNaN(Number(String(p.benchmarkRaw).trim()))
  )
    return null;
  return p.benchmark;
}

export interface BenchmarkLine {
  /** one value per year (null where there's no benchmark to draw) */
  values: (number | null)[];
  note: string | null;
}

/** The benchmark to draw as the chart's dotted line, one value per year. Benchmarks are set by the
 * state's regulation, so they're the same for every DISCOM — each year takes the value its DISCOM
 * sheets give. A number is drawn only where it's on the plotted figures' scale: the source itself
 * marked it comparable for some figure in that unit ("Comparison possible? = Yes"), or it's one of
 * the restated text benchmarks above. Never a guess at a benchmark's unit. */
export function benchmarkLine(
  series: CardSeries[],
  yearsAsc: string[],
  unit: DisplayUnit | null,
): BenchmarkLine {
  const unitLabel = unit?.label ?? null;
  const onScale = new Set<number>();
  for (const s of series)
    for (const p of s.points) {
      const b = numericBenchmark(p);
      if (
        b != null &&
        p.value != null &&
        p.comparisonPossible === true &&
        (displayUnitForMeaning(p.reportedMeaning)?.label ?? null) === unitLabel
      )
        onScale.add(b);
    }

  let note: string | null = null;
  const values = yearsAsc.map((year) => {
    const counts = new Map<number, number>();
    for (const s of series) {
      const p = s.points.find((x) => x.year === year);
      if (!p) continue;
      let v: number | null = null;
      const restated = p.benchmarkRaw
        ? BENCHMARK_RESTATED[norm(String(p.benchmarkRaw))]
        : undefined;
      if (restated && restated.unit === unitLabel) {
        v = restated.value;
        note = restated.note;
      } else {
        const b = numericBenchmark(p);
        if (b != null && onScale.has(b)) v = b;
      }
      if (v != null) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    let best: number | null = null;
    let n = 0;
    for (const [v, c] of counts) if (c > n) [best, n] = [v, c];
    return best;
  });
  return { values, note };
}

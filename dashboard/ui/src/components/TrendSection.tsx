'use client';

import { useState } from 'react';
import { Line } from 'react-chartjs-2';
import { hexToRgba } from '@/lib/colors';
import { fyLabel } from '@/lib/format';
import { cssVar, useThemeTick } from '@/lib/chartTheme';
import type { CardSeries, IndicatorContext } from '@/lib/indicatorContext';

interface Props {
  title: string;
  unitSuffix: (v: number) => string;
  yAxisLabel?: string;
  yearsAsc: string[];
  series: CardSeries[];
  ctx: IndicatorContext;
  /** a year hovered in the values strip below — enlarges that year's points and draws a guide */
  hoverYear: string | null;
  /** the Year filter's single year, when one is picked (null = all years) */
  focusYear: string | null;
  children?: React.ReactNode;
}

const BENCH_COLOR = '#b1441c';

/** The page's centrepiece: the reported-value line chart, one line per DISCOM in its fixed
 * categorical colour, with the same benchmark reference line(s) as before (only ever drawn from a
 * benchmark the source marked comparable — see perSeriesComparableBenchmarks). The legend is HTML
 * above the chart; clicking a DISCOM hides/shows its line, as Chart.js's own legend did. */
export default function TrendSection({ title, unitSuffix, yAxisLabel, yearsAsc, series, ctx, hoverYear, focusYear, children }: Props) {
  useThemeTick();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const gridColor = cssVar('--chart-grid', 'rgba(18,23,42,0.05)');
  const axisTitleColor = cssVar('--chart-axis-title', '#666662');
  const tooltipBg = cssVar('--chart-tooltip-bg', '#1c2127');
  const pointBorder = cssVar('--panel', '#fafaf8');
  const accent = cssVar('--accent', '#28546f');
  const { bench, benchDiverges, perSeriesBench, sharedRegulator, hasNumeric } = ctx;

  const toggle = (label: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const datasets = series.map((s) => ({
    label: s.label,
    data: s.points.map((p) => p.value),
    hidden: hidden.has(s.label),
    borderColor: s.color,
    borderWidth: 2.25,
    fill: series.length === 1,
    spanGaps: false,
    tension: 0,
    backgroundColor: hexToRgba(s.color, 0.07),
    pointRadius: s.points.map((p) => (hoverYear && p.year === hoverYear ? 6.5 : 3.5)),
    pointHoverRadius: 6.5,
    pointBackgroundColor: s.color,
    pointBorderColor: pointBorder,
    pointBorderWidth: 2,
  }));

  const benchLines = benchDiverges
    ? perSeriesBench
        .filter((b) => b.value != null && !hidden.has(b.label))
        .map((b) => ({ key: b.label, value: b.value as number, color: b.color, text: `${b.regulator ? `${b.regulator} — ` : ''}${b.label}: ${unitSuffix(b.value as number)}` }))
    : bench != null
      ? [{ key: 'standard', value: bench, color: BENCH_COLOR, text: `${sharedRegulator ? `${sharedRegulator} benchmark` : 'Benchmark'}: ${unitSuffix(bench)}` }]
      : [];

  const guideYear = hoverYear ?? focusYear;
  const range = yearsAsc.length > 1 ? `${fyLabel(yearsAsc[0])}–${fyLabel(yearsAsc[yearsAsc.length - 1])}` : yearsAsc.length ? fyLabel(yearsAsc[0]) : '';

  return (
    <section className="so-trend" aria-label={`${title} — performance over time`}>
      <div className="so-trend-head">
        <div>
          <h3>Performance over time</h3>
          <p className="so-trend-sub">
            Reported {title}
            {series.length > 1 ? ' by DISCOM' : ` · ${series[0]?.label ?? ''}`}, {range}
            {yAxisLabel ? ` · ${yAxisLabel}` : ''}
          </p>
        </div>
        {hasNumeric && (series.length > 1 || benchLines.length > 0) && (
          <ul className="so-legend" aria-label="Chart legend">
            {series.length > 1 &&
              series.map((s) => (
                <li key={s.label}>
                  <button type="button" className={`so-legend-item${hidden.has(s.label) ? ' off' : ''}`} aria-pressed={!hidden.has(s.label)} onClick={() => toggle(s.label)} title={hidden.has(s.label) ? `Show ${s.label}` : `Hide ${s.label}`}>
                    <span className="so-legend-swatch" style={{ background: s.color }} aria-hidden="true" />
                    {s.label}
                  </button>
                </li>
              ))}
            {benchLines.length > 0 && !benchDiverges && (
              <li>
                <span className="so-legend-item so-legend-item--static">
                  <span className="so-legend-swatch so-legend-swatch--dash" style={{ borderColor: BENCH_COLOR }} aria-hidden="true" />
                  {sharedRegulator ? `${sharedRegulator} benchmark` : 'Benchmark'}
                </span>
              </li>
            )}
          </ul>
        )}
      </div>

      {hasNumeric ? (
        <div className="so-trend-chart">
          <Line
            data={{ labels: yearsAsc.map((y) => fyLabel(y)), datasets }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: { duration: 700, easing: 'easeOutQuart' },
              interaction: { mode: 'index', intersect: false, axis: 'x' },
              layout: { padding: { top: 6, right: 8 } },
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: tooltipBg,
                  padding: 10,
                  cornerRadius: 8,
                  boxPadding: 4,
                  usePointStyle: true,
                  displayColors: true,
                  callbacks: { label: (c) => c.dataset.label + ': ' + (c.raw == null ? 'no data' : unitSuffix(c.raw as number)) },
                },
                annotation: {
                  annotations: {
                    ...Object.fromEntries(
                      benchLines.map((b, i) => [
                        `standard-${i}`,
                        {
                          type: 'line' as const,
                          yMin: b.value,
                          yMax: b.value,
                          borderColor: b.color,
                          borderWidth: 1.5,
                          borderDash: [6, 4],
                          label: {
                            display: true,
                            content: b.text,
                            position: 'start' as const,
                            backgroundColor: b.color,
                            color: '#fff',
                            font: { size: 10, weight: 600 },
                            padding: { x: 6, y: 3 },
                            borderRadius: 4,
                          },
                        },
                      ]),
                    ),
                    ...(guideYear
                      ? {
                          focus: {
                            type: 'line' as const,
                            xMin: fyLabel(guideYear),
                            xMax: fyLabel(guideYear),
                            borderColor: hexToRgba(accent.startsWith('#') ? accent : '#28546f', 0.4),
                            borderWidth: 1.5,
                            borderDash: [3, 3],
                          },
                        }
                      : {}),
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  border: { display: false },
                  grid: { color: gridColor },
                  ticks: { font: { size: 11 }, maxTicksLimit: 6, padding: 8 },
                  title: yAxisLabel ? { display: true, text: yAxisLabel, font: { size: 10.5, weight: 600 }, color: axisTitleColor } : undefined,
                },
                x: { border: { display: false }, grid: { display: false }, ticks: { font: { size: 11.5, weight: 600 }, padding: 6 } },
              },
            }}
          />
        </div>
      ) : (
        <p className="so-trend-empty">No reported figures are available for this indicator yet — only the regulatory standard above is on record.</p>
      )}

      {children}
    </section>
  );
}

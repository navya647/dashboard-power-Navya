'use client';

import { useState } from 'react';
import { deriveIndicatorContext } from '@/lib/indicatorContext';
import { buildInsights } from '@/lib/insights';
import type { UnifiedCard } from '@/lib/unifiedIndicators';
import IndicatorSummary from './IndicatorSummary';
import InsightSummary from './InsightSummary';
import ReportedValuesStrip from './ReportedValuesStrip';
import TrendSection from './TrendSection';

/** One selected indicator's full story on the state overview: indicator context → trend chart
 * (the hero) with its year-wise values beneath → "What this shows". The regulatory context is
 * derived once here and shared by every part, and the hovered year is shared between the values
 * strip and the chart's guide line. */
export default function IndicatorAnalysis({ card, yearsAsc, focusYear }: { card: UnifiedCard; yearsAsc: string[]; focusYear: string | null }) {
  const [hoverYear, setHoverYear] = useState<string | null>(null);
  const ctx = deriveIndicatorContext(card.series);
  const insights = buildInsights(card.series, ctx, yearsAsc, card.unitSuffix);

  return (
    <article className="so-indicator animate-in">
      <IndicatorSummary
        title={card.indicator}
        category={card.category}
        type={card.type}
        meaning={card.meaning}
        unitSuffix={card.unitSuffix}
        yAxisLabel={card.yAxisLabel}
        series={card.series}
        ctx={ctx}
      />
      <TrendSection title={card.indicator} unitSuffix={card.unitSuffix} yAxisLabel={card.yAxisLabel} yearsAsc={yearsAsc} series={card.series} ctx={ctx} hoverYear={hoverYear} focusYear={focusYear}>
        {ctx.hasNumeric && <ReportedValuesStrip series={card.series} yearsAsc={yearsAsc} unitSuffix={card.unitSuffix} hoverYear={hoverYear} focusYear={focusYear} onHoverYear={setHoverYear} />}
      </TrendSection>
      <InsightSummary items={insights} />
    </article>
  );
}

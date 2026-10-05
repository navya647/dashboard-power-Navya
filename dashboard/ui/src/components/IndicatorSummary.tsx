import { formatGroupedLabel, groupByText, type CardSeries, type IndicatorContext } from '@/lib/indicatorContext';
import RegulatoryContext from './RegulatoryContext';
import StandardText from './StandardText';

interface Props {
  title: string;
  category: string;
  type: string;
  meaning: string | null;
  unitSuffix: (v: number) => string;
  yAxisLabel?: string;
  series: CardSeries[];
  ctx: IndicatorContext;
}

type Tone = 'comparable' | 'not-comparable' | 'unavailable' | 'varies';

function StatusIcon({ tone }: { tone: Tone }) {
  return (
    <span className={`so-status-icon so-status-icon--${tone}`} aria-hidden="true">
      {tone === 'comparable' ? '✓' : tone === 'not-comparable' ? '!' : 'i'}
    </span>
  );
}

/** The indicator overview: name, category pill and plain-language definition, then the
 * regulatory standard beside the reported measure, the comparability status as one compact
 * callout, and the source regulation behind a disclosure. Every value and every status message is
 * the same one the previous "Regulatory Standards & Compliance" card showed — derived once in
 * lib/indicatorContext — only the layout differs. */
export default function IndicatorSummary({ title, category, type, meaning, unitSuffix, yAxisLabel, series, ctx }: Props) {
  const { perSeriesBench, benchDiverges, rawBenchmark, benchmarkMeaning, standardShared, standardDiverges, perSeriesStandard, reportedMeaning, sharedVerdict, sharedAdvisory, seriesVerdicts, perSeriesAdvisories } = ctx;

  return (
    <section className="so-summary" aria-label={`${title} overview`}>
      <div className="so-summary-identity">
        <div className="so-summary-title">
          <h2>{title}</h2>
          <span className="so-pill">{category}</span>
          {type && type !== category && type !== title && <span className="so-pill so-pill--quiet">{type}</span>}
        </div>
        {meaning && <p className="so-summary-meaning">{meaning}</p>}
      </div>

      <div className="so-context">
        <div className="so-context-col">
          <span className="so-label">Regulatory standard</span>
          {benchDiverges ? (
            <div className="so-standard-list">
              {perSeriesBench
                .filter((b) => b.value != null)
                .map((b) => (
                  <div key={b.label} className="so-standard-item">
                    <span className="so-standard-item-label">{b.label}</span>
                    <span className="so-standard-value so-standard-value--sm">{unitSuffix(b.value as number)}</span>
                  </div>
                ))}
            </div>
          ) : rawBenchmark != null ? (
            <>
              <span className="so-standard-value">{unitSuffix(rawBenchmark)}</span>
              {benchmarkMeaning && <span className="so-sub">{benchmarkMeaning}</span>}
              {standardShared && standardShared !== benchmarkMeaning && <StandardText text={standardShared} size="sm" />}
            </>
          ) : standardDiverges ? (
            <div className="so-standard-list">
              {groupByText(perSeriesStandard).map((g) => (
                <StandardText key={g.text} text={g.text} groupLabel={formatGroupedLabel(g.labels)} size="sm" />
              ))}
            </div>
          ) : standardShared ? (
            <StandardText text={standardShared} />
          ) : (
            <span className="so-empty">No regulatory standard specified for this indicator.</span>
          )}
        </div>

        <div className="so-context-col">
          <span className="so-label">Reported measure</span>
          {reportedMeaning ? (
            <>
              <span className="so-measure">{reportedMeaning}</span>
              {yAxisLabel && <span className="so-sub">Unit: {yAxisLabel}</span>}
            </>
          ) : (
            <span className="so-empty">No reporting definition specified.</span>
          )}
        </div>

        <div className="so-context-status">
          {sharedVerdict === 'comparable' && (
            <div className="so-status so-status--comparable">
              <StatusIcon tone="comparable" />
              <div>
                <div className="so-status-head">Comparable</div>
                <div className="so-status-text">The reported figures for every year shown can be assessed directly against the regulatory standard.</div>
              </div>
            </div>
          )}

          {sharedVerdict === 'not-comparable' && (
            <div className="so-status so-status--not-comparable">
              <StatusIcon tone="not-comparable" />
              <div>
                <div className="so-status-head">
                  {sharedAdvisory && sharedAdvisory.head !== 'Not comparable across all years shown' ? sharedAdvisory.head : 'Direct comparison unavailable'}
                </div>
                {sharedAdvisory ? (
                  sharedAdvisory.constantReason ? (
                    <div className="so-status-text">{sharedAdvisory.constantReason}</div>
                  ) : (
                    sharedAdvisory.distinctReasons.map((r) => (
                      <div key={r.reason} className="so-status-text">
                        <b>{r.years}: </b>
                        {r.reason}
                      </div>
                    ))
                  )
                ) : (
                  // every series agrees on the coarse verdict but disagrees on which years/why —
                  // the per-DISCOM detail below says it precisely instead of one shared reason
                  <div className="so-status-text">Details differ by DISCOM — see below.</div>
                )}
              </div>
            </div>
          )}

          {sharedVerdict === 'unavailable' && (
            <div className="so-status so-status--unavailable">
              <StatusIcon tone="unavailable" />
              <div>
                <div className="so-status-head">Assessment unavailable</div>
                <div className="so-status-text">The source data does not record whether the reported figures can be compared against the regulatory standard.</div>
              </div>
            </div>
          )}

          {sharedVerdict == null && series.length > 1 && (
            <div className="so-status so-status--varies">
              <StatusIcon tone="varies" />
              <div>
                <div className="so-status-head">Comparability varies by DISCOM</div>
                {groupByText(series.map((s, i) => ({ label: s.label, value: seriesVerdicts[i] as string }))).map((g) => (
                  <div key={g.text} className="so-status-text">
                    <b>{formatGroupedLabel(g.labels)}: </b>
                    {g.text === 'comparable' ? 'Comparable' : g.text === 'not-comparable' ? 'Not directly comparable — see below' : 'Assessment unavailable'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* only when the comparability situation genuinely diverges between DISCOMs — when it's
              identical everywhere, the shared status above already said it once */}
          {perSeriesAdvisories.length > 0 && (
            <ul className="so-advisories">
              {perSeriesAdvisories.map(({ label, message }) => (
                <li key={label}>
                  <span className="so-advisory-head">
                    {series.length > 1 && <b>{label} · </b>}
                    {message.head}
                  </span>
                  {message.constantReason ? (
                    <span className="so-advisory-text">{message.constantReason}</span>
                  ) : (
                    message.distinctReasons.map((r) => (
                      <span key={r.reason} className="so-advisory-text">
                        <b>{r.years}: </b>
                        {r.reason}
                      </span>
                    ))
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <RegulatoryContext ctx={ctx} series={series} />
      </div>
    </section>
  );
}

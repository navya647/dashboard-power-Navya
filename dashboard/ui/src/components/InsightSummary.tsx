/** "What this shows" — a short list of plain, factual observations generated deterministically
 * from the data on screen (see lib/insights.ts). No scoring, ranking or interpretation. */
export default function InsightSummary({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="so-insights" aria-label="What this shows">
      <h3>What this shows</h3>
      <ul>
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p className="so-insights-note">Generated automatically from the reported figures above; it restates the data and does not assess performance.</p>
    </section>
  );
}

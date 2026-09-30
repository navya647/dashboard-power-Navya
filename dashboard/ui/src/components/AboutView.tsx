/** Placeholder for now — a nav destination was requested ahead of the actual write-up. Reuses the
 * Methodology page's opening-section typography (.methodology-page/.kicker/.method-hero-title/
 * .method-context) rather than introducing new classes for a page that's just a heading so far. */
export default function AboutView() {
  return (
    <div className="methodology-page">
      <div className="kicker" style={{ marginTop: 0 }}>
        <span className="bar" />
        <span className="label">About</span>
      </div>
      <h1 className="method-hero-title">About This Dashboard</h1>
      <p className="method-context">Content for this page is coming soon.</p>
    </div>
  );
}

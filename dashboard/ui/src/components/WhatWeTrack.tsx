import { SOP_CATEGORY_ORDER } from '@/lib/sopCategories';

/** The dashboard's fixed navigation taxonomy — the same 9 categories the Standards-of-Performance
 * filters use (see `lib/sopCategories.ts`), shown here once as the page's own explanation of "what
 * we track." These are a display-bucketing convenience, not a rewrite of the underlying evidence:
 * original indicator names, types, definitions and regulatory wording all stay exactly as
 * extracted from source — only their category assignment for navigation purposes lives here. */
export default function WhatWeTrack() {
  return (
    <div>
      <div className="indicator-chip-row">
        {SOP_CATEGORY_ORDER.map((c) => (
          <span className="indicator-chip" key={c}>
            {c}
          </span>
        ))}
      </div>
      <p className="section-note" style={{ maxWidth: 640, marginTop: 10 }}>
        These categories support dashboard navigation. Original indicator names, types, definitions and regulatory wording are preserved from the
        source evidence.
      </p>
    </div>
  );
}

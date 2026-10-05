# ACPET DISCOM Performance Dashboard

Next.js (App Router, static export) dashboard of Indian electricity distribution
licensees' (DISCOMs') regulatory performance, built from data extracted out of Excel
workbooks. Root repo has the extraction pipeline; the app lives in `dashboard/ui`.

Ignore `dashboard/PROJECT_EXPLANATION.md` and `dashboard/_archive_old_ui/` — they
describe a deleted single-file HTML prototype (`extraction3.py` → `dash.json`), not
this app.

## Pipeline: Excel → JSON → React

Each dataset is `data/<workbook>.xlsx` → `extraction_*.py` (repo root, run manually,
`cd dashboard && python3 extraction_*.py`) → `dashboard/ui/public/data/*.json` →
fetched client-side in `lib/DataContext.tsx` → consumed via `useData()`.

Three datasets, all keyed by the same 12-state `state_order`:

| Dataset | Workbook | Script | Output | Consumed by |
|---|---|---|---|---|
| Reliability / power quality | `Common Indicators.xlsx` | `extraction_common.py` | `discoms2.json` | `StateDetail.tsx`, `CompareView.tsx`, `HeroMap.tsx` |
| Regulatory transparency | `ACCESSIBILITY.xlsx` + `hyperlinks.xlsx` (per-document / per-FY links) | `extraction_accessibility.py` | `accessibility.json` | `AccessibilityView.tsx` |
| Standards of Performance (consumer service) | `State specific Indicators.xlsx` | `extraction_state_specific.py` | `state_specific.json` | `SopSection.tsx` (rendered inside `StateDetail.tsx`) |

The reliability dataset normalizes ~20 raw indicator names into 8 canonical ones
(`canonical_order`/`canonical_indicators`) with a computed composite score per
DISCOM/year (`scoring` block) — that scoring formula is **pre-existing and
user-approved**, don't extend its pattern to new datasets without asking first (see
Working preferences below).

The SoP dataset (`state_specific.json`) deliberately does **not** normalize indicators
or compute any score — the raw indicator names are too varied. Each DISCOM/year just
keeps its indicator list exactly as reported (`indicator`, `standard_specified`,
`benchmark`, `reported`, `comparison_possible`, `standard_met`). 5 of the 12 states
(Uttar Pradesh, Tamil Nadu, Karnataka, Andhra Pradesh, West Bengal) have no per-DISCOM
sheet at all in the source workbook — only a `frameworks` entry (state's SoP
regulation listed, no reported figures). Bihar has per-DISCOM SoP sheets but happens
to have zero reported figures in any of them.

## Working preferences

- **Never invent a scoring formula, composite metric, or other derived calculation.**
  Show raw data and get explicit sign-off on the exact methodology first, even if a
  superficially similar precedent exists elsewhere in the codebase (this happened
  once: copied the reliability dataset's composite-score weights into the new SoP
  section without asking — don't repeat that).
- **Cross-check any Excel extraction field-by-field against the source workbook**
  before considering it done — row-count matching alone is not enough. Two real bugs
  (`extraction_state_specific.py`) were only caught this way: `MPWZ,MADHYA PRADESH` is
  the one sheet that names its benchmark-meaning column explicitly instead of leaving
  it blank (broke the positional-inference heuristic), and regulation-citation rows
  can spread multiple citations across columns, not just column 0. Re-parse
  independently (fresh code, not copied from the extractor) and diff every field.
- Missing/absent values render as literal `"N/A"` text in the UI, not `"—"` or
  `"Not specified"` — except where the source data itself literally contains a string
  like `"Not specified"` (that's real reported content, leave it alone).
- Financial years display as `FY24` (last 2 digits of the end year), never
  `FY 2023-24` — see `fyLabel()` in `lib/format.ts`. Internal lookups against JSON
  year-keys still use the raw `"2023-24"` string form; only display text uses the
  shorthand.
- Any place that gates map clickability / navigation / "does this state have
  anything to show" must check **all three datasets**, not just the reliability one —
  `stateMapStatus`/`stateIsTracked`/`stateHasReportedData`/`stateHasSopData` in
  `lib/computations.ts` already do this correctly; when adding a 4th dataset, extend
  these rather than adding a parallel check elsewhere. The map's 3-way status:
  `'idle'` (in neither dataset, not clickable, "Coming soon"), `'no-data'` (in scope,
  no reported *figures* anywhere yet, but still clickable — e.g. a SoP framework
  listing), `'tracked'` (has an actual reported figure, clickable).
- The State page's Indicator dropdown offers an indicator only if the state sets a standard for
  it (in words — `standard_specified`; a benchmark alone doesn't count) **or** it has reported
  figures: `withStandardOrFigures()` in `lib/unifiedIndicators.ts`, judged per state (all DISCOMs
  at once). Empty, "N/A" and the sheets' "Not specified…" wording count as no standard
  (`statesStandard()`). Figures-but-no-standard indicators are kept, and their `IndicatorModule`
  box is tinted (`im--no-standard`, accent tint) with a "No standard specified" tag on the label
  row. Applies to the State page only, not Compare.
- Do not start the dev server (`npm run dev`) on your own initiative to verify
  changes. Only run it when the user explicitly asks you to run/test the app (`cd
  dashboard/ui && npm run dev -- -p 3001` if port 3000 is occupied by something else).
  Prefer `npx tsc --noEmit` and reading the diff otherwise.
- When testing live in the browser (only when asked to), skip the onboarding tour via
  `sessionStorage.setItem('acpet-tour-completed', '1')` before navigating, or it blocks
  clicks with a scrim. It's sessionStorage (not localStorage) deliberately — the tour shows
  once per tab and comes back after the tab is closed and reopened, not just once ever.
- Routes use slug params (`/state/madhya-pradesh`, via `slugify()` in `lib/slug.ts`),
  not raw state names — `next dev` + `output: export` needs the exact param match.
- Never push commits to git (e.g. `git push`) unless explicitly asked to do so in that
  moment. Creating local commits when requested is fine; pushing them requires a
  separate, explicit instruction each time.

## Shared UI patterns

- `Collapsible.tsx` — the accordion row used for every per-DISCOM detail drill-down
  (both the reliability report and the SoP section). Slides open/closed via a
  CSS-grid `grid-template-rows` transition (not native `<details>`, which can't
  animate height) plus a translateY+opacity fade on the inner content, with a chevron
  that flips 180°. Supports an optional controlled `open`/`onOpenChange` pair (e.g. so
  a scorecard click can force a specific row open) — omit both for a normal
  self-contained row. When opened, it scroll-animates the page to reveal itself
  (custom `requestAnimationFrame` easing, not `scrollIntoView({behavior:'smooth'})`,
  which hands off timing to the browser and reads as an abrupt snap) — but only
  *after* its own open transition's `transitionend` fires, since scrolling any
  earlier targets a page that hasn't grown tall enough yet and silently clamps short.
- `ScoreCard.tsx` — clickable button (not a static div); in `StateDetail.tsx` its
  `onClick` opens (adds to a `Set`, doesn't force-close others) that DISCOM's own
  `Collapsible` row further down the same section, and the row's own scroll-into-view
  takes it from there.
- `IndicatorModule.tsx` — the state page's analysis area: one self-contained module per
  selected indicator (header grid: bucket · category label with a download button on the same
  row, top right — a placeholder; hover/focus shows "This feature is coming soon", nothing
  downloads yet — then name + definition button + unit, with DISCOM toggle keys (line colour + name
  only; the "Latest · FY" figures were removed at the user's request). No "lower/higher is better" on the
  card — interpretation lives only in the definition pop-up, at the user's request. Body: a ~340px
  side column with the standard/benchmark in force and the source documents, beside the trend
  chart — value labels, points filled Met/Missed/No benchmark from the source's own verdict and
  hollow when there is none, the benchmark as a neutral dotted stepped line (its own
  `--chart-benchmark` token per theme), y-axis from zero for non-negative data,
  and a one-line legend listing only the verdicts present). Redesigned 5 Oct 2026 at the user's request. Standards/benchmarks are state-level, never
  per DISCOM. Where the workbooks' own text dates a regulation change (`lib/regulationTimeline.ts`
  — Gujarat 6 Dec 2023, Maharashtra 5 Jul 2024, Rajasthan in force 15 Apr 2021), the panel has
  one column per regulation with its dates and the x-axis marks the split year with a footnote;
  otherwise one column per distinct standard as recorded, labelled by years. The benchmark line
  (`lib/benchmarkLine.ts`) draws only numbers the source marked comparable for figures in the
  plotted unit, plus explicitly restated text benchmarks (Rajasthan SAIDI/SAIFI per quarter → per
  year, the user-approved ×4 method). Source documents are presented exactly as on the Accessibility page's state card — the
  shared `SourceDocuments.tsx` (`ReportedDataTable`: per-DISCOM year links from `data_links`,
  merged into one cell when every DISCOM shares them; `RegulationDocs`: `regulation_documents`
  titled via `lib/regulationTitles`), styled by the acm-* rules — change both together. Clicking the name opens
  `IndicatorDefinition.tsx`, a pop-up with only: definition with the reporting period stripped,
  bucket, category, interpretation. Display units come from `lib/indicatorUnits.ts`, an
  explicit table keyed on each record's `reported_meaning` text (same pattern as
  `lib/indicatorDirection.ts`) — add any new wording there rather than truncating text. One
  chart per module: when units differ it plots the unit most figures use and leaves the rest
  off the chart (noted in one line; the state and compare pages no longer have a Data Table) — never converted,
  never one axis. Per-point detail (status, movement vs previous year from `lib/yearMovement.ts`,
  standardisation `note`) lives in the chart tooltip — one figure per tooltip (custom
  `imNearestFigure` hover mode: the nearest reported point, never several DISCOMs at once, never
  the benchmark line): "DISCOM · FY", the figure, "status · movement" on one line, the note as
  wrapped small print. Regulation citations are sheet-level (the
  extractors attach a sheet's header citations to its first year block only).
- `GlanceView.tsx` (`/glance`, sidebar "At a glance", page title "Quick Comparison Across DISCOMs",
  data from `lib/glance.ts`) — one reliability indicator × one year, every DISCOM's figure. The chart
  is ONE CSS grid (state | DISCOM | figure | plot, rows via `gridTemplateRows`), so the axis,
  gridlines, bars and each state's benchmark line share the plot column and align by construction —
  don't reintroduce floating value labels or calc()-offset overlays. A state's DISCOMs form one block
  (state written once, spacer row between states); its benchmark is one line through the block
  (value from `benchmarkLine`, shown on hover only). Figures share a chart only when they share
  display unit **and** direction (Transformer Failure splits into % of cases / % failure rate / % of
  DTRs); when there's more than one, only one chart shows at a time, picked from a "Reported as"
  switcher (most-used first, with DISCOM counts). Chart heading = the short display unit; the
  source's full wording is on hover only (the user found it too long on screen); no per-DISCOM
  "Reported as…" line in the card (removed at the user's request). Bar colour only from `standard_met`. Legend (Met /
  Not met / No verdict / Benchmark) is one quiet line under the chart, not in the header. No ranking
  score — just sorted by value. Desktop: no page scroll — `useNoScrollbar` plus rows sized to the
  window (`useFitRowHeight`, 20–28px). The DISCOM card sits beside the chart.
- One-screen pages (About, Accessibility) size themselves to the window on desktop (measure, then
  trim whatever  still overflows) and never draw a scrollbar —
   hides the window's bar, inner panels use .
- Each DISCOM gets a fixed-order categorical hue from `CATEGORICAL` in `lib/colors.ts`
  (`cols[i]` pattern, sliced to however many DISCOMs a state has) — reused consistently
  across scorecard border, chart line, and `Collapsible`'s badge color for that DISCOM.

## Commands

- Type-check: `cd dashboard/ui && npx tsc --noEmit`
- Re-run one extraction: `cd dashboard && python3 extraction_<name>.py` (needs
  `openpyxl`; `pip3 install --break-system-packages openpyxl` if missing). Run
  `extraction_common.py` first — the other two take each DISCOM's canonical full name from its
  `data/discoms2.json` — then copy `data/discoms2.json` to `ui/public/data/` (no sync step).
- Dev server: `cd dashboard/ui && npm run dev` (only when explicitly asked)

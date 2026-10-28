# ACPET DISCOM Performance Dashboard

Next.js (App Router, static export) dashboard of Indian electricity distribution
licensees' (DISCOMs') regulatory performance, built from data extracted out of Excel
workbooks. Root repo has the extraction pipeline; the app lives in `dashboard/ui`.

Ignore `dashboard/PROJECT_EXPLANATION.md` and `dashboard/_archive_old_ui/` — they
describe a deleted single-file HTML prototype (`extraction3.py` → `dash.json`), not
this app.

## Pipeline: Excel → JSON → React

**Since 27 Oct 2026 the site's performance data comes from one workbook,
`DISCOM_SoP_master.xlsx`** (repo root; one sheet, one row per DISCOM × FY × indicator,
27 columns, 13 states incl. Assam and Telangana). It replaces `discoms2.json` and
`state_specific.json` in the UI. `accessibility.json` is unchanged and still feeds the
Accessibility page.

- `cd dashboard && python extraction_master.py` → `ui/public/data/sop_master.json`
  (`MasterData` in `lib/types.ts`). Every cell is written **as Excel displays it** (number
  formats applied: 0.9981 formatted `0.00%` → `"99.81%"`). Text is untouched (the literal
  `"None"`/`"N/A"` strings are kept), blank → `null`. The only added field is
  `standardised_num`: `standardised_data` as a number, present only when that cell is
  itself a number or a bare number/percentage. It's for plotting only; numbers are never
  pulled out of sentences.
- `python verify_master.py` independently re-reads the workbook and diffs all 27 columns
  of every row. It must exit 0 after every extraction.
- **Show the sheet exactly as written: no imputation, no reinterpretation, no
  reconciling** (user, 27 Oct 2026). Standards can differ between DISCOMs of one state and
  year, and the sheet's per-DISCOM standard is shown as is. One indicator family can sit
  under two categories, and each row keeps its own `category`. 138 DISCOM × FY × indicator
  keys have two rows (a regulation change mid-year). Both rows are shown.
- UI: `lib/master.ts` (lookups only) and `lib/computations.ts` (map gating: a state is
  `'tracked'` when a row has `standardised_num` or a Yes/No `standard_met`, `'no-data'`
  when it has rows but none of those, `'idle'` with no rows). The State page (`StateDetail.tsx`)
  shows one `MasterIndicator.tsx` per selected indicator, **with no tables anywhere** (user,
  27 Oct 2026). The trend chart (where `lib/plotFigures.ts` finds figures) sits directly on the
  DISCOM tracks. Each DISCOM is a line with one stop per FY (two stops where a year is split),
  filled by `standard_met`, with its figure underneath. The chart's y-axis is fixed at the
  tracks' name-column width so years line up. Beside them, the evidence trail shows the
  selected row as a chain (Regulation → Standard → Reported data → Standardised data → Standard
  met), with every column of the row on one step, verbatim. Clicking a stop or a chart point
  selects the row.
- **Quarterly-assessed standards show quarters only, never a yearly verdict** (user, 27 Oct
  2026). A row is quarterly when any of `standard_met_q1–q4` is filled (`quarterVerdicts()` in
  `lib/master.ts`). For those rows, the track stop is four quarter marks (green / red / grey =
  not reported), the chart point is hollow with Q1–Q4 in its tooltip, and the verdict step
  lists Q1–Q4. The row's `standard_met` and the "(FY: …)" in `standard_met_detail` aren't shown. The dropdown groups by the sheet's
  `category`. Glossary reads the master rows.
- **Numbers may be read out of sentences for charts** (user, 28 Oct 2026: "you need to pull numbers out of the
  sentences - otherwise what's the point of the dashboard"). `lib/headlineFigure.ts` returns the one written headline
  figure + unit of a row (from `standardised_data`, else `reported_data`), or null when the unit/basis is unclear or the
  year isn't annualised. Never converts or sums; the sentence stays on hover. Used everywhere since 28 Oct 2026:
  `plotFigure` (State page trend + track figures, default indicator) falls back to it for every state (the old
  Rajasthan-only `PARSE_STATES` trial is gone), and `rowHasReportedFigure` (map 'tracked' status) counts it. The State
  page chart plots one unit only, the one most of the indicator's figures use; y-axis starts at 0.
- Quick comparison (`/glance`): the ORIGINAL design is kept (`GlanceView.tsx` + `styles/glance.css`, restored from git
  28 Oct 2026 at the user's request: one CSS grid, state blocks, benchmark line per block, verdict colours, DISCOM card).
  Only the data layer changed: `lib/glance.ts` builds the groups from the master sheet for `GLANCE_FAMILIES` (SAIDI,
  SAIFI, DT failure, line breakdown, DT fuse, reconnection) via `plotFigure` / `plotBenchmark`; a state block splits
  where its rows' benchmarks differ (state name written once); several rows of one DISCOM get one bar each.
  **Never annualise** (user, 28 Oct 2026): figures are compared in the period their standard is set for. Rows the sheet
  assesses by quarter, or held to a per-quarter limit, go in a separate "… per quarter" chart with a Q1–Q4 picker:
  the quarter's figure from `reported_data` (`quarterFigures`), that quarter's verdict, the per-quarter limit
  (`standardLimit`). `plotBenchmark` (also the State page) draws only per-year limits or % shares. **No benchmark on
  the chart → verdict shown as N/A, never "Not met"** (user, 28 Oct 2026).
  State page (`MasterTrend` in `MasterIndicator.tsx`): the chart is always annual (user, 28 Oct 2026: "the graph
  should be annual and below that the quarterly data should be there as it is now"): each row's FY figure only, no
  Q1–Q4 slots; a quarter-assessed row's point stays hollow (no yearly verdict) while its track stop keeps the four
  quarter marks; points are filled only where a benchmark is drawn. The header
  also shows the family's signed-off plain definition ("In short", `lib/familyDefinitions.ts`).
- Compare (`/compare?states=`, `CompareView.tsx`) is back since 28 Oct 2026 at the user's request, read from the
  master sheet: the map's View/Compare switch picks states; the page has one DISCOM picker per state and an indicator
  picker over the `indicator_family` values every selected state has (states word indicators differently); each pick is
  one `MasterIndicator` over all selected states' rows, DISCOMs coloured from one `CATEGORICAL` run.
  Compare is annual only (user, 28 Oct 2026: "lose granularity and use annual data where defensibly possible"): rows
  with a year figure (`plotFigure`) only, `annualOnly` (no Q1–Q4 slots) and `hideTimes` (no merged time-limit list) on
  `MasterIndicator`; a DISCOM-year with several rows keeps only the one worded "Overall …" / "All feeder …" /
  "… combined" when exactly one is, else all of them (`annualView` in `CompareView.tsx`).
- The Methodology page is kept exactly as it was (user, 27 Oct 2026). It loads
  `discoms2.json` and `state_specific.json` itself (`useEarlierData` in
  `MethodologyView.tsx`), so those two files must stay in `ui/public/data/`.

The sections below describe the **previous** three-dataset setup. The extraction
scripts and JSON files still exist (other extractors read `data/discoms2.json` for DISCOM
names), but the UI no longer loads `discoms2.json` or `state_specific.json`. Rules that
reference them (composite score, `withStandardOrFigures`, `IndicatorModule`, Glance) are
historical unless they're revived.

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
- About (`/about`, `AboutView.tsx`, styles in `styles/about.css`; International page in `styles/international.css`): text condensed from
  `Power_Supply_and_Service_Quality_Dashboard_About_Page.docx`, deliberately **not** reusing the Accessibility or
  Methodology pages' content (the earlier dot panel / 4-step flow / FAQ were removed at the user's request), and with no
  coverage-figure strip (user: "unnecessary stats"). Redesigned 11 Oct 2026: hero (title, lede, dimension tags) beside
  `HowToRead` — a schematic, labelled "Illustrative", of the site's own chart language (dotted standard line, filled
  Met / Not met dots, hollow dots where there is no benchmark; nothing on it is data); then the four cards as one
  hairline-divided strip (Glossary → `/about/glossary`, Quick comparison → `/glance`, International comparison →
  `/about/international`, Explore the map → `MAP_HREF`; the three card pages have no sidebar entry, Sidebar keeps About lit,
  their eyebrow is `AboutKicker`); "Why this dashboard" (five consumer questions); problem chips beside "what you can
  examine"; a six-node evidence trail; closing statement beside the 12 coverage states (read from the data, Odisha JV
  footnote). Every section = small-caps eyebrow + serif heading. International comparison (`InternationalView.tsx`, data in
  `lib/international.ts`) is transcribed from `international saidi_saifi (2).pdf` plus the user's context text (28 Oct 2026: why each comparator; India's weighted benchmark ≈6,600 min / 152 as a tick on its range; no state-by-state list) — India is a range of state
  regulatory benchmarks, the rest observed performance; drawn differently (bar vs dot), log-scale axes, never presented as
  like-for-like.
  Reached from the landing view: scroll down / ArrowDown / swipe up / the Explore button play `to-about` in `HeroSection.tsx`
  (headline lifts, photo darkens, then `router.push('/about')`; About fades up) — the landing view no longer scrolls into the map;
  the map is `MAP_HREF` (About's "Explore the map" card, sidebar Home).
- `GlanceView.tsx` (`/glance`, reached from the About page's "Quick comparison" card — no sidebar entry, page title "Quick Comparison Across DISCOMs",
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
- One-screen pages (Glossary, Accessibility) size themselves to the window on desktop (measure, then
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

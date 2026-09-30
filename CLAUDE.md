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
| Regulatory transparency | `ACCESSIBILITY.xlsx` | `extraction_accessibility.py` | `accessibility.json` | `AccessibilityView.tsx` |
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
- Each DISCOM gets a fixed-order categorical hue from `CATEGORICAL` in `lib/colors.ts`
  (`cols[i]` pattern, sliced to however many DISCOMs a state has) — reused consistently
  across scorecard border, chart line, and `Collapsible`'s badge color for that DISCOM.

## Commands

- Type-check: `cd dashboard/ui && npx tsc --noEmit`
- Re-run one extraction: `cd dashboard && python3 extraction_<name>.py` (needs
  `openpyxl`; `pip3 install --break-system-packages openpyxl` if missing)
- Dev server: `cd dashboard/ui && npm run dev` (only when explicitly asked)

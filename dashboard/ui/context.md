# 3D grid map — working context

## History

1. **Original ask**: turn the flat 2D SVG hero map into something that feels 3D on scroll,
   pylons standing upright, states still hoverable/selectable. Built as a CSS 3D transform
   (`rotateX` on the map plane + counter-rotating pylon billboards) on branch
   `feature/3d-hero-map`. Kept the existing flat SVG/d3-geo map, just tilted it in CSS.
2. **This branch (`feature/webgl-grid-3d`)**: a much more ambitious, explicit spec — a real,
   code-level 3D/isometric extruded India map (actual geometry with thickness, not a flattened
   SVG), real 3D pylon objects (steel lattice towers), real 3D transmission lines (tube geometry
   with emissive glow + animated flow particles), proper camera/lighting, all built with
   react-three-fiber. Explicitly: *"Do not use CSS transforms to fake the 3D extrusion... do not
   use a flat SVG with drop shadows as a substitute for 3D."* This supersedes the CSS-tilt
   approach entirely — `HeroMap.tsx`/`TransmissionLayer.tsx` (the old flat-SVG map + pylon icons)
   are deleted on this branch, replaced by `GridExplorer3D.tsx` and `src/components/three/*`.

## Rollback (single command per target)

Three states exist as separate branches/commits — pick whichever you want to return to:

- **Original flat 2D map** (no 3D at all): `git checkout master` — baseline commit `ab80877`.
- **CSS-tilt 3D map** (flat SVG map that tilts via `rotateX` on scroll, pylons as CSS
  counter-rotating billboards): `git checkout feature/3d-hero-map` — commit `9c86754`.
- **Real WebGL 3D map** (this branch, react-three-fiber, extruded geometry): stay on
  `feature/webgl-grid-3d`.

To abandon whatever's currently checked out and go back to the plain 2D map from *any* of these
branches: `git checkout master`.

## Decision: react-three-fiber / Three.js, not CSS

Already justified in the original ask (see History above) — the spec explicitly required actual
3D geometry (extrusion, real pylon/line objects, a real camera), which CSS transforms on flat
SVG cannot produce. Added dependencies: `three`, `@react-three/fiber`, `@react-three/drei`,
`@types/three`.

## Architecture

```
GridExplorer3D.tsx                  — <Canvas> + tooltip (drei <Html>) + screen-projection glue
 ├── three/GridCamera.tsx           — points the default camera at a fixed look-at target (no orbit)
 ├── three/GridLighting.tsx         — ambient + key (upper-left) + rim lights, no bloom/point lights
 ├── three/IndiaMap3D.tsx           — one <StateMesh> per state feature, owns hover/dim state
 │    └── three/StateMesh.tsx       — extruded solid (top cap = data color, sides = shared
 │                                     structural material) + edge outline
 ├── three/TransmissionNetwork.tsx  — resolves GRID_NODES/GRID_CONNECTIONS (src/lib/grid3d.ts)
 │    │                               against real state centroids, renders pylons + lines
 │    ├── three/TransmissionPylon.tsx — procedural steel lattice tower (real 3D geometry)
 │    └── three/TransmissionLine.tsx  — CatmullRom curve → core tube + glow tube + flow particle
lib/geo3d.ts                        — GeoJSON → per-state THREE.ExtrudeGeometry + edges + centroid
lib/grid3d.ts                       — grid node/connection DATA (state name, region, flow, status)
```

`GridExplorer3D` keeps the **exact same prop contract** the old `HeroMap` had (`discoms`,
`geojson`, `year`, `compareColorOf`, `onStateClick`, `revealedRef`, `onCentroids`) — so
`HeroSection.tsx`'s scroll rig, click-popup positioning (`handleStateClick`), and everything else
in the dashboard (compare mode, `StatePopup`, sidebar) needed **zero changes**. `onCentroids` now
reports real camera-projected screen coordinates (via a small `ScreenProjector` component using
`useThree()` + `Vector3.project()`) instead of a flat d3 projection — this is actually *more*
correct than the old flat map for popup positioning, not a regression.

### Axis mapping (geo3d.ts)

The projected map is centered at the local origin, then rotated so `+Z` (extrusion depth)
becomes world `+Y` (up). After that: **world `+Z` = north, world `+X` = west** (x is negated
during projection — see the comment in `geo3d.ts`; this was found empirically, not derived, by
color-marking Jammu & Kashmir/Kerala/Assam and checking where they actually rendered). Pylon/line
positions come from `topCentroid` on each state's `StateGeometryEntry`, resolved dynamically from
real geometry — nothing is hardcoded in screen space.

### Grid network data (grid3d.ts)

Two independent regional clusters, not a national mesh — matches the brief's "2-4 pylons north,
2-3 northeast, not randomly scattered": North = Himachal Pradesh, Haryana, Jammu & Kashmir,
Rajasthan (4 nodes); Northeast = Assam, Meghalaya, Tripura (3 nodes). `GRID_CONNECTIONS` carries
mock `flow`/`status` fields already shaped for real grid data later.

## Bugs found and fixed during verification (all caught by actually screenshotting the running
app, not by reading the code)

1. **East/West mirrored.** Initial render was recognizably India-shaped but rotated wrong —
   confirmed by temporarily forcing Jammu & Kashmir/Kerala/Assam to distinct debug colors and
   checking where they actually landed. Assam (east) was rendering left of J&K (northwest) —
   backwards. Fixed by negating X in `geo3d.ts`'s `project()` and `topCentroid` calculation.
2. **Panning via look-at target only, not a real pan.** Tried to shift the composition left (to
   clear the right-docked control panel) by moving only the camera's `lookAt` target. This
   re-aims the camera (changes viewing angle) rather than translating the view, and produced
   inconsistent, hard-to-predict shifts. Fixed by panning camera position and target together by
   the same delta (`PAN_X` in `GridExplorer3D.tsx`) — a true translation.
3. **Pylon hit-target too thin to reliably hover/click.** The invisible hit-cylinder around each
   pylon (radius ~0.09-0.13 world units) was too small at the final camera distance/FOV — testing
   hover kept landing on the state mesh underneath instead. Widened to 0.16-0.22. This matters
   for real users too, not just automated testing, at this zoom level.
4. **ESLint `react-hooks/immutability` / `react-hooks/refs`.** Mutating a `useMemo`'d Three.js
   material's properties on hover (the standard R3F pattern — mutate scene-graph objects in
   place rather than reallocate) trips the newer React-Compiler-oriented lint rules bundled with
   Next 16. Tried moving the mutation into `useEffect` (still flagged) and switching to
   lazily-initialized `useRef` (flagged by a *different* rule, "no ref access during render").
   Settled on: keep the idiomatic `useMemo` + mutate-in-`useEffect` pattern (correct for R3F) and
   suppress the specific `react-hooks/immutability` lines with a comment explaining that Three.js
   materials are an intentional mutable-imperative boundary the compiler's purity model doesn't
   apply to. This is the standard resolution for this known R3F/React-Compiler tension.

## Round 2: scroll-driven camera transition + reference-image polish

The user's actual intent turned out to be: land on something that reads as the *old flat 2D
chart*, then morph into the isometric 3D scene on scroll — not "always-3D, just docked small at
landing" (what round 1 built). They also pasted a reference render (bold chunky lattice towers,
brighter glowing lines/bases, a compass rose + legend) and said the pylons/lines "look stupid" by
comparison.

**Camera now animates between two full poses, not just a look-at target:**
`GridCamera.tsx` takes `{scrollRef, from, to}` and every frame (`useFrame`, not React state — see
below) lerps position, look-at target, and FOV between them using `scrollRef.current.p`, the same
eased scroll fraction `HeroSection`'s existing rAF loop already computes. `scrollRef` is a plain
mutable ref (`{p: number}`), NOT React state — routing a value that updates ~60x/sec through
`useState`/props would re-render the whole scene every frame for nothing; the camera reads it
imperatively instead, same as any other per-frame Three.js mutation in this codebase.

- **Landing pose** (`CAMERA_TOP_DOWN`): near-overhead, narrow-ish FOV, panned toward
  `PAN_X_LANDING` — reads as a flat 2D chart, docked toward the right of the frame exactly like
  the old flat-SVG map was (clear of the header text on the left).
- **Fully-scrolled pose** (`CAMERA_ISO`): the isometric view, panned toward `PAN_X` to clear the
  right-docked control panel.

**Visual polish pass**, chasing the reference image:
- `grid3d.ts`: added a 5th north node (Punjab) and changed the north cluster from a chain/dense
  mesh to a **closed loop** (each node has exactly 2 neighbors, zero crossing lines) — a
  triangulated mesh among 5 close-together nodes read as a tangled spiderweb, especially from the
  near-top-down landing camera; a loop reads as clearly "connected network" with no visual mess.
- `TransmissionPylon.tsx`: scaled up substantially (tower height 0.85 → 1.4, all radii ~1.6-1.7x)
  — the first pass was technically fine but read as thin dark spikes at normal viewing distance.
  Added a bright solid amber "plinth" (flattened octahedron) at the base, on top of the existing
  soft glow halo, plus a third crossarm level and more diagonal bracing for a denser lattice
  silhouette.
- `TransmissionLine.tsx`: brighter/thicker core and glow tubes, warmer amber color, bigger flow
  particle.
- Added `.grid3d-chrome` (compass rose + legend) to `HeroSection.tsx`/`hero.css`, bottom-left
  (kept off the right side entirely — the control panel already docks there), fading in with the
  existing reveal layer for free (no new scroll wiring needed).

**Composition had to be re-tuned from round 1's values** because (a) bigger pylons need more
lateral clearance from the control panel, and (b) fixing the canvas-sizing bug below changed the
effective zoom. Current values, arrived at the same way as before — scroll to the target scroll
state, screenshot, adjust:
- Landing: `CAMERA_TOP_DOWN = { position: [PAN_X_LANDING, 24, 0.05], target: [PAN_X_LANDING, 0, 0.15], fov: 32 }`, `PAN_X_LANDING = 2.6`.
- Fully-scrolled: `CAMERA_ISO = { position: [PAN_X + 2.3, 6.7, -7.5], target: [PAN_X, 0.15, 0.25], fov: 70 }`, `PAN_X = 1.9`.
- The northeast cluster still sits close to the control panel's edge at full scroll — same
  structural tension as round 1 (total angular width at a size that reads well vs. available
  clear width), just re-balanced after the pylon scale-up. Re-tune `PAN_X`/`fov` together if this
  needs revisiting: panning alone shifts the tension between the two edges without fixing it;
  zooming out (higher FOV) is what actually creates simultaneous clearance on both sides.

### Bug: canvas size gets stuck when its container has an animated CSS transform

`HeroSection.tsx` used to apply `transform: scale(lerp(0.8, 1, p))` to `.hero-map-backdrop` (the
canvas's ancestor) every frame via direct style mutation — a leftover from the old flat-map
"docked small, grows on scroll" effect. This actively breaks react-three-fiber's canvas sizing:
the canvas measures its container once and doesn't re-measure just because an ancestor's
transform changed (transforms don't change layout/content-box size, so nothing tells the resize
observer to re-fire) — so the canvas gets stuck at whatever scale was in effect the last time it
happened to measure, then visibly fails to fill its container as the scale animates toward 1,
leaving an uncovered gap. Caught by scripting an instant scroll to a mid-transition position and
noticing a stray light/white rectangle in that gap; confirmed via
`canvas.getBoundingClientRect()` showing a smaller-than-expected box. Fixed by removing the CSS
transform entirely — the camera's own landing-vs-isometric pose already carries that "docked
small, grows" effect now, so the CSS scale was redundant on top of being actively harmful. (A
follow-up instant-scroll test appeared to show a *different* stray white rectangle at another mid
scroll position even after this fix; a realistic incremental `mouse.wheel()` scroll through the
same range rendered cleanly throughout, so that appears to be a Playwright instant-`scrollTo`
artifact — real/continuous scrolling doesn't hit it — not a real bug. Worth a second look if a
real user ever reports seeing a flash while scrolling, but not chased further here.)

## Known follow-ups / not done

- No real-time shadow mapping (`castShadow`/`receiveShadow` + configured shadow camera) — skipped
  to avoid tuning risk on the first pass; the lighting/material contrast alone already sells the
  "raised 3D platform" look reasonably well. Contact shadows or a real shadow map would be a
  natural next polish pass.
- No orbit controls — camera is intentionally fixed per the brief ("stable... not a game
  camera").
- Pylon `onSelect` is wired but `TransmissionNetwork` doesn't pass a handler yet (clicking a
  pylon currently no-ops safely rather than doing anything) — spec called this optional.
- Tilt/extrusion/lighting constants (`EXTRUDE_HEIGHT`, tower proportions, light angles/intensities)
  are first-pass values tuned by eye against the actual render, not derived from a formula — fine
  to keep adjusting the same way (screenshot, tweak, re-screenshot).
- The northeast cluster's clearance from the control panel is a tight fit tuned by eye (see
  Round 2 composition notes above), not a robust/responsive layout calculation — will need
  re-tuning if the panel or viewport assumptions change materially.

## Progress log

- 2026-08-12/13: CSS-tilt version built and verified on `feature/3d-hero-map` (see that branch's
  own history/commits for its context).
- 2026-08-13: Full WebGL rebuild on `feature/webgl-grid-3d`. Branched from `master` (not from the
  CSS-tilt branch, since none of that code is reused). Built geo3d.ts/grid3d.ts data layer, all
  `three/*` components, wired into `HeroSection` behind the old `HeroMap` prop contract, verified
  end-to-end with Playwright against the real dev server (screenshots + computed-transform
  checks), found and fixed the four bugs listed above, deleted the now-dead `HeroMap.tsx`/
  `TransmissionLayer.tsx`, confirmed a clean `next build`.
- 2026-08-13 (round 2): Added the scroll-driven camera transition (landing reads as a flat 2D
  chart, morphs to isometric), visual polish pass on pylons/lines/network topology chasing a
  reference image, compass+legend chrome, found and fixed the CSS-transform-vs-canvas-sizing bug
  above, re-tuned composition for the bigger pylons, re-verified with both scripted and simulated
  real-scroll Playwright checks, confirmed a clean `next build`.
- 2026-08-13 (round 3): Composition/color feedback — map felt small and off-center, pylons were
  dark and clustered into two congested corners. Changes:
  - `grid3d.ts`: replaced the two regional clusters (8 nodes crammed into the north + northeast
    corners) with one node per state dispersed across the whole country as a single backbone tree
    (J&K → Punjab → Rajasthan → Maharashtra → Karnataka → Tamil Nadu, plus a Rajasthan → West
    Bengal → Assam branch) — zero crossing lines, no congestion, reads as a real national grid
    rather than two dense knots. `GridNode.region` widened from `'north'|'northeast'` to
    `'north'|'west'|'south'|'east'|'northeast'`; `TransmissionNetwork.tsx` labels tooltips off a
    `REGION_LABEL` map instead of a hardcoded ternary.
  - `TransmissionPylon.tsx`: `STEEL`/`STEEL_DARK` recolored from dark gunmetal (#2c3239/#1d2127)
    to bright white/light chrome (#f1f4f8/#c7ceda) — towers were nearly disappearing into the dark
    navy background before.
  - `GridLighting.tsx`: all intensities raised (ambient 0.6→0.82, key 1.05→1.4, rim 0.22→0.36,
    hemisphere 0.32→0.45) for an overall brighter scene.
  - `StateMesh.tsx`: side-wall material recolored from flat dark navy (#212e3c) to a richer
    teal-blue (#2f6b8c) with a bit more shine; top-surface fill gets an unconditional ×1.15
    brighten on top of the existing hover/dim multipliers. Deliberately scoped to the 3D scene's
    own materials, not the shared `MAP_STATUS`/`CATEGORICAL` tokens in `lib/colors.ts` — those
    feed the 2D report/legend/comparison chips elsewhere in the app and changing them would have
    a much wider, likely unintended blast radius.
  - `GridExplorer3D.tsx`: `PAN_X` (the isometric pose's rightward pan clearing the control panel)
    cut from 1.9 to 0.9, and `CAMERA_ISO.fov` cut from 70 to 54 (zoom in) — now that pylons aren't
    clustered on one side anymore, the composition needed far less panning to stay clear of the
    panel, which freed up room to zoom in and recenter. Re-verified both landing and fully-scrolled
    states plus hover on the new node layout; confirmed a clean `next build`.

## Session 2026-09-29: glass landing map, hydration fix, animated street hero

Work on the current 2D-map app (the WebGL experiment above is not what's live).

- **Hydration warning fixed** (`src/app/layout.tsx`): `THEME_INIT_SCRIPT` sets `data-theme` on
  `<html>` before React hydrates, so server and client attributes differed. Added
  `suppressHydrationWarning` to `<html>` only (it doesn't cover children), with a comment
  explaining why. This was the app's own code, not a browser extension.
- **Glass landing map** (`HeroMap.tsx`, `HeroSection.tsx`, `lib/geo2d.ts`, `styles/hero.css`):
  - On the landing view India is one borderless, translucent "glass" shape with a glowing silver
    outline and a soft light streak tracing the mainland outline (80s per lap). No moving dot, which
    the user asked to remove.
  - As the user scrolls it cross-fades into the normal coloured state map + legend. The fade runs
    at scroll progress 0.2 → 0.5 via the `--hero-glass` CSS variable set in `HeroSection.tsx`.
  - `geo2d.ts` now also returns `outline` (mainland) and `outlineAll` (mainland + islands). These
    are built from edges that belong to only one state; neighbouring states share exact vertices in
    `india-states.geojson`, so shared edges are internal borders. That leaves one clean
    5,548-point mainland loop.
  - Glass fill opacity is set by the `stopOpacity` values (0.42 / 0.18 / 0.30) in `HeroMap.tsx`.
    Streak speed is `dur="80s"`.
  - Mobile (≤980px) and reduced motion: the glass layer is hidden and the streak is off,
    respectively.
  - An earlier silver-gradient version kept the state borders; the user rejected it, and it was
    replaced by the glass version.
- **Gotcha: BOMs broke page sizing.** Rewriting files with Windows PowerShell's
  `Set-Content -Encoding utf8` adds a UTF-8 BOM. In a bundled CSS file the BOM attaches to the first
  rule after the opening comment, and the browser drops that rule. In `hero.css` that rule is the
  hero sizing rule, so the whole page layout broke. The BOMs were stripped from `hero.css` and
  `HeroMap.tsx`, and no other file in `src` has one. Don't write source files with PowerShell
  `Set-Content`/`Out-File`.
- **Standalone animated hero prototype**: `D:\power dashboard\animated-hero\`, outside this repo.
  It isn't wired into the Next.js app yet.
  - An isometric dusk street of 8 townhouses with rolling power cuts, a pole-mounted transformer,
    electricity pulses, and a full-street outage every 60s.
  - Plain HTML/CSS/JS with GSAP 3.12.5 from cdnjs.
  - `scene.js` generates the SVG; `main.js` holds `CONFIG` plus the house/master timelines.
  - Run it by opening `index.html`. `powerHero.fullOutage()` in the console triggers an outage.
  - The restore flicker is 3 flickers over 0.9s rather than the brief's 0.6s, to stay under 3
    flashes a second.
  - Its `README.md` documents the timings, the `setHouseSchedule` data hook, and the layer ids
    for swapping in a professional illustration.
  - 2026-09-30: cut down to **3 houses**, spaced twice as far apart (`SPACING` 340 and
    `FIRST_X` 400 in `scene.js`), centred on the transformer. Rolling cuts are now **2.5s on /
    2.5s off** per house with phases `[0, 1.7, 3.4]` so the three are out of step. The
    whole-street outage now happens every 30s and lasts 5s. Camera framing was adjusted for both
    desktop and mobile.
  - 2026-09-30 (later), **current behaviour, signed off by the user**: `CONFIG.MODE = 'street'`,
    a single whole-street cycle of **5s on / 5s off** (`STREET_ON: 5`, `STREET_OFF: 5` at the top
    of `main.js`). Timing was checked in the browser: the street cuts at 6.8s, returns at 11.8s,
    and cuts again at 16.8s.
    - **On (5s):** all 3 homes are lit, with pulses flowing, the fan spinning and the TV
      flickering. The 5s starts when power returns, so it includes the short restore stutter.
    - **Burst:** the transformer gives a single bright flash and the birds fly off the wire. All
      homes cut in the same instant, the pulses stop, and the **whole page** dims, card and HUD
      included. That's a fixed `#page-dim` overlay (`PAGE_DIM` 0.28) plus `#scene-dim`. The pill
      shows "Outage across the street" with a timer.
    - **Off (5s):** then supply returns to every house together with the stutter
      (`FLICKER`: 3 flickers over 0.9s, flash-safe). The dim lifts and the birds fly back.
    - **Power-on effect** (added 2026-09-30): when supply returns, `energize()` in `main.js`
      plays at the transformer, over about 1.5s in total.
      - Small electric arcs draw in between the three bushings and down to the tank.
      - A soft blue-white glow swells and fades.
      - A ring ripples outward.
      - The artwork is `#transformer-energize` in `scene.js` (with `energize-glow`,
        `energize-ring` and `energize-arcs`, plus an `#energize-grad` gradient).
      - It uses smooth fades only, with no blinking, so it's flash-safe. It pairs with the burst
        (`spark()`) on power-off.
    - **Layout redesign** (2026-09-30), from a GTA "Groove Street" reference the user sent: the
      straight row of houses was replaced by a **US-style cul-de-sac**.
      - An entry road with a double yellow line comes in from the lower-left and ends in a round
        turnaround with sidewalks and a curb.
      - Six single-storey bungalows with low hip roofs sit close together, with driveways, flower
        beds and garages. Five are around the turnaround facing its centre (angles -122, -86, -50,
        -14 and 22 degrees in `HOUSES`) and one is on the entry road.
      - There are tall palms behind the houses, a chain-link fence along the road, and street lamps.
      - The transformer pole is on the turnaround sidewalk; service drops fan out from it to each
        house.
      - To support this, `scene.js` got generic helpers: `house()` handles any orientation
        (visible walls and roof planes are picked by normal against the view direction
        (1, -1, -1)), `WALL()` projects wall-plane transforms, and `palm()` draws the palms.
      - main.js now pairs lamps with houses by 2D distance (`data-cx` / `data-cy`).
      - Framing: `VIEW_DESKTOP [120, -715, 1120, 630]` (zoomed in at the user's request; was
        1300 wide). Mobile `VIEW_MOBILE_WIDTH` is 560.
      - A parked car was tried and then removed at the user's request.
      - The transformer's bushing lead wires (which looked like two "horns") were removed as
        unneeded detail.
      - The birds now perch on the service drop to house 4, on the right side of the turnaround.
      - The far backdrop buildings were removed at the user's request. `#layer-far` is now just
        plain lawn continuing past the lot, so at the current zoom the whole backdrop is grass and
        no sky shows.
    - The old per-house rolling cuts are still available with `MODE: 'rolling'`, which uses `ON`,
      `OFF` and `PHASE` (2.5s / 2.5s, phases `[0, 1.7, 3.4]`).
    - Also fixed a horizontal scrollbar: `.hero` used `width: 100vw`, which includes the vertical
      scrollbar; it's now `100%`.

## DONE 2026-09-30: animated street is now the landing page background

What shipped (the plan below is kept for history; decisions that differ from it are noted here):
- **Landing view:** the animated cul-de-sac replaces both the `hero-community.png` photo and the
  landing-state India map. The left gradient (`.tower-photo-fade`), headline, lede and "Scroll to
  expand the map" line are unchanged. The map no longer shows on the cover.
- **Files:**
  - `scripts/street-scene.js` is a copy of the prototype's scene builder and is the artwork
    source.
  - `scripts/build-street-svg.mjs` runs it against a fake DOM and writes
    `src/lib/streetSvg.generated.ts` (static markup, ~73 KB, hydration-safe). **After editing
    street-scene.js, run `node scripts/build-street-svg.mjs`.**
  - `src/lib/streetAnimation.ts` is the power-cycle controller (5s on / 5s off, burst, birds,
    energise, stutter). It uses the **Web Animations API plus a pausable clock, not GSAP**, so
    there's no new dependency.
  - `src/components/StreetHero.tsx` holds the SVG, status pill and pause button.
  - `src/styles/street.css` has the palette and state rules, all scoped under `.street-layer`.
- **Dim on burst:** it's scoped to the street's own `#scene-dim`, so the headline, gradient,
  sidebar and menu never darken.
- **Scroll timeline** (`HeroSection` `applyStyles`):
  - The street fades out and the camera pulls back (scale 1 → 0.93, drift up) over 12–42%. Its
    loop pauses once it's gone.
  - The map fades in over 20–42%, glass outline first.
  - Glass cross-fades into the state map over 40–60%.
  - The legend and compare panel arrive over 60–97% (as before).
  - `.hero-stage` is now 250vh (was 190vh) for a more gradual scrub.
- **"Explore dashboard" cue** (`.hero-explore`): a glass pill with a softly bobbing down arrow,
  centred at the bottom of the cover. It fades out over 4–30%. Clicking it glides to the fully
  revealed map with a custom 1.7s easeInOutCubic scroll (`glideTo`).
  - The end-snap `settle()` now uses the same glide (1.1s) instead of the browser's smooth scroll,
    which covered the short track in about 0.3s and felt abrupt.
  - Any wheel, touch or key input cancels a glide.
- **Mobile (≤980px):** the street is a static-framed background at 0.45 opacity with the loop
  still running. The pill sits in the flow under the headline (`order: 1`) and scrolls to the
  map. The HUD is hidden.
- **Verified:**
  - `tsc` is clean and my new files lint clean. The 3 existing lint errors are in
    `OnboardingTour`, `Sidebar` and `ThemeToggle`, untouched.
  - Playwright screenshots at 1440 and 390 px: cover, mid-glide (glass outline over the state map)
    and fully revealed. No page errors and no horizontal overflow.
  - The pinned layer stays at `top: 0` throughout the scroll.
- **Community photo moved to the map view** (user's call, after discussion): `hero-community.png` is
  back as the backdrop *behind the map*.
  - It sits under the street and fades in over 15–45% as the street hands off, settling at
    `PHOTO_OPACITY` 0.3 in `HeroSection.tsx`.
  - It keeps its slow sideways drift.
  - It's hidden on the cover (CSS base opacity 0) and hidden on mobile, where the street is the
    only backdrop.
  - Reasoning: an animated street behind the interactive map would compete with the data (the
    burst and dim every 10s), while the photo adds a "who this affects" layer at almost no cost.
- **Light-theme fixes (from a user screenshot on a 3440px screen):**
  - `.tower-photo-fade` is now sized to the headline column instead of 28% → 60% of the viewport.
    The old fade read as a long white fog over the dark street on wide screens.
  - A first short linear fade (about 260px) felt abrupt, so the final version is solid to
    `gutter + 440px`, then an **eased ~580px falloff**. The `color-mix` stops go 88 → 66 → 40 →
    18 → 5 → 0% paper, so it drops quickly near the text and feathers out like a vignette.
  - While the street dominates (`streetT < 0.5`), HeroSection adds `.hero-on-street` to
    `.hero-sticky`. That hides the paper-coloured `.hero-logo-fade` glow, which showed as a light
    blob behind the Ashoka logo.
  - Logo on the street: the light theme keeps the **coloured** logo (the user wanted it) on a
    small frosted light panel (`.hero-on-street .hero-coverage-badge` under
    `:root:not([data-theme='dark'])`), because its navy text is unreadable on the dark street.
    The dark theme keeps its white logo with no panel. (An interim version forced the white logo
    in both themes.)
- **Merged with the team's work (2026-09-30), locally only, not pushed.**
  - Our work is on branch `ui-street-hero` (commit `dda9629`), which then merged `origin/main`
    (team commits `172b43e`, `050c482`: new sidebar, About page, state-page and chart redesign,
    tokens, tooltip redesign, `?view=map` deep link, new lede text).
  - Conflicts were resolved in three files:
    - `layout.tsx`: their Google Fonts `<link>` loading plus our `suppressHydrationWarning`.
    - `HeroSection.tsx`: our street, photo, explore and glass timing, plus their 47% landing
      offset, `?view=map` and legend move. Their new description text is kept, as the user
      asked.
    - `hero.css`: our 250vh track plus their `-56px` bottom margin, and our photo rules (they had
      deleted the photo).
  - `HeroMap.tsx` auto-merged: their tooltip plus our glass layer.
  - Verified: `tsc` clean, production build OK (44 pages). Screenshots checked the cover (new
    sidebar, new text, street), `?view=map` (map over the photo) and `/state/maharashtra`, with no
    page errors.
  - Lint errors remaining are all in the team's or older files (`DataRules` unescaped `'`,
    `OnboardingTour`, `ThemeToggle`).
  - To publish: push `ui-street-hero` and open a PR into `main`, or merge locally and push. Only
    do this when the user says so.
- **Dark mode is the default** (2026-09-30):
  - `<html data-theme="dark">` in `layout.tsx`, and `ThemeToggle` now starts from `'dark'`.
  - The storage key moved to `acpet-theme-v2`, which resets old saved choices once so everyone
    starts in dark; the toggle persists normally after that.
  - Keep `THEME_INIT_SCRIPT` and `ThemeToggle`'s `STORAGE_KEY` in sync.
- **Light-theme street:** `street.css` overrides the palette under `:root:not([data-theme='dark'])`
  for an early-evening look: brighter lawn, road, paving, hedges, palms and poles, softer unlit
  windows, and the off-state shade at 0.22. This uses colours, not a brightness filter, for
  performance.
- **Not done yet:** `npm run build` (static export) was not run because the dev server was using
  the project. Run it before deploying.

## Original plan (2026-09-30), kept for reference

Goal: the animated street from `D:\power dashboard\animated-hero\` becomes the first thing people
see on `/`, with a few changes. Scrolling hands off smoothly to the existing glass map, and then
to the interactive state map. Nothing below has been built yet; confirm with the user before
starting.

### Current landing page (for reference)
- `src/app/page.tsx` renders `HeroSection`, but only after `useData()` finishes. Until then the
  page shows a plain "Loading dashboard data…" line.
- `HeroSection.tsx` is a tall sticky scroll stage driven by one smoothed scroll value `p`:
  - The editorial copy and the `hero-community.png` photo fade out over 12–45%.
  - The map moves to the centre by 60% (`MAP_SETTLE_END`).
  - The glass skin fades into the state map over 20–50% (`--hero-glass`).
  - The legend and compare panel fade in over 60–97%.
  - When scrolling stops, the page snaps to one end.
- Everything is disabled at 980px and below (mobile gets the static final layout).
- The app uses **no GSAP**. It uses plain requestAnimationFrame and d3-geo, and it's a static
  export (`output: 'export'`).

### Plan
1. **Port the street into React. Don't iframe it or load the vanilla scripts.**
   - New `src/components/street/StreetScene.tsx` renders the SVG. Move the geometry builders from
     `scene.js` into `src/lib/streetScene.ts` as pure functions that return the SVG markup string,
     and inject it once via `dangerouslySetInnerHTML`. The markup is static and deterministic, so
     it's hydration-safe.
   - New `src/lib/streetAnimation.ts` holds a plain TS port of `main.js`, `street` mode only, with
     the same `CONFIG`. Start it in a `useEffect` and return a cleanup that kills timelines,
     observers and listeners.
   - Colours go into `src/styles/street.css`. Reuse the app's `tokens.css` where the palette
     overlaps, and add a light-theme variant, since the app has a theme toggle.
2. **Choose the animation engine.** Either add `gsap` as an npm dependency (~70 KB; ScrollTrigger
   probably isn't needed), or rewrite the timelines on the rAF/`remap()` helpers `HeroSection`
   already uses. Recommendation: add `gsap` for the street loop only and leave HeroSection's
   scroll maths as it is. Ask the user.
3. **Changes to the street for the landing page:**
   - Drop the standalone title card, org lockup and placeholder sections. HeroSection already has
     the editorial headline and the ACPET logo, so reuse those over the street.
   - Keep the status pill and pause button, restyled to match the app's glass panels.
   - Scope `#page-dim` to the hero stage instead of the whole viewport, so the sidebar and menu
     don't flash dark. Or keep it full-page if the user prefers; ask.
   - The street replaces the `hero-community.png` photo layer in the editorial phase.
4. **Scroll transition, street → map.** This is the part to get right. One continuous camera move,
   driven by HeroSection's existing `p`:
   - **0–15%:** the street loop plays with the headline over it.
   - **15–40%:** the street loop pauses on a *powered* frame. The camera pulls up and back (scale
     the street SVG down with a slight upward translate) while the street fades out. The glowing
     overhead line + pulses fade last and cross-fade into the glass map's glowing outline, so the
     "electricity" visually becomes the outline of India.
   - **40–60%:** the glass map settles in the centre (existing behaviour, retimed).
   - **60–97%:** the glass fades into the state map and the legend and compare panel arrive
     (existing).
   - Reversing the scroll plays it all backwards and resumes the street loop at `p < 15%`.
   - Keep the existing end-snap `settle()`.
   - Pause the street loop entirely once `p > 40%` or the hero is off-screen, so there's no hidden
     animation cost.
5. **Loading:** render the street and headline immediately, before `useData()` resolves, so the
   first paint is the animated street instead of "Loading…". Only the map layer needs the data.
6. **Mobile (≤980px):** show a shorter, static-framed street (the transformer plus 3 houses, as
   in the standalone) above the map, with the loop running and no scroll-driven transition. This
   matches how HeroSection already opts out on mobile.
7. **Accessibility:**
   - Reduced motion: a static lit street and a straight cross-fade to the map, with no loop and no
     dim.
   - Keep the 3-flashes-per-second limit.
   - Give the pause button a visible focus ring.
   - Mark the street SVG `aria-hidden` or give it a single `aria-label`.
8. **Verify:**
   - `npm run build` (static export) and `npm run lint`.
   - Playwright screenshots at 1440 and 390 px, at `p` = 0, 0.25, 0.5 and 1.
   - Check that state clicks still route to `/state/<slug>` and that compare mode still works.
   - Check the page doesn't scroll sideways (`scrollWidth === innerWidth`).
   - Save files with the Edit/Write tools, never PowerShell `Set-Content` (see the BOM gotcha
     above).

### Open questions for the user
- Full-page dim, or hero-only dim, on the burst?
- Is the GSAP dependency OK?
- Keep the headline text exactly as it is now?
- Should the "Scroll to expand the map" cue stay?

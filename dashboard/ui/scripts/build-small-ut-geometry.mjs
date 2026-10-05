// Generates public/data/small-ut-detail.geojson: higher-detail outlines for the smallest UTs.
//
// public/data/india-states.geojson (the main map) is simplified enough that tiny island groups
// collapse — Lakshadweep is a single 7-point polygon there, not its ~35 islands. The "data being
// compiled" page (components/CompilingState.tsx) draws a small region's outline on its own, so it
// loads this file for those UTs only; the main map keeps its existing detail level.
//
// Source: udit-001/india-maps-data, pinned to one commit — the same `st_nm` schema and 2011-census
// lineage as india-states.geojson (bounds match it to 0.01°). Data licence: CC BY 4.0; see the
// attribution line written into the output. Each UT's district features are merged into one
// MultiPolygon under the main map's own `st_nm` spelling, and coordinates are rounded to 4 decimal
// places (~11 m) — far below anything visible on screen — to keep the file small.
//
// Run after changing SOURCES:  node scripts/build-small-ut-geometry.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMIT = '273a91960b2317c8431e562942293de959e2bd68';
const BASE = `https://raw.githubusercontent.com/udit-001/india-maps-data/${COMMIT}/geojson/states`;
/** main-map st_nm → source file */
const SOURCES = {
  Lakshadweep: 'lakshadweep.geojson',
  Puducherry: 'puducherry.geojson',
  Chandigarh: 'chandigarh.geojson',
  'Dadra and Nagar Haveli and Daman and Diu': 'dnh-and-dd.geojson',
  'Andaman & Nicobar': 'andaman-and-nicobar-islands.geojson',
};

const round = (v) => Math.round(v * 1e4) / 1e4;
const roundRing = (ring) =>
  ring
    .map(([x, y]) => [round(x), round(y)])
    // drop points that rounding made identical to their neighbour
    .filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);

const features = [];
for (const [stNm, file] of Object.entries(SOURCES)) {
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const src = await res.json();
  const polygons = src.features.flatMap((f) =>
    f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : []
  );
  const coordinates = polygons.map((poly) => poly.map(roundRing)).filter((poly) => poly[0].length >= 4);
  features.push({ type: 'Feature', properties: { st_nm: stNm }, geometry: { type: 'MultiPolygon', coordinates } });
  console.log(`${stNm}: ${coordinates.length} polygons`);
}

const out = {
  type: 'FeatureCollection',
  attribution: `India district boundaries, udit-001/india-maps-data (commit ${COMMIT.slice(0, 7)}), CC BY 4.0 — https://github.com/udit-001/india-maps-data`,
  features,
};
const here = dirname(fileURLToPath(import.meta.url));
const json = JSON.stringify(out);
writeFileSync(join(here, '..', 'public', 'data', 'small-ut-detail.geojson'), json);
console.log(`wrote small-ut-detail.geojson (${(json.length / 1024).toFixed(1)} KB)`);

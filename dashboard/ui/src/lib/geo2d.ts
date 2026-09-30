import { geoMercator, geoPath } from 'd3-geo';
import type { IndiaGeoJSON } from './types';

export interface StatePath2D {
  name: string;
  /** SVG path string in the same 0..width / 0..height pixel space as the container. */
  d: string;
  /** Projected centroid, in the same pixel space — used for pylon placement, hover tooltips,
   * and the click-popup anchor point. */
  centroid: [number, number];
}

export interface IndiaProjection2D {
  paths: StatePath2D[];
  byName: Record<string, StatePath2D>;
  /** Mainland outer boundary only (no state borders), as an SVG path string. */
  outline: string;
  /** Mainland plus island outer boundaries. */
  outlineAll: string;
}

/** Projects the raw India states GeoJSON straight into SVG path strings sized to fill a
 * `width`x`height` box. Re-derives the whole projection each call (d3-geo's fitExtent isn't
 * incremental), so callers should memoize on [geojson, width, height] rather than calling this
 * per render. */
export function buildIndiaPaths(geojson: IndiaGeoJSON, width: number, height: number, marginRatio = 0.025): IndiaProjection2D {
  const mx = width * marginRatio;
  const my = height * marginRatio;
  const projection = geoMercator().fitExtent(
    [
      [mx, my],
      [width - mx, height - my],
    ],
    geojson as never,
  );
  const gp = geoPath(projection);

  const paths: StatePath2D[] = geojson.features.map((f) => ({
    name: f.properties.st_nm,
    d: gp(f as never) ?? '',
    centroid: gp.centroid(f as never) as [number, number],
  }));

  const byName: Record<string, StatePath2D> = {};
  paths.forEach((p) => {
    byName[p.name] = p;
  });

  const loops = outerLoops(geojson).map((ring) =>
    ring.map((pt) => projection(pt) as [number, number]).filter(Boolean),
  );
  const toD = (ring: [number, number][]) => 'M' + ring.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z';
  const outline = loops.length ? toD(loops[0]) : '';
  const outlineAll = loops.map(toD).join('');

  return { paths, byName, outline, outlineAll };
}

/** India's outer boundary with no internal state borders. Neighbouring states in the GeoJSON share
 * exact vertices, so an edge that appears in only one state's ring lies on the outer boundary;
 * chaining those edges gives closed loops (mainland + islands), returned longest first. */
function outerLoops(geojson: IndiaGeoJSON): [number, number][][] {
  const key = (p: number[]) => `${p[0]},${p[1]}`;
  const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const counts = new Map<string, number>();
  const coords = new Map<string, [number, number]>();
  for (const f of geojson.features as unknown as { geometry: { type: string; coordinates: unknown } }[]) {
    const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
    for (const poly of polys)
      for (const ring of poly)
        for (let i = 0; i + 1 < ring.length; i++) {
          const a = key(ring[i]);
          const b = key(ring[i + 1]);
          coords.set(a, ring[i] as [number, number]);
          const k = edgeKey(a, b);
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
  }
  const adj = new Map<string, string[]>();
  for (const [k, n] of counts) {
    if (n !== 1) continue;
    const [a, b] = k.split('|');
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
  }
  const used = new Set<string>();
  const loops: [number, number][][] = [];
  for (const start of adj.keys()) {
    let prev: string | null = null;
    let cur = start;
    const loop = [start];
    for (;;) {
      const next = adj.get(cur)!.find((n) => n !== prev && !used.has(edgeKey(cur, n)));
      if (!next) break;
      used.add(edgeKey(cur, next));
      prev = cur;
      cur = next;
      if (cur === start) break;
      loop.push(cur);
    }
    if (loop.length > 2) loops.push(loop.map((k) => coords.get(k)!));
  }
  return loops.sort((a, b) => b.length - a.length);
}

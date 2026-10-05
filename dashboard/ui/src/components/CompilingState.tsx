'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MAP_HREF } from '@/lib/routes';
import { geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import type { GeoFeature, IndiaGeoJSON } from '@/lib/types';

/** gap between the selected region and the text block below it (the 24px map → pill step) */
const SLOT_GAP = 24;
/** how big (longest side, px) the selected region should read; the whole map zooms in until it
 * does, up to MAX_ZOOM × the fit-India scale */
const TARGET_DESKTOP = 170;
const TARGET_MOBILE = 110;
const MAX_ZOOM = 6;

/** Small-region treatment. A region is "small" when its on-screen area, after the normal zoom
 * above, is still under (SMALL_SIDE × target)² — i.e. smaller than a square ~23% of the target
 * size on a side (≈39px on desktop). That is decided from the geometry alone, so no list of UTs. */
const SMALL_SIDE = 0.23;
/** each island/fragment is drawn at least this big (longest side, px), scaled about its own
 * centre; a region with only a few parts gets them larger, since they can't crowd each other */
const MIN_FRAGMENT = 6;
const MIN_FRAGMENT_FEW = 16;
const FEW_PARTS = 3;
/** the cluster is zoomed to at most this share of the target size, so the map stays zoomed out
 * enough to show surrounding mainland */
const SMALL_CLUSTER_SHARE = 0.6;
/** padding (px) between the cluster and its dashed locator ring */
const RING_PAD = 14;
const MAX_ZOOM_SMALL = 60;
/** for a small region the backdrop is masked to a soft circle around it: at least this many
 * times the ring's radius, and reaching this many px past the nearest land */
const CONTEXT_FADE_RING = 1.35;
const CONTEXT_FADE_PAST_LAND = 40;
/** A small region that is a single piece and still at least this big (longest side, px) at the
 * normal zoom keeps the normal framing — the page-wide feathered backdrop, so it sits in a
 * regional map like every other page — and only adds the locator ring. It is zoomed to
 * READABLE_SHARE of the target size (tuned by eye on Delhi): big enough to read as the focal
 * subject, not so far that its neighbours crop down to a featureless sliver. */
const READABLE_SMALL = 2 * MIN_FRAGMENT_FEW;
const READABLE_SHARE = 0.4;

/** Higher-detail outlines for the smallest UTs (public/data/small-ut-detail.geojson, built by
 * scripts/build-small-ut-geometry.mjs). The main map is simplified enough that island groups
 * collapse — Lakshadweep is one polygon there, 35 here. Fetched once per page load and shared. */
let smallUtDetail: Promise<IndiaGeoJSON | null> | null = null;
function loadSmallUtDetail(): Promise<IndiaGeoJSON | null> {
  smallUtDetail ??= fetch('/data/small-ut-detail.geojson')
    .then((r) => (r.ok ? (r.json() as Promise<IndiaGeoJSON>) : null))
    .catch(() => null);
  return smallUtDetail;
}

interface Size {
  w: number;
  h: number;
  textH: number;
  textW: number;
}

type Polygon = number[][][];

function polygonsOf(f: GeoFeature): Polygon[] {
  const g = f.geometry as { type: string; coordinates: unknown };
  if (g.type === 'Polygon') return [g.coordinates as Polygon];
  if (g.type === 'MultiPolygon') return g.coordinates as Polygon[];
  return [];
}

/** smallest on-screen distance (px, under `proj`) from point `p` to any vertex of any feature
 * other than `exclude` — used to find how far the nearest neighbouring land is */
function nearestOtherLand(geojson: IndiaGeoJSON, exclude: string, proj: GeoProjection, p: [number, number]): number {
  let best = Infinity;
  for (const f of geojson.features) {
    if (f.properties.st_nm === exclude) continue;
    for (const poly of polygonsOf(f)) {
      for (const ring of poly) {
        for (const c of ring) {
          const q = proj(c as [number, number]);
          if (!q) continue;
          const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
          if (d < best) best = d;
        }
      }
    }
  }
  return best;
}

/** names up to this many characters are kept on one line */
const SHORT_NAME = 22;
const NBSP = ' ';

const isConnector = (word: string) => word === 'and' || word === '&';

/** Where a region name may break across lines. A normal-length name never splits ("Andaman &
 * Nicobar" can't become "Andaman / & Nicobar"). In a long one, a connector ("and", "&") is glued
 * to the word after it, so no line ends on a dangling "and", and the final "X and Y" stays in one
 * piece — "…Nagar Haveli / and Daman and Diu", never "…Daman / and Diu". */
function nameBreaks(name: string): string {
  const words = name.split(' ');
  if (name.length <= SHORT_NAME) return words.join(NBSP);
  const last = words.length - 1;
  return words.reduce((out, word, i) => {
    if (i === 0) return word;
    const glue = isConnector(words[i - 1]) || i === last || (i === last - 1 && isConnector(word)) ? NBSP : ' ';
    return out + glue + word;
  }, '');
}

interface Fragment {
  d: string;
  /** SVG transform that scales the fragment up about its own centre, or undefined if it's
   * already big enough */
  transform?: string;
}

/** The "data being compiled" view for any state/UT with nothing in either dataset (see
 * StateDetail.tsx). One SVG, one projection: the full India map is drawn as faint texture, and the
 * selected region is the very same geometry from that same projection, given the accent outline
 * and fill — so it can never drift off its real boundary. The projection is zoomed and panned so
 * the region sits in an empty slot just above the text block. Very small regions (by on-screen
 * area) get each fragment drawn at a minimum readable size, a dashed locator ring, and a zoom
 * that keeps the nearest neighbouring land in view. */
export default function CompilingState({ name, geojson }: { name: string; geojson: IndiaGeoJSON | null }) {
  const router = useRouter();
  const uid = useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(null);
  // higher-detail outlines for the smallest UTs (see loadSmallUtDetail); null while loading
  const [detail, setDetail] = useState<IndiaGeoJSON | 'failed' | null>(null);

  useEffect(() => {
    let live = true;
    loadSmallUtDetail().then((d) => live && setDetail(d ?? 'failed'));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const text = textRef.current;
    if (!wrap || !text) return;
    const measure = () => setSize({ w: wrap.clientWidth, h: wrap.clientHeight, textH: text.offsetHeight, textW: text.offsetWidth });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    ro.observe(text);
    return () => ro.disconnect();
  }, []);

  const map = useMemo(() => {
    if (!geojson || !size || size.w === 0 || size.h === 0) return null;
    const feature = geojson.features.find((f) => f.properties.st_nm === name);
    if (!feature) return null;
    const { w, h, textH, textW } = size;
    const target = w < 600 ? TARGET_MOBILE : TARGET_DESKTOP;

    // 1. fit all of India into the area, and see how big the selected region comes out
    const proj = geoMercator().fitSize([w, h], geojson as never);
    const path = geoPath(proj);
    const [[x0, y0], [x1, y1]] = path.bounds(feature as never);
    const bw = x1 - x0;
    const bh = y1 - y0;
    const normalZoom = Math.min(MAX_ZOOM, Math.max(1, target / Math.max(bw, bh, 1e-6)));

    // 2. small or not: by on-screen area at the normal zoom
    const small = path.area(feature as never) * normalZoom * normalZoom < (SMALL_SIDE * target) ** 2;

    // a small region is drawn from the higher-detail file when it has it (so e.g. Lakshadweep's
    // islands survive), and framed by that geometry's bounds; the main map is untouched
    if (small && detail === null) return null; // wait for it rather than jump once it lands
    const shape = (small && detail !== 'failed' && detail?.features.find((f) => f.properties.st_nm === name)) || feature;
    const [[s0, t0], [s1, t1]] = path.bounds(shape as never);
    const sw = s1 - s0;
    const sh = t1 - t0;

    const readable = small && polygonsOf(shape).length === 1 && Math.max(sw, sh) * normalZoom >= READABLE_SMALL;

    let zoom = normalZoom;
    let slotH: number;
    let ringR = 0;
    let fadeR = 0;
    if (!small) {
      slotH = Math.min(bh * zoom, target);
    } else if (readable) {
      zoom = Math.min(MAX_ZOOM_SMALL, Math.max(normalZoom, (READABLE_SHARE * target) / Math.max(sw, sh, 1e-6)));
      ringR = (Math.hypot(sw, sh) / 2) * zoom + RING_PAD;
      slotH = ringR * 2;
    } else {
      // zoom so the nearest neighbouring land falls inside a comfortable radius around the
      // cluster, without blowing the cluster itself past SMALL_CLUSTER_SHARE of the target
      const centre: [number, number] = [(s0 + s1) / 2, (t0 + t1) / 2];
      const clusterR = Math.hypot(sw, sh) / 2;
      const landD = nearestOtherLand(geojson, name, proj, centre);
      const contextR = Math.min(w * 0.28, h * 0.26);
      const fitContext = contextR / Math.max(landD + clusterR, 1e-6);
      const capCluster = (SMALL_CLUSTER_SHARE * target) / Math.max(sw, sh, 1e-6);
      zoom = Math.min(MAX_ZOOM_SMALL, Math.max(1, Math.min(fitContext, capCluster)));
      ringR = Math.max(clusterR * zoom + RING_PAD, MIN_FRAGMENT_FEW / 2 + RING_PAD);
      slotH = ringR * 2;
      // the backdrop is only shown inside a soft circle around the cluster, reaching just past
      // the nearest land — a sliver of coast for context, not a whole side of the page
      fadeR = Math.min(Math.max(ringR * CONTEXT_FADE_RING, landD * zoom + CONTEXT_FADE_PAST_LAND), Math.min(w / 2, h / 2));
    }

    // 3. the slot the region occupies above the text: slot + gap + text block are centred
    //    together vertically, mirroring the CSS layout of .compiling-content
    const top = (h - (slotH + SLOT_GAP + textH)) / 2;
    const cx = w / 2;
    const cy = top + slotH / 2;

    // 4. zoom, then pan so the region's bounding-box centre lands on the slot centre
    proj.scale(proj.scale() * zoom);
    const [[a0, b0], [a1, b1]] = path.bounds(shape as never);
    const [tx, ty] = proj.translate();
    proj.translate([tx + cx - (a0 + a1) / 2, ty + cy - (b0 + b1) / 2]);

    const paths = geojson.features
      .filter((f) => f.properties.st_nm !== name)
      .map((f) => ({ key: f.properties.st_nm, d: path(f as never) }))
      .filter((p): p is { key: string; d: string } => !!p.d);

    // 5. the region itself: one path normally; for a small region, one path per fragment, each
    //    scaled up about its own centre to a minimum readable size
    let fragments: Fragment[];
    if (!small) {
      const d = path(feature as never);
      fragments = d ? [{ d }] : [];
    } else {
      const parts = polygonsOf(shape);
      const minSize = parts.length <= FEW_PARTS ? MIN_FRAGMENT_FEW : MIN_FRAGMENT;
      fragments = parts.flatMap((coords) => {
        const part = { type: 'Polygon', coordinates: coords } as never;
        const d = path(part);
        if (!d) return [];
        const [[p0, q0], [p1, q1]] = path.bounds(part);
        const longest = Math.max(p1 - p0, q1 - q0);
        if (longest >= minSize) return [{ d }];
        const k = minSize / Math.max(longest, 1e-6);
        const mx = (p0 + p1) / 2;
        const my = (q0 + q1) / 2;
        return [{ d, transform: `translate(${mx} ${my}) scale(${k}) translate(${-mx} ${-my})` }];
      });
    }

    const fade = small && !readable ? { cx, cy, r: fadeR } : null;
    // a soft clearing in the India texture behind the text, so the headline sits on a clean area
    // whatever the page background is (a painted pool of colour shows on the photo backdrop)
    const clear = {
      cx,
      cy: top + slotH + SLOT_GAP + textH / 2,
      rx: textW / 2 + (w < 600 ? 24 : 96),
      ry: textH / 2 + (w < 600 ? 40 : 48),
    };
    return { slotH, paths, fragments, small, ring: small ? { cx, cy, r: ringR } : null, fade, clear };
  }, [geojson, name, size, detail]);

  return (
    <div className="compiling" ref={wrapRef}>
      {map && (
        <svg className={`compiling-map${map.fade ? ' compiling-map--small' : ''}`} width={size!.w} height={size!.h} aria-hidden="true">
          <defs>
            {map.fade && (
              <radialGradient id={`${uid}-fade`} gradientUnits="userSpaceOnUse" cx={map.fade.cx} cy={map.fade.cy} r={map.fade.r}>
                <stop offset="0.45" stopColor="#fff" />
                <stop offset="1" stopColor="#fff" stopOpacity={0} />
              </radialGradient>
            )}
            <radialGradient id={`${uid}-clear`}>
              <stop offset="0.55" stopColor="#000" />
              <stop offset="1" stopColor="#000" stopOpacity={0} />
            </radialGradient>
            <mask id={`${uid}-mask`}>
              <rect width={size!.w} height={size!.h} fill={map.fade ? `url(#${uid}-fade)` : '#fff'} />
              <ellipse cx={map.clear.cx} cy={map.clear.cy} rx={map.clear.rx} ry={map.clear.ry} fill={`url(#${uid}-clear)`} />
            </mask>
          </defs>
          <g className="compiling-map-india" mask={`url(#${uid}-mask)`}>
            {map.paths.map((p) => (
              <path key={p.key} d={p.d} />
            ))}
          </g>
          {/* Delhi keeps the small-region ring and zoom but takes the regular pale fill and dashed
              outline (see .compiling-map-region--outline), to match the other pages */}
          <g
            className={`compiling-map-region compiling-rise${map.small ? ' compiling-map-region--small' : ''}${
              name === 'Delhi' ? ' compiling-map-region--outline' : ''
            }`}
          >
            {map.fragments.map((f, i) => (
              <path key={i} d={f.d} transform={f.transform} vectorEffect="non-scaling-stroke" />
            ))}
            {map.ring && <circle className="compiling-map-ring" cx={map.ring.cx} cy={map.ring.cy} r={map.ring.r} />}
          </g>
        </svg>
      )}

      <div className="compiling-content">
        {/* empty space the selected region is drawn into (by the SVG above), so the text block
            sits just below it */}
        <div className="compiling-slot" style={map ? { height: map.slotH } : undefined} aria-hidden="true" />
        <div className="compiling-text" ref={textRef}>
          <span className="compiling-pill compiling-rise">
            <span className="compiling-pill-dot" aria-hidden="true" />
            Data compilation in progress
          </span>
          {/* the visible headline is just the region name (the pill above says what's happening);
              screen readers get the full sentence. --name-len steps the size down for long names
              (see .compiling h1) and nameBreaks controls where the name can wrap */}
          <h1 className="compiling-rise" style={{ ['--name-len' as string]: name.length }}>
            <span className="sr-only">Data for </span>
            {nameBreaks(name)}
            <span className="sr-only"> is being compiled</span>
          </h1>
          <button type="button" className="compiling-cta compiling-rise" onClick={() => router.push(MAP_HREF)}>
            Explore Other States &amp; UTs <span className="compiling-cta-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

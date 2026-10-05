'use client';

import { useMemo } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import type { IndiaGeoJSON } from '@/lib/types';

interface Props {
  geojson: IndiaGeoJSON;
  name: string;
  size?: number;
  color: string;
}

/** An isolated silhouette of a single state, cropped to its own bounds rather than its
 * position within India — used where a state needs to read as its own small icon (e.g. a
 * comparison header) rather than as a piece of the full map. */
export default function StateShape({ geojson, name, size = 72, color }: Props) {
  const shape = useMemo(() => {
    const feature = geojson.features.find((f) => f.properties.st_nm === name);
    if (!feature) return null;
    const pad = size * 0.08;
    const proj = geoMercator().fitExtent(
      [
        [pad, pad],
        [size - pad, size - pad],
      ],
      feature as never
    );
    const path = geoPath(proj);
    const d = path(feature as never);
    if (!d) return null;
    // fitExtent above fits the shape into a fixed *square* box, preserving its aspect ratio —
    // for a wide/short (or tall/narrow) state, that leaves the unfilled axis as dead canvas space
    // (e.g. Madhya Pradesh's wide-short outline reads small, framed by empty space above/below).
    // Re-crop the actual <svg> to the shape's own bounding box instead of the full square, so the
    // rendered silhouette fills its allotted space edge to edge on its longer axis.
    const [[x0, y0], [x1, y1]] = path.bounds(feature as never);
    const outerPad = size * 0.04;
    const bw = x1 - x0 + outerPad * 2;
    const bh = y1 - y0 + outerPad * 2;
    return { d, viewBox: `${x0 - outerPad} ${y0 - outerPad} ${bw} ${bh}`, width: bw, height: bh };
  }, [geojson, name, size]);

  if (!shape) return null;

  return (
    <svg width={shape.width} height={shape.height} viewBox={shape.viewBox} className="state-shape" aria-hidden="true">
      <path d={shape.d} style={{ fill: color }} fillOpacity={0.82} stroke="rgba(255,255,255,0.55)" strokeWidth={1} strokeLinejoin="round" />
    </svg>
  );
}

/* Validated categorical palette (8 hues, fixed order — see dataviz skill palette.md).
   Assigned in fixed order, never cycled per-render: each state gets a permanent
   "home" hue; comparison colors are assigned dynamically by selection order so any
   2-8 states picked together stay adjacent-pair CVD-safe. */
export const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

export const STATUS = {
  good: '#0ca30c',
  warning: '#e2960f',
  critical: '#d03b3b',
  mapNone: '#dfe2e8',
};

/** Map fills, solid only — a muted terracotta/clay for a tracked state with reported data
 * (clickable through to its full report), an off-white for a tracked state still awaiting reported
 * data (not clickable — see stateMapStatus), and a muted warm greige for states entirely
 * outside ACPET's tracked scope ("Coming soon"). Mirrors --map-tracked/--map-no-data/--map-idle in
 * tokens.css — the legend and search-list swatches draw the same fills from those tokens. */
export const MAP_STATUS = {
  tracked: '#b0825c',
  noData: '#e9e6de',
  idle: '#cbc0ae',
};

/** Muted gold used for the transmission network and any hover/selection glow on the map —
 * mirrors --map-transmission in tokens.css. */
export const TRANSMISSION_GOLD = '#d8ae3f';

/** Default state border color — a deep warm brown, dark enough to stay visible against every
 * map fill (tracked clay, idle greige, no-data off-white) rather than the low-contrast gold. */
export const MAP_BORDER = '#4a3320';

/** Warm paper tone a state's fill washes toward when another state is hovered — deliberately a
 * light wash, not a darken-to-black, so every state stays visible and reads as clickable. */
export const MAP_WASH = '#f2ece0';

export function stateHueMap(stateOrder: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  stateOrder.forEach((s, i) => {
    map[s] = CATEGORICAL[i % CATEGORICAL.length];
  });
  return map;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** n distinct shades of baseHex, lightness-ramped, for DISCOMs within one state. */
export function shades(baseHex: string, n: number): string[] {
  if (n <= 1) return [baseHex];
  const [h, s] = rgbToHsl(...hexToRgb(baseHex));
  const lo = 0.35;
  const hi = 0.62;
  return Array.from({ length: n }, (_, i) => rgbToHex(hslToRgb(h, Math.min(1, s * 1.05), lo + (i / (n - 1)) * (hi - lo))));
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Linear-interpolate two hex colors by t (0 = a, 1 = b) — plain-color equivalent of
 * THREE.Color.lerp, used by the 2D map to blend a state's base fill toward a hover/selection
 * tint without introducing a separate color library. */
export function lerpHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]);
}

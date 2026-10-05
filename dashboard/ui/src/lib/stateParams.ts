import { readFileSync } from 'fs';
import path from 'path';
import { stateHasSopData } from './computations';
import { slugify } from './slug';
import type { DiscomsData, StateSpecificData } from './types';

/** Build-time (server-only) helpers shared by the /state/[name] overview and /state/[name]/data
 * routes — both need every state slug known up front for the static export. */

const readJson = <T,>(file: string): T => JSON.parse(readFileSync(path.join(process.cwd(), 'public/data', file), 'utf8')) as T;

// Static export needs every possible [name] segment known at build time. The map is clickable
// for every state/UT in the India geojson — not just the 12 ACPET tracks — so an "idle" state
// (outside ACPET's scope in both datasets) still needs a real static route to land on, or a map
// click there would 404 rather than reach the "coming soon" fallback.
export function loadAllStateNames(): string[] {
  const geojson = readJson<{ features: { properties: { st_nm: string } }[] }>('india-states.geojson');
  return geojson.features.map((f) => f.properties.st_nm);
}

// Params are plain slugs ("madhya-pradesh"), not the raw state name — see slug.ts for why.
export function allStateParams(): { name: string }[] {
  return loadAllStateNames().map((name) => ({ name: slugify(name) }));
}

export function stateNameForSlug(slug: string): string | undefined {
  return loadAllStateNames().find((s) => slugify(s) === slug);
}

/** True when a state has nothing in either dataset — the same check the pages use to show the
 * "data being compiled" view. */
export function stateIsEmpty(name: string): boolean {
  const discoms = readJson<DiscomsData>('discoms2.json');
  const stateSpecific = readJson<StateSpecificData>('state_specific.json');
  return !discoms.discoms.some((d) => d.state === name) && !stateHasSopData(stateSpecific, name);
}

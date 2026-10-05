import { readFileSync } from 'fs';
import path from 'path';
import type { Metadata } from 'next';
import StateDetail from '@/components/StateDetail';
import { stateHasSopData } from '@/lib/computations';
import { slugify } from '@/lib/slug';
import type { DiscomsData, StateSpecificData } from '@/lib/types';

const readJson = <T,>(file: string): T => JSON.parse(readFileSync(path.join(process.cwd(), 'public/data', file), 'utf8')) as T;

// Static export needs every possible [name] segment known at build time. The map is clickable
// for every state/UT in the India geojson — not just the 12 ACPET tracks — so an "idle" state
// (outside ACPET's scope in both datasets) still needs a real static route to land on, or a map
// click there would 404 rather than reach StateDetail's "coming soon" fallback.
function loadAllStateNames(): string[] {
  const geojson = readJson<{ features: { properties: { st_nm: string } }[] }>('india-states.geojson');
  return geojson.features.map((f) => f.properties.st_nm);
}

// Params are plain slugs ("madhya-pradesh"), not the raw state name — see slug.ts for why.
export function generateStaticParams() {
  return loadAllStateNames().map((name) => ({ name: slugify(name) }));
}

// A state with nothing in either dataset gets the "data being compiled" page, whose visible
// headline is only the region name — so its <title> carries the full sentence instead. Same check
// StateDetail uses to pick that page; every other state page keeps the site-wide title.
export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name: slug } = await params;
  const name = loadAllStateNames().find((s) => slugify(s) === slug);
  if (!name) return {};
  const discoms = readJson<DiscomsData>('discoms2.json');
  const stateSpecific = readJson<StateSpecificData>('state_specific.json');
  const isEmpty = !discoms.discoms.some((d) => d.state === name) && !stateHasSopData(stateSpecific, name);
  return isEmpty ? { title: `Data for ${name} is being compiled · India Power Supply, Service Quality and Safety Dashboard` } : {};
}

export default async function StatePage({ params }: { params: Promise<{ name: string }> }) {
  const { name: slug } = await params;
  const name = loadAllStateNames().find((s) => slugify(s) === slug) ?? slug;
  return <StateDetail name={name} />;
}

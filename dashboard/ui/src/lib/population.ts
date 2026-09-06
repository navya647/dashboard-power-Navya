import { stateIsTracked } from './computations';
import type { Discom, StateSpecificData } from './types';

/** 2026 population estimates, keyed by the geojson's `st_nm` state name. Union territories and
 * any state absent from this table simply get no population line in the map tooltip. */
export const STATE_POPULATION_2026: Record<string, number> = {
  'Uttar Pradesh': 243_466_000,
  Bihar: 132_850_000,
  Maharashtra: 129_584_000,
  'West Bengal': 100_631_000,
  'Madhya Pradesh': 89_965_000,
  Rajasthan: 83_879_000,
  'Tamil Nadu': 77_582_000,
  Gujarat: 74_343_000,
  Karnataka: 69_074_000,
  'Andhra Pradesh': 53_740_000,
  Odisha: 47_221_000,
  Jharkhand: 41_108_000,
  Telangana: 38_665_000,
  Assam: 36_815_000,
  Kerala: 36_239_000,
  Haryana: 31_409_000,
  Punjab: 31_370_000,
  Chhattisgarh: 31_311_000,
  Uttarakhand: 12_028_000,
  'Himachal Pradesh': 7_588_000,
  Tripura: 4_268_000,
  Meghalaya: 3_447_000,
  Manipur: 3_318_000,
  Nagaland: 2_299_000,
  'Arunachal Pradesh': 1_608_000,
  Goa: 1_601_000,
  Mizoram: 1_275_000,
  Sikkim: 709_000,
};

export function formatPopulation(name: string): string | null {
  const value = STATE_POPULATION_2026[name];
  if (!value) return null;
  const crores = value / 1e7;
  return `${crores.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} Cr`;
}

/** Share of the population in the table above that lives in a state ACPET tracks in some form
 * (reused from stateIsTracked — same reliability/SoP scope the map's fill color is built from,
 * see stateMapStatus in computations.ts). The denominator is the sum of this table's 28 states,
 * not an official all-India total (which also includes UTs not in this table). */
export function populationCoveragePercent(discoms: Discom[], stateSpecific?: StateSpecificData | null): number {
  let covered = 0;
  let total = 0;
  for (const [state, population] of Object.entries(STATE_POPULATION_2026)) {
    total += population;
    if (stateIsTracked(discoms, state, stateSpecific)) covered += population;
  }
  return total === 0 ? 0 : (covered / total) * 100;
}

/** A single connected transmission network for the ambient pylon/flow layer, spanning the
 * whole country, Himachal Pradesh and Jammu & Kashmir/Ladakh in the north, down through the
 * centre to Kerala, out to Tripura in the north-east, and along the east coast through
 * Odisha/Andhra Pradesh. Not a literal grid diagram, and intentionally not one node per
 * state: the infrastructure layer is supporting texture for the map, not a focal element, so
 * it stays to a handful of pylons rather than a dense national mesh. */
export const GRID_CONNECTIONS: [string, string][] = [
  ['Himachal Pradesh', 'Haryana'],
  ['Himachal Pradesh', 'Jammu & Kashmir'],
  ['Jammu & Kashmir', 'Ladakh'],
  ['Haryana', 'Rajasthan'],
  ['Rajasthan', 'Madhya Pradesh'],
  ['Madhya Pradesh', 'Uttar Pradesh'],
  ['Uttar Pradesh', 'Bihar'],
  ['Bihar', 'West Bengal'],
  ['West Bengal', 'Assam'],
  ['Assam', 'Meghalaya'],
  ['Meghalaya', 'Tripura'],
  ['West Bengal', 'Odisha'],
  ['Odisha', 'Andhra Pradesh'],
  ['Madhya Pradesh', 'Maharashtra'],
  ['Maharashtra', 'Karnataka'],
  ['Karnataka', 'Tamil Nadu'],
  ['Tamil Nadu', 'Kerala'],
  ['Gujarat', 'Rajasthan'],
  ['Gujarat', 'Maharashtra'],
];

/** Transmission network topology for the hero map, one node per state/UT, excluding the
 * North-eastern states and Delhi (per the brief), plus a sparse set of connections into a single
 * backbone. Node positions are NOT hardcoded here, `state` names are resolved against the
 * projected state centroids at render time (see geo2d.ts / TransmissionLayer.tsx), so nodes
 * always sit on the actual state they represent, in whatever coordinate space the map is
 * currently projected into. */

export interface GridNode {
  id: string;
  region: 'north' | 'west' | 'south' | 'east' | 'northeast';
  /** Which state's projected centroid this node's position resolves to. */
  state: string;
}

export interface GridConnection {
  id: string;
  from: string;
  to: string;
  status: 'active' | 'idle';
  /** Mock relative flow strength (0-100), drives pulse speed/brightness until this is wired to
   * real transmission data. */
  flow: number;
}

/** States/UTs excluded from getting their own individual pylon: the North-eastern states (incl.
 * Sikkim, part of the North Eastern Council), which get a single shared pylon instead, see
 * GRID_NODES below, and Delhi, per the brief. */
export const EXCLUDED_STATES = [
  'Arunachal Pradesh',
  'Assam',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Tripura',
  'Sikkim',
  'Delhi',
];

/** Andaman & Nicobar gets a standalone pylon (per the brief, it's a state too) but no
 * transmission line, it's genuinely islanded from the mainland grid in reality, and a line
 * drawn across the sea to reach it would misread as a real connection. Lakshadweep is left off
 * entirely (no pylon at all). */
export const GRID_NODES: GridNode[] = [
  // one shared pylon standing in for the whole North-eastern region, rather than one per state,
  // positioned on Assam (geographically central to the region) and wired into the mainland
  // backbone via West Bengal, the real grid's actual NE tie-in point
  { id: 'northeast', region: 'northeast', state: 'Assam' },

  { id: 'jammu-kashmir', region: 'north', state: 'Jammu & Kashmir' },
  { id: 'ladakh', region: 'north', state: 'Ladakh' },
  { id: 'himachal-pradesh', region: 'north', state: 'Himachal Pradesh' },
  { id: 'punjab', region: 'north', state: 'Punjab' },
  { id: 'chandigarh', region: 'north', state: 'Chandigarh' },
  { id: 'haryana', region: 'north', state: 'Haryana' },
  { id: 'rajasthan', region: 'north', state: 'Rajasthan' },
  { id: 'uttarakhand', region: 'north', state: 'Uttarakhand' },
  { id: 'uttar-pradesh', region: 'north', state: 'Uttar Pradesh' },

  { id: 'bihar', region: 'east', state: 'Bihar' },
  { id: 'jharkhand', region: 'east', state: 'Jharkhand' },
  { id: 'west-bengal', region: 'east', state: 'West Bengal' },
  { id: 'odisha', region: 'east', state: 'Odisha' },

  { id: 'gujarat', region: 'west', state: 'Gujarat' },
  { id: 'dnh-dd', region: 'west', state: 'Dadra and Nagar Haveli and Daman and Diu' },
  { id: 'maharashtra', region: 'west', state: 'Maharashtra' },
  { id: 'madhya-pradesh', region: 'west', state: 'Madhya Pradesh' },
  { id: 'chhattisgarh', region: 'west', state: 'Chhattisgarh' },
  { id: 'goa', region: 'west', state: 'Goa' },

  { id: 'karnataka', region: 'south', state: 'Karnataka' },
  { id: 'andhra-pradesh', region: 'south', state: 'Andhra Pradesh' },
  { id: 'telangana', region: 'south', state: 'Telangana' },
  { id: 'tamil-nadu', region: 'south', state: 'Tamil Nadu' },
  { id: 'kerala', region: 'south', state: 'Kerala' },
  { id: 'puducherry', region: 'south', state: 'Puducherry' },
  { id: 'andaman-nicobar', region: 'south', state: 'Andaman & Nicobar' },
];

// a light mesh across the mainland states, mostly a spanning backbone with a handful of extra
// edges for redundancy, deliberately excluding the two island nodes above (see their comment)
export const GRID_CONNECTIONS: GridConnection[] = [
  { id: 'ladakh-jammu-kashmir', from: 'ladakh', to: 'jammu-kashmir', status: 'active', flow: 42 },
  { id: 'jammu-kashmir-himachal-pradesh', from: 'jammu-kashmir', to: 'himachal-pradesh', status: 'active', flow: 48 },
  { id: 'himachal-pradesh-punjab', from: 'himachal-pradesh', to: 'punjab', status: 'active', flow: 55 },
  { id: 'punjab-chandigarh', from: 'punjab', to: 'chandigarh', status: 'active', flow: 40 },
  { id: 'punjab-haryana', from: 'punjab', to: 'haryana', status: 'active', flow: 58 },
  { id: 'haryana-rajasthan', from: 'haryana', to: 'rajasthan', status: 'active', flow: 63 },
  { id: 'haryana-uttar-pradesh', from: 'haryana', to: 'uttar-pradesh', status: 'active', flow: 66 },
  { id: 'uttar-pradesh-uttarakhand', from: 'uttar-pradesh', to: 'uttarakhand', status: 'active', flow: 45 },
  { id: 'uttar-pradesh-madhya-pradesh', from: 'uttar-pradesh', to: 'madhya-pradesh', status: 'active', flow: 60 },
  { id: 'uttar-pradesh-bihar', from: 'uttar-pradesh', to: 'bihar', status: 'active', flow: 57 },
  { id: 'bihar-jharkhand', from: 'bihar', to: 'jharkhand', status: 'active', flow: 52 },
  { id: 'bihar-west-bengal', from: 'bihar', to: 'west-bengal', status: 'active', flow: 54 },
  { id: 'west-bengal-odisha', from: 'west-bengal', to: 'odisha', status: 'active', flow: 50 },
  { id: 'west-bengal-northeast', from: 'west-bengal', to: 'northeast', status: 'active', flow: 44 },
  { id: 'rajasthan-gujarat', from: 'rajasthan', to: 'gujarat', status: 'active', flow: 61 },
  { id: 'rajasthan-madhya-pradesh', from: 'rajasthan', to: 'madhya-pradesh', status: 'active', flow: 56 },
  { id: 'gujarat-dnh-dd', from: 'gujarat', to: 'dnh-dd', status: 'active', flow: 38 },
  { id: 'gujarat-maharashtra', from: 'gujarat', to: 'maharashtra', status: 'active', flow: 65 },
  { id: 'madhya-pradesh-chhattisgarh', from: 'madhya-pradesh', to: 'chhattisgarh', status: 'active', flow: 53 },
  { id: 'madhya-pradesh-maharashtra', from: 'madhya-pradesh', to: 'maharashtra', status: 'active', flow: 62 },
  { id: 'chhattisgarh-odisha', from: 'chhattisgarh', to: 'odisha', status: 'active', flow: 49 },
  { id: 'maharashtra-goa', from: 'maharashtra', to: 'goa', status: 'active', flow: 41 },
  { id: 'maharashtra-karnataka', from: 'maharashtra', to: 'karnataka', status: 'active', flow: 68 },
  { id: 'odisha-andhra-pradesh', from: 'odisha', to: 'andhra-pradesh', status: 'active', flow: 51 },
  { id: 'karnataka-andhra-pradesh', from: 'karnataka', to: 'andhra-pradesh', status: 'active', flow: 59 },
  { id: 'karnataka-telangana', from: 'karnataka', to: 'telangana', status: 'active', flow: 47 },
  { id: 'telangana-andhra-pradesh', from: 'telangana', to: 'andhra-pradesh', status: 'active', flow: 55 },
  { id: 'karnataka-tamil-nadu', from: 'karnataka', to: 'tamil-nadu', status: 'active', flow: 72 },
  { id: 'karnataka-kerala', from: 'karnataka', to: 'kerala', status: 'active', flow: 58 },
  { id: 'tamil-nadu-kerala', from: 'tamil-nadu', to: 'kerala', status: 'active', flow: 64 },
  { id: 'tamil-nadu-puducherry', from: 'tamil-nadu', to: 'puducherry', status: 'active', flow: 36 },
  { id: 'tamil-nadu-andhra-pradesh', from: 'tamil-nadu', to: 'andhra-pradesh', status: 'active', flow: 46 },
];

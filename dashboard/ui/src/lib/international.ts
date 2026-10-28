/**
 * The International Comparison page's content, transcribed from the working note "SAIDI and SAIFI
 * Benchmark Comparison" (international saidi_saifi (2).pdf, repo root) and the context text supplied
 * with it. Every figure, unit and qualification is the note's own wording, nothing here is computed.
 * The India row is a range of state-level regulatory benchmarks; every other row is observed national
 * performance, so the two are drawn differently and never presented as like-for-like.
 */

export interface Geography {
  name: string;
  /** "Status of figure", as the note words it */
  status: string;
  kind: 'benchmark-range' | 'observed';
  /** plotted values (a range for India); null = not reported in the selected source */
  saidi: [number, number] | number | null;
  saifi: [number, number] | number | null;
  /** the original values as written in the note */
  saidiText: string;
  saifiText: string;
  scope: string;
  /** null where the note leaves the cell as "-" */
  qualifications: string | null;
  source: { label: string; href: string | null } | null;
  /** the note's Year column, where filled */
  year: string | null;
}

export const SAIDI_UNIT = 'min/customer/year';
export const SAIFI_UNIT = 'interruptions/customer/year';

export const LEDE =
  'India’s state regulatory benchmarks for power interruptions, set beside the reliability other systems actually deliver. Reference points, not rankings.';

export const CONTEXT = [
  'India has made significant progress in addressing its electricity shortages, transitioning from a power-deficit country to a power-sufficient country in the past decade. However, a stage of power sufficiency does not easily translate into reliable and good quality power supply. India continues to face gaps in the standardisation, monitoring and reporting of quality and reliability of the power supply that reaches its consumers.',
  'This comparison places SAIDI and SAIFI standards across India’s most populous states alongside reliability levels reported in a selected set of international systems. The comparator countries were selected to provide a diverse but relevant international reference for India’s electricity distribution reliability, rather than on population size alone.',
];

/** Why each comparator was chosen, grouped as the context text groups them */
export const COMPARATOR_GROUPS: { countries: string[]; tag: string; why: string }[] = [
  {
    countries: ['Brazil'],
    tag: 'Large emerging economy',
    why: 'Large emerging economies facing challenges comparable to India, including expanding electricity demand, infrastructure constraints and variation in service quality.',
  },
  {
    countries: ['China', 'Indonesia'],
    tag: 'Populous Asian system',
    why: 'Populous Asian systems that, like India, serve large and geographically diverse populations with marked variation in reliability between urban and rural areas and across regions.',
  },
  {
    countries: ['Argentina', 'Mexico'],
    tag: 'Latin American federal',
    why: 'Latin American federal emerging economies with growing electricity demand, which have experienced supply interruptions linked to extreme weather and peak demand.',
  },
  {
    countries: ['United States'],
    tag: 'Mature, large & decentralised',
    why: 'A mature but geographically large and decentralised electricity system.',
  },
  {
    countries: ['Japan', 'Germany', 'Singapore'],
    tag: 'Mature, high reliability',
    why: 'Mature, high-reliability distribution systems: a reference point for stronger reliability performance.',
  },
];

export const CONTEXT_CLOSE =
  'Together, these countries provide a spectrum of system characteristics and development contexts against which India’s SAIDI and SAIFI benchmarks can be interpreted. This comparison is intended to be transparent reference points rather than rankings or prescriptions for what India’s standards should be.';

export const PURPOSE =
  'For Indian states, the note distinguishes between explicit regulatory standards/targets, reporting requirements, and cases where no verified numeric benchmark has yet been identified. For international comparators, the figures shown are observed system performance rather than regulatory standards.';

export const INDIA_STATES_COVERED =
  'Uttar Pradesh, Bihar, Maharashtra, West Bengal, Madhya Pradesh, Rajasthan, Tamil Nadu, Gujarat, Karnataka, Andhra Pradesh, Odisha and Telangana';

/** "Benchmark National Average for India", as the note states it */
export const INDIA_WEIGHTED = {
  saidi: 6600,
  saifi: 152,
  text: 'The weighted benchmark is about 6,600 minutes (110 hours) SAIDI and about 152 interruptions SAIFI per consumer per year. Tamil Nadu makes up half the result.',
};

const PSR = { label: 'PSR, 2024', href: 'https://psr-energy.com/docs/report_insight_gridIndicators.pdf' };
const PSR_QUAL = 'Observed national distribution performance, not a regulatory standard.';

/** India first, then the international rows by SAIDI, highest first */
export const GEOGRAPHIES: Geography[] = [
  {
    name: 'India',
    status: 'Range of available state-level regulatory benchmarks',
    kind: 'benchmark-range',
    saidi: [1200, 14400],
    saifi: [40, 300],
    saidiText: '1,200–14,400 minutes per consumer per year',
    saifiText: '40 to 300 interruptions/customer/year',
    scope:
      'Range derived from available numerical regulatory standards/targets identified from seven DISCOMs - AP (3), Rajasthan (3) and Tamil Nadu (1); not a national regulatory standard',
    qualifications:
      'Represents the minimum and maximum among identified state-level numerical benchmarks, not national minimum/ maximum performance. States without a verified numerical benchmark are excluded from the range.',
    source: null,
    year: null,
  },
  {
    name: 'Mexico',
    status: 'Actual observed performance',
    kind: 'observed',
    saidi: 1068,
    saifi: 0.4,
    saidiText: '1068 min/customer/year',
    saifiText: '0.4 interruptions/customer/year',
    scope: 'Distribution system',
    qualifications: PSR_QUAL,
    source: PSR,
    year: null,
  },
  {
    name: 'Argentina',
    status: 'Actual observed performance',
    kind: 'observed',
    saidi: 906,
    saifi: 7.3,
    saidiText: '906 min/customer/year',
    saifiText: '7.3 interruptions/customer/year',
    scope: 'Distribution system',
    qualifications: PSR_QUAL,
    source: PSR,
    year: null,
  },
  {
    name: 'Brazil',
    status: 'Actual observed performance',
    kind: 'observed',
    saidi: 618,
    saifi: 4.9,
    saidiText: '618 min/customer/year',
    saifiText: '4.9 interruptions/customer/year',
    scope: 'Distribution system',
    qualifications: PSR_QUAL,
    source: PSR,
    year: null,
  },
  {
    name: 'China',
    status: 'Actual observed performance',
    kind: 'observed',
    saidi: 403,
    saifi: 2.12,
    saidiText: '403 min/customer/year (6.71 h)',
    saifiText: '2.12 interruptions/customer/year',
    scope: 'National, 10 kV customers',
    qualifications: null,
    source: { label: 'Regulator (NEA)', href: null },
    year: '2024',
  },
  {
    name: 'Indonesia',
    status: 'Actual observed performance',
    kind: 'observed',
    saidi: 170,
    saifi: 1.41,
    saidiText: '170 min/customer/year (2.84 h)',
    saifiText: '1.41 interruptions/customer/year',
    scope: 'Rosseti group only; per point of supply',
    qualifications: null,
    source: { label: 'Utility annual report', href: null },
    year: '2023',
  },
  {
    name: 'United States',
    status: 'Actual observed performance',
    kind: 'observed',
    saidi: 131.6,
    saifi: 1.065,
    saidiText: '131.6 min/customer/year',
    saifiText: '1.065 times/year',
    scope: 'U.S. distribution utilities; IEEE methodology',
    qualifications: 'Figure shown excludes Major Event Days. EIA separately publishes all-events figures, which are materially higher.',
    source: { label: 'EIA Electric Power Annual, 2024', href: 'https://www.eia.gov/electricity/annual/' },
    year: null,
  },
  {
    name: 'Japan',
    status: 'Actual observed performance',
    kind: 'observed',
    saidi: 24,
    saifi: 0.13,
    saidiText: '24 min/customer/year',
    saifiText: '0.13 interruptions/customer/year',
    scope: 'Nationwide low-voltage customers',
    qualifications:
      'Reported total includes forced and planned interruption components. FY2024: SAIFI 0.11 forced + 0.02 planned; SAIDI 21 min forced + 3 min planned.',
    source: {
      label: 'OCCTO, FY2024',
      href: 'https://www.occto.or.jp/en/assets/en/information_disclosure/report_on_the_quality/of_electricity_supply_data_for_fy2024/2024_qualityofelectricity_260113.pdf',
    },
    year: null,
  },
  {
    name: 'Germany',
    status: 'Actual observed performance',
    kind: 'observed',
    saidi: 11.7,
    saifi: null,
    saidiText: '11.7 min/customer/year',
    saifiText: 'Not reported in selected source',
    scope: 'Electricity end customers covered by Bundesnetzagentur interruption reporting',
    qualifications: 'Planned interruptions and force majeure excluded; only interruptions >3 min counted.',
    source: {
      label: 'Bundesnetzagentur, 2024',
      href: 'https://www.bundesnetzagentur.de/EN/Areas/Energy/SecurityOfSupply/QualityOfSupply/start.html',
    },
    year: null,
  },
  {
    name: 'Singapore',
    status: 'Actual observed performance',
    kind: 'observed',
    saidi: 0.32,
    saifi: 0.022,
    saidiText: '0.32 min/customer/year',
    saifiText: '0.022 interruptions/customer/year',
    scope: 'National electricity system',
    qualifications: 'Compact city-state; useful as a reference point but structurally very different from an Indian state.',
    source: {
      label: 'EMA, 2025',
      href: 'https://www.ema.gov.sg/resources/statistics/system-average-interruption-duration-index-system-average-interruption-frequency-index',
    },
    year: null,
  },
];

export const NOTES: { head: string; short: string; body: string }[] = [
  {
    head: 'Annualisation',
    short: 'Non-annual Indian standards are converted to a year only to aid comparison.',
    body: 'Where an Indian regulation specifies a quarterly, half-yearly or other non-annual standard, the annual value is a simple arithmetic conversion provided only to aid visual comparison. It does not represent the legally applicable compliance period.',
  },
  {
    head: 'Comparability',
    short: 'Indian standards vs observed performance abroad: not like-for-like.',
    body: 'These figures are not strictly like-for-like. Indian entries principally describe regulatory standards, targets or reporting requirements, whereas the international entries describe observed performance. Jurisdictions also differ in their treatment of planned interruptions, major-event days / force majeure, minimum interruption duration, voltage levels, agricultural feeders and consumer coverage. These qualifications should remain visible alongside the numbers rather than being normalised away.',
  },
  {
    head: 'Interpretation',
    short: 'No verified benchmark doesn’t mean SAIDI/SAIFI go unmonitored.',
    body: "A blank or 'no verified numeric benchmark' entry is intentional. It indicates that the current first-pass review did not identify a defensible operative numeric standard in the core regulation/order reviewed. It should not be read as evidence that the regulator does not monitor SAIDI/SAIFI.",
  },
];

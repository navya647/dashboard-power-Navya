/**
 * The International Comparison page's content, transcribed from the working note "SAIDI and SAIFI
 * Benchmark Comparison" (international saidi_saifi(updated).pdf, repo root). Every figure, unit and
 * qualification is the note's own wording, nothing here is computed. The India row is a range of
 * state-level regulatory benchmarks; every other row is observed national performance, so the two
 * are drawn differently and never presented as like-for-like.
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
  qualifications: string;
  source: { label: string; href: string } | null;
}

export const SAIDI_UNIT = 'min/customer/year';
export const SAIFI_UNIT = 'interruptions/customer/year';

export const PURPOSE =
  'A transparent comparison of SAIDI and SAIFI provisions across the 12 most populous Indian states and selected international reference systems. For Indian states, it distinguishes between explicit regulatory standards or targets, reporting requirements, and cases where no verified numeric benchmark has yet been identified. For international comparators, the figures shown are observed system performance rather than regulatory standards.';

/** India first, then the international rows by SAIDI, highest first */
export const GEOGRAPHIES: Geography[] = [
  {
    name: 'India',
    status: 'Range of available state-level regulatory benchmarks',
    kind: 'benchmark-range',
    saidi: [600, 3600],
    saifi: [24, 144],
    saidiText: '600–3,600 min/customer/year',
    saifiText: '24–144 interruptions/customer/year',
    scope:
      'Range derived from available numerical regulatory standards/targets identified for Andhra Pradesh, Madhya Pradesh and Rajasthan; not a national regulatory standard.',
    qualifications:
      'Represents the minimum and maximum among identified state-level numerical benchmarks, not national minimum/maximum performance. States without a verified numerical benchmark are excluded from the range.',
    source: null,
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
    qualifications: 'Observed national distribution performance, not a regulatory standard.',
    source: { label: 'PSR, 2024', href: 'https://psr-energy.com/docs/report_insight_gridIndicators.pdf' },
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
  },
];

export interface IndiaStateRef {
  state: string;
  /** the framework reviewed, as the note names it */
  framework: string;
  href: string | null;
  /** the numeric benchmark identified, if any */
  benchmark?: string;
  note?: string;
}

/** The note's state-wise references for India, in its order */
export const INDIA_STATES: IndiaStateRef[] = [
  { state: 'Uttar Pradesh', framework: 'UPERC: current applicable regulatory framework', href: null, note: 'No specific document link yet. No numerical benchmark was verified in this pass.' },
  { state: 'Bihar', framework: 'BERC Standards of Performance Regulations, as amended', href: 'https://berc.co.in/images/pdf/Other-Order/ord-smp-47of16.pdf' },
  {
    state: 'Maharashtra',
    framework: 'MERC Electricity Supply Code and Standards of Performance Regulations, 2021',
    href: 'https://www.adanielectricity.com/-/media/ElectricityProject/ElectricityNew/CGRF/Regulations/Supply_Code_Regulations_2021_English.pdf',
  },
  { state: 'West Bengal', framework: 'WBERC official website', href: 'https://wberc.gov.in/', note: 'Order-level verification remains pending.' },
  {
    state: 'Madhya Pradesh',
    framework: 'MPERC State DISCOMs ARR and Retail Supply Tariff Order (FY2026-27 target)',
    href: 'https://mperc.in/uploads/petition_order_document/Final_State_DISCOMs_ARR_and_Retail_Supply_Tariff_Order_FY_2025-26_29_03_2025.pdf',
    benchmark: '60 h SAIDI / 90 SAIFI',
    note: 'The trajectory culminating in this target, for cities ≥1 lakh population.',
  },
  {
    state: 'Rajasthan',
    framework: 'RERC Standards of Performance framework',
    href: 'https://rerc.rajasthan.gov.in/Uploads/Ombudsman/WEB_MATERIAL_Ombudsman.pdf',
    benchmark: '30 h SAIDI / 20 SAIFI per 6 months',
    note: 'Annualised to 3,600 minutes and 40 interruptions.',
  },
  { state: 'Tamil Nadu', framework: 'TNERC Distribution Standards of Performance Regulations', href: 'https://indiankanoon.org/doc/12242195/' },
  {
    state: 'Gujarat',
    framework: 'GERC Standards of Performance Regulations, 2023',
    href: 'https://gercin.org/wp-content/uploads/2023/12/Notification-GERC-SoP-Regulations-2023.pdf',
  },
  { state: 'Karnataka', framework: 'KERC', href: null, note: 'Current framework/order-level verification remains pending; no specific source link yet.' },
  {
    state: 'Andhra Pradesh',
    framework: 'APERC Practice Directions / Standards of Performance framework',
    href: 'https://aperc.gov.in/admin/upload/15132334348530198715a321c1a82ace.pdf',
    benchmark: '600 / 1,200 / 2,400 min SAIDI · 24 / 72 / 144 SAIFI',
    note: 'For EHT, 33 kV industrial and 11 kV industrial categories respectively.',
  },
  { state: 'Odisha', framework: 'OERC Standards of Performance framework', href: 'https://orierc.org/OERCOLD/SOP_Amendment__Aug_19_.pdf' },
  {
    state: 'Telangana',
    framework: 'TGERC/TSERC Standards of Performance framework',
    href: 'https://www.tgerc.telangana.gov.in/file_upload/uploads/Regulations/Final/tserc/2016/Regulation5of2016.pdf',
  },
];

export const NOTES = [
  {
    head: 'Annualisation',
    body: 'Where an Indian regulation specifies a quarterly, half-yearly or other non-annual standard, the annual value is a simple arithmetic conversion provided only to aid visual comparison. It does not represent the legally applicable compliance period.',
  },
  {
    head: 'Comparability',
    body: 'These figures are not strictly like-for-like. Indian entries principally describe regulatory standards, targets or reporting requirements, whereas the international entries describe observed performance. Jurisdictions also differ in their treatment of planned interruptions, major-event days / force majeure, minimum interruption duration, voltage levels, agricultural feeders and consumer coverage.',
  },
  {
    head: 'Interpretation',
    body: "A blank or 'no verified numeric benchmark' entry is intentional. It indicates that the current first-pass review did not identify a defensible operative numeric standard in the core regulation/order reviewed. It should not be read as evidence that the regulator does not monitor SAIDI/SAIFI.",
  },
];

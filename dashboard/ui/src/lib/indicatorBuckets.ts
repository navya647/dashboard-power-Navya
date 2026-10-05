/** A presentation-only classification of every indicator into one of three top-level buckets —
 * Quality of Supply, Quality of Service, Safety — used to head the Indicator filter's dropdown.
 * Sits on top of the existing `category`/`type`/`indicator` metadata (reliability groups and the
 * SoP categories from sopCategories.ts) without renaming or altering any of it, and filtering
 * never looks at the bucket.
 *
 * Most categories map wholesale. Where a category mixes buckets ("Restoration, Disconnection &
 * Reconnection", "Billing, Collection & Losses", and SoP types that fall into the "Other"
 * category) the bucket is set per raw type, and where a single type still mixes buckets, per
 * indicator. Lookup order: indicator → type → category. Anything not matched (Losses, unclear
 * "Other" types) is left in UNMAPPED_BUCKET rather than guessed at. */

export const BUCKET_ORDER = ['Quality of Supply', 'Quality of Service', 'Safety'] as const;
export type Bucket = (typeof BUCKET_ORDER)[number];

/** Indicators not (yet) assigned a bucket — listed last, never blended into a real bucket. */
export const UNMAPPED_BUCKET = 'Other';

const SUPPLY: Bucket = 'Quality of Supply';
const SERVICE: Bucket = 'Quality of Service';
const SAFETY: Bucket = 'Safety';

const CATEGORY_TO_BUCKET: Record<string, Bucket> = {
  // reliability dataset groups (category and type are both the group name there)
  Reliability: SUPPLY,
  'Power Quality': SUPPLY,
  Service: SUPPLY, // Transformer Failure
  Consumer: SERVICE, // Billing Complaint Resolution

  // SoP categories that are a single bucket throughout
  'Supply Reliability, Quality & Outages': SUPPLY,
  'Connections, Load & Temporary Supply': SERVICE,
  Metering: SERVICE,
  'Consumer Service Changes & Administration': SERVICE,
  'Complaints, Grievances & Support': SERVICE,
  'Street Lighting': SERVICE,
  'Safety & Accidents': SAFETY,
};

const TYPE_TO_BUCKET: Record<string, Bucket> = {
  // "Restoration, Disconnection & Reconnection": restoring supply after an outage is Supply; the
  // administrative disconnect/reconnect processes are Service
  'Restoration of Power Supply': SUPPLY,
  'Restoration of Supply': SUPPLY,
  'Disconnection of supply': SERVICE,
  Reconnection: SERVICE,
  'Reconnection of Supply following Disconnection': SERVICE,
  'Restoration of a Disconnected Consumer': SERVICE,

  // "Billing, Collection & Losses": billing types are Service; "Losses" deliberately unmapped
  'Billing Complaints': SERVICE,
  'Billing Performance': SERVICE,
  'Consumer Bill Complaint': SERVICE,
  'Consumer Bills': SERVICE,
  'Delivery of Bills': SERVICE,

  // SoP types in the "Other" category whose meaning is unambiguous
  'System Interruptions': SUPPLY,
  'Power Supply Hours': SUPPLY,
  'Load Shedding': SUPPLY,
  'Billing Efficiency': SERVICE,
  'Collection Efficiency': SERVICE,
  'Consumer Grievance Response': SERVICE,
  'Extension of Load for Existing Consumers': SERVICE,
  'Shifting of Service Connection': SERVICE,
  'Shifting of Service': SERVICE,
  'Temporary Supply': SERVICE,
};

/** keyed `${type}::${indicator}` — for types whose own indicators span buckets */
const INDICATOR_TO_BUCKET: Record<string, Bucket> = {
  // meter replacement listed under "Restoration of Supply" is a metering service, not an outage
  'Restoration of Supply::Replacement of Faulty Meter (Urban)': SERVICE,
  'Restoration of Supply::Replacement of Faulty Meter (Rural)': SERVICE,
  'Restoration of Supply::Replacement of Burnt Meter (Urban)': SERVICE,
  'Restoration of Supply::Replacement of Burnt Meter (Rural)': SERVICE,
  'Restoration of Supply::Faulty/defective meters': SERVICE,
  'Restoration of Supply::Faulty meter': SERVICE,

  // "System Operations" (Other category)
  'System Operations::Distribution Transformer Failure Rate (Urban)': SUPPLY,
  'System Operations::Distribution Transformer Failure Rate (Rural)': SUPPLY,
  'System Operations::Voltage Regulation at Supply Point (LT)': SUPPLY,
  'System Operations::Voltage Regulation at Supply Point (HT)': SUPPLY,
  'System Operations::Voltage Regulation at Supply Point (EHT)': SUPPLY,
  'System Operations::Active Meter Health (Faulty Meter Rate)': SERVICE,

  // "Administrative Remedies" (Other category) — solatium is the administrative payment made after
  // an accident, a service response; Safety holds only the accident outcomes themselves
  'Administrative Remedies::Payment of Solatium (Accident Clear Cases)': SERVICE,
  'Administrative Remedies::Payment of Solatium (Other Accident Cases)': SERVICE,
  'Administrative Remedies::Refund of Deposits': SERVICE,
  'Administrative Remedies::Issue of Certificates': SERVICE,
};

export function bucketFor(category: string, type: string, indicator: string): Bucket | typeof UNMAPPED_BUCKET {
  return INDICATOR_TO_BUCKET[`${type}::${indicator}`] ?? TYPE_TO_BUCKET[type] ?? CATEGORY_TO_BUCKET[category] ?? UNMAPPED_BUCKET;
}

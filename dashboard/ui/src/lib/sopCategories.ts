/** Groups the SoP dataset's raw, never-normalized "Indicator Type" strings (see CLAUDE.md — the
 * `type`/`indicator` fields on SopIndicator are lifted verbatim per-DISCOM, no cross-DISCOM
 * merging) into a coarser "Indicator Category" for the SoP gallery's top-level filter. This
 * mapping is a fixed classification the raw Indicator Type text is looked up against — it does
 * NOT touch or rewrite the underlying `type`/`indicator` values themselves (e.g. the workbook typo
 * "Cosumer complaints" stays exactly as extracted; only its category bucket is assigned here). Any
 * raw type not present in this map (an extraction artifact, or a sheet variant not yet classified)
 * falls into OTHER_CATEGORY rather than being silently misfiled or dropped. */

export const SOP_CATEGORY_ORDER = [
  'Supply Reliability, Quality & Outages',
  'Restoration, Disconnection & Reconnection',
  'Connections, Load & Temporary Supply',
  'Metering',
  'Billing, Collection & Losses',
  'Consumer Service Changes & Administration',
  'Complaints, Grievances & Support',
  'Street Lighting',
  'Safety & Accidents',
] as const;

/** Fallback bucket for a raw Indicator Type not present in SOP_TYPE_TO_CATEGORY below — kept last
 * in any sorted category list, never blended into a "real" category. */
export const OTHER_CATEGORY = 'Other';

export const SOP_TYPE_TO_CATEGORY: Record<string, string> = {
  'Power Supply Quality': 'Supply Reliability, Quality & Outages',
  'Quality of Supply': 'Supply Reliability, Quality & Outages',
  'Reliability of Supply': 'Supply Reliability, Quality & Outages',
  'Scheduled Outage': 'Supply Reliability, Quality & Outages',
  'System Outages': 'Supply Reliability, Quality & Outages',
  'Voltage Issues': 'Supply Reliability, Quality & Outages',

  'Disconnection of supply': 'Restoration, Disconnection & Reconnection',
  Reconnection: 'Restoration, Disconnection & Reconnection',
  'Reconnection of Supply following Disconnection': 'Restoration, Disconnection & Reconnection',
  'Restoration of Power Supply': 'Restoration, Disconnection & Reconnection',
  'Restoration of Supply': 'Restoration, Disconnection & Reconnection',
  'Restoration of a Disconnected Consumer': 'Restoration, Disconnection & Reconnection',

  'Application for New Connection or Additional Load': 'Connections, Load & Temporary Supply',
  'New Connections / Load Changes': 'Connections, Load & Temporary Supply',
  'New connections': 'Connections, Load & Temporary Supply',
  'Provision of Supply': 'Connections, Load & Temporary Supply',
  'Release of New Connections or additional power': 'Connections, Load & Temporary Supply',
  'Temporary Connections': 'Connections, Load & Temporary Supply',

  'Complaints about Meters': 'Metering',
  'Meter Complaint': 'Metering',
  'Metering Complaints': 'Metering',
  'Metering Performance': 'Metering',

  'Billing Complaints': 'Billing, Collection & Losses',
  'Billing Performance': 'Billing, Collection & Losses',
  'Consumer Bill Complaint': 'Billing, Collection & Losses',
  'Consumer Bills': 'Billing, Collection & Losses',
  'Delivery of Bills': 'Billing, Collection & Losses',
  Losses: 'Billing, Collection & Losses',

  'Consumer Service Alterations': 'Consumer Service Changes & Administration',
  'No Dues Certificate': 'Consumer Service Changes & Administration',
  'Other Services': 'Consumer Service Changes & Administration',
  'Shifting of Meters/Service Lines': 'Consumer Service Changes & Administration',
  'Shifting of Services': 'Consumer Service Changes & Administration',
  'Transfer of Ownership and Conversion of service': 'Consumer Service Changes & Administration',
  'Transfer of ownership or change of category': 'Consumer Service Changes & Administration',

  'Cosumer complaints': 'Complaints, Grievances & Support',
  'Establishment of help desks': 'Complaints, Grievances & Support',

  'Street Light Complaints': 'Street Lighting',
  'Street Light Faults': 'Street Lighting',

  Accidents: 'Safety & Accidents',
};

export function categoryForType(type: string | null): string {
  if (!type) return OTHER_CATEGORY;
  return SOP_TYPE_TO_CATEGORY[type] ?? OTHER_CATEGORY;
}

/** Sorts category names by SOP_CATEGORY_ORDER, with OTHER_CATEGORY (or anything unrecognized)
 * pushed to the end rather than sorted alphabetically among the real categories. */
export function sortCategories(categories: string[]): string[] {
  const rank = (c: string) => {
    const i = SOP_CATEGORY_ORDER.indexOf(c as (typeof SOP_CATEGORY_ORDER)[number]);
    return i === -1 ? SOP_CATEGORY_ORDER.length : i;
  };
  return [...categories].sort((a, b) => rank(a) - rank(b));
}

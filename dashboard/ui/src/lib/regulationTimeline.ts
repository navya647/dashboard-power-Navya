/** When each state's SoP regulation changed within the dashboard's years. Standards and benchmarks
 * are set by the state's regulation, so they are the same for every DISCOM and change only when a
 * new regulation or amendment takes effect.
 *
 * Every date here is quoted from the workbooks themselves (the regulation-citation rows or the
 * standard text of the SoP / Common Indicators sheets) — nothing is looked up elsewhere:
 *   - Gujarat: "2005 Regulations apply up to 5 Dec 2023 and the 2023 Regulations apply from 6 Dec
 *     2023. FY 2023-24 must therefore be treated as a split-regulation year."
 *   - Maharashtra: "Regulations, 2021 (upto to 4th July 2024)" and "(First Amendment) Regulations,
 *     2024. (starts 5th July 2024)"
 *   - Rajasthan: "Regulations, 2021 came into force on 15 Apr 2021"
 * States not listed have no dated change recorded in the source; their standards are shown per
 * year as recorded. (Karnataka's sheets cite a 2022 regulation above their FY26 rows but give no
 * date — add it here once one is confirmed.) */

export interface RegulationEra {
  /** full name shown on the regulation panel */
  name: string;
  /** short form for the chart's year labels */
  short: string;
  /** ISO date the era starts / ends (inclusive); null = before / after the dashboard's years */
  from: string | null;
  to: string | null;
}

export const REGULATION_TIMELINE: Record<string, RegulationEra[]> = {
  Gujarat: [
    {
      name: "GERC SoP Regulations, 2005",
      short: "2005 regs",
      from: null,
      to: "2023-12-05",
    },
    {
      name: "GERC SoP Regulations, 2023",
      short: "2023 regs",
      from: "2023-12-06",
      to: null,
    },
  ],
  Maharashtra: [
    {
      name: "MERC Supply Code & SoP Regulations, 2021",
      short: "2021 regs",
      from: null,
      to: "2024-07-04",
    },
    {
      name: "MERC Regulations, 2021 — First Amendment, 2024",
      short: "2024 amdt",
      from: "2024-07-05",
      to: null,
    },
  ],
  Rajasthan: [
    {
      name: "RERC SoP Regulations, 2021",
      short: "2021 regs",
      from: "2021-04-15",
      to: null,
    },
  ],
};

/** 1 Apr – 31 Mar bounds of a "2023-24" fiscal year, as ISO dates */
function fyBounds(fy: string): [string, string] {
  const y = Number(fy.slice(0, 4));
  return [`${y}-04-01`, `${y + 1}-03-31`];
}

/** the eras in force at any point during a fiscal year (two in a split-regulation year) */
export function erasInYear(state: string, fy: string): RegulationEra[] {
  const eras = REGULATION_TIMELINE[state];
  if (!eras) return [];
  const [start, end] = fyBounds(fy);
  return eras.filter(
    (e) => (e.from == null || e.from <= end) && (e.to == null || e.to >= start),
  );
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2023-12-06" → "6 Dec 2023" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function eraDateRange(e: RegulationEra): string {
  if (e.from && e.to) return `${formatDate(e.from)} – ${formatDate(e.to)}`;
  if (e.to) return `To ${formatDate(e.to)}`;
  if (e.from) return `From ${formatDate(e.from)}`;
  return "Throughout";
}

import type { MasterRow } from './types';
import { defaultIndicator, indicatorStrength } from './master';

/** The user's per-DISCOM key indicators (29 Oct 2026), names exactly as in the master sheet.
 * State page: they head the Indicator dropdown, and the Primary ones are selected by default.
 * States not listed keep the sheet-derived default (defaultIndicator). */
type Priority = 'Primary' | 'Backup';
const PRIORITY: Record<string, Record<string, [string, Priority][]>> = {
  Rajasthan: {
    AVVNL: [
      ['System Average Interruption Duration Index (SAIDI)', 'Primary'],
      ['System Average Interruption Frequency Index (SAIFI)', 'Backup'],
      ['Billing complaint resolution – % within time limit', 'Backup'],
    ],
    JVVNL: [
      ['System Average Interruption Duration Index (SAIDI)', 'Primary'],
      ['System Average Interruption Frequency Index (SAIFI)', 'Backup'],
      ['Share of distribution / power transformer failure restorations handled within standard time (1.4)', 'Backup'],
    ],
    JdVVNL: [
      ['System Average Interruption Duration Index (SAIDI) – Quarterly', 'Primary'],
      ['System Average Interruption Frequency Index (SAIFI) – Quarterly', 'Backup'],
      ['11 kV feeders within sustained-interruption count benchmark – Industrial feeders', 'Backup'],
    ],
  },
  Odisha: {
    TPNODL: [
      ['Billing mistakes – % of bills, Overall standard', 'Primary'],
      ['Faulty meters as a share of meters in service', 'Primary'],
      ['Distribution transformer failure restoration – Rural areas, % within time limit', 'Backup'],
    ],
    TPCODL: [
      ['Billing mistakes – % of bills, Overall standard', 'Primary'],
      ['Faulty meters as a share of meters in service – Overall standard', 'Backup'],
      ['Distribution transformer failure restoration – Urban areas, % within time limit', 'Backup'],
    ],
    TPSODL: [
      ['Faulty meters as a share of meters in service – Overall standard', 'Primary'],
      ['Billing mistakes – % of bills, Overall standard', 'Backup'],
      ['Distribution transformer failure restoration – Rural areas, Overall standard, % within time limit', 'Backup'],
    ],
    TPWODL: [
      ['Distribution transformer failure restoration – Rural areas, % within time limit', 'Primary'],
      ['Distribution transformer failure restoration – Urban areas, % within time limit', 'Primary'],
      ['Billing mistakes – % of bills', 'Backup'],
    ],
  },
  'Andhra Pradesh': {
    APCPDCL: [
      ['Distribution transformer failure restoration – Cities and towns, Overall standard, % within time limit', 'Primary'],
      ['Distribution transformer failure restoration – Rural areas, Overall standard, % within time limit', 'Backup'],
      ['Normal fuse-off restoration time – Cities and towns, Overall standard, % within time limit', 'Backup'],
    ],
  },
};

const entries = (state: string, discoms: string[]) => {
  const byDiscom = PRIORITY[state] ?? {};
  const codes = discoms.length ? discoms : Object.keys(byDiscom);
  // primaries of every DISCOM first, then backups, each in the list's order
  const all = codes.flatMap((d) => byDiscom[d] ?? []);
  return [...all.filter(([, p]) => p === 'Primary'), ...all.filter(([, p]) => p === 'Backup')];
};

/** The key indicators for these DISCOMs (all of the state's when none picked), primaries first. */
export function pinnedIndicators(state: string, discoms: string[]): string[] {
  return [...new Set(entries(state, discoms).map(([i]) => i))];
}

/** What a state page selects by default: the listed Primary indicators of these DISCOMs (that the
 * rows have), else the sheet-derived single default. */
export function defaultIndicators(state: string, discoms: string[], rows: MasterRow[]): string[] {
  const have = new Set(rows.map((r) => r.indicator));
  const primary = [...new Set(entries(state, discoms).filter(([i, p]) => p === 'Primary' && have.has(i)).map(([i]) => i))];
  if (primary.length) return primary;
  const d = defaultIndicator(rows);
  return d ? [d] : [];
}

/** The DISCOM a state page opens on: the first one the list names, else the one whose strongest
 * indicator (indicatorStrength) is strongest, else the state's first. */
export function defaultDiscom(state: string, discomCodes: string[], rows: MasterRow[] = []): string | null {
  const listed = Object.keys(PRIORITY[state] ?? {}).find((d) => discomCodes.includes(d));
  if (listed) return listed;
  let best = discomCodes[0] ?? null;
  let bestScore = -1;
  for (const d of discomCodes) {
    const s = Math.max(-1, ...indicatorStrength(rows.filter((r) => r.discom_code === d)).values());
    if (s > bestScore) [best, bestScore] = [d, s];
  }
  return best;
}

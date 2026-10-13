import { directionForMeaning, type Direction } from './indicatorDirection';
import { isNA, textKey } from './regulationSources';

/** How a figure is to be read: what it measures (the source's own "reported meaning" text) and the
 * interpretation that follows from it. The two are built from the same text, so they cannot drift
 * apart, "Higher is better" is always said about the specific quantity the figure is, e.g. "the
 * higher the % of cases resolved within specified time/standard, the better". Nothing here is
 * invented: the measure is the source wording, the direction comes from `indicatorDirection.ts`. */
export interface Reading {
  /** the source's wording of what the reported figure is, first letter capitalised */
  measure: string;
  direction: Direction;
  /** full interpretation sentence */
  interpretation: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function readingFor(reportedMeaning: string | null | undefined): Reading | null {
  if (!reportedMeaning || isNA(reportedMeaning)) return null;
  const text = reportedMeaning.replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
  if (!text) return null;
  const direction = directionForMeaning(reportedMeaning);
  const phrase = text.charAt(0).toLowerCase() + text.slice(1);
  // "Zero cases exceeding…" / "Nine cases…" state a count, not a quantity to be raised or lowered
  const countsOnly = /^(zero|nine)\b/i.test(text);
  let interpretation: string;
  if (direction === 'direction_unknown') interpretation = 'Not established.';
  else if (countsOnly) interpretation = direction === 'higher_is_better' ? 'Higher is better.' : 'Lower is better.';
  else if (direction === 'higher_is_better') interpretation = `Higher is better, the higher the ${phrase}, the better.`;
  else interpretation = `Lower is better, the lower the ${phrase}, the better.`;
  return { measure: cap(text) + '.', direction, interpretation };
}

/** Distinct readings among `items`, each with the labels (DISCOMs) it applies to, in first-seen order. */
export function groupReadings(items: { meaning: string | null | undefined; who?: string }[]): { reading: Reading; who: string[] }[] {
  const groups = new Map<string, { reading: Reading; who: Set<string> }>();
  for (const it of items) {
    const reading = readingFor(it.meaning);
    if (!reading) continue;
    const k = textKey(reading.measure);
    const g = groups.get(k) ?? groups.set(k, { reading, who: new Set() }).get(k)!;
    if (it.who) g.who.add(it.who);
  }
  return [...groups.values()].map((g) => ({ reading: g.reading, who: [...g.who] }));
}

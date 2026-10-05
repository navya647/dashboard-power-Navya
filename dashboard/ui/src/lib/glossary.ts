import { definitionWithoutPeriod } from '@/components/IndicatorDefinition';
import { BUCKET_ORDER, bucketFor } from './indicatorBuckets';
import { isNA, textKey } from './regulationSources';
import { categoryForType } from './sopCategories';
import { sortAllCategories } from './unifiedIndicators';
import type { DiscomsData, StateSpecificData } from './types';

export interface GlossaryEntry {
  bucket: string;
  category: string;
  indicator: string;
  /** the source sheets' own "Indicator meaning", reporting period stripped; null when none recorded */
  definition: string | null;
}

/** One entry per indicator across every state in both performance datasets. Bucket and category
 * come from the same lookups the state page uses; the definition is the "Indicator meaning" text
 * most sheets give for that indicator (period removed, as in the definition pop-up) — never
 * written here, only picked from what the workbooks record. */
export function buildGlossary(discoms: DiscomsData | null, stateSpecific: StateSpecificData | null): GlossaryEntry[] {
  const groups = new Map<string, { bucket: string; category: string; indicator: string; defs: Map<string, { text: string; n: number }> }>();

  const add = (category: string, type: string, indicator: string, meaning: string | null | undefined) => {
    const key = `${category}::${indicator}`;
    let g = groups.get(key);
    if (!g) {
      g = { bucket: bucketFor(category, type, indicator), category, indicator, defs: new Map() };
      groups.set(key, g);
    }
    if (!meaning || isNA(meaning)) return;
    const text = definitionWithoutPeriod(meaning);
    if (!text) return;
    const k = textKey(text);
    const e = g.defs.get(k);
    if (e) e.n += 1;
    else g.defs.set(k, { text, n: 1 });
  };

  if (discoms) {
    for (const key of discoms.canonical_order) {
      const group = discoms.canonical_indicators[key].group;
      add(group, group, key, null);
      for (const d of discoms.discoms)
        for (const y of Object.values(d.years)) {
          const ind = y.indicators[key];
          if (ind) add(group, group, key, ind.indicator_meaning);
        }
    }
  }

  if (stateSpecific) {
    const rows = [
      ...stateSpecific.discoms.flatMap((d) => Object.values(d.years).flatMap((y) => y.indicators)),
      ...stateSpecific.frameworks.flatMap((f) => f.indicators),
    ];
    for (const r of rows) {
      // the SoP sheets' header row read in as data (see unifiedIndicators.ts)
      if (r.type === 'Indicator Type' && r.indicator === 'Indicator') continue;
      add(categoryForType(r.type), r.type ?? 'Uncategorized', r.indicator ?? 'Unnamed indicator', r.meaning);
    }
  }

  const bucketRank = (b: string) => {
    const i = (BUCKET_ORDER as readonly string[]).indexOf(b);
    return i === -1 ? BUCKET_ORDER.length : i;
  };
  const categoryOrder = sortAllCategories([...new Set([...groups.values()].map((g) => g.category))]);

  return [...groups.values()]
    .map((g) => {
      let best: { text: string; n: number } | null = null;
      for (const e of g.defs.values()) if (!best || e.n > best.n) best = e;
      const definition = best ? best.text.charAt(0).toUpperCase() + best.text.slice(1) + '.' : null;
      return { bucket: g.bucket, category: g.category, indicator: g.indicator, definition };
    })
    .sort(
      (a, b) =>
        bucketRank(a.bucket) - bucketRank(b.bucket) ||
        categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) ||
        a.indicator.localeCompare(b.indicator),
    );
}

/** Display label for an indicator name: names the source writes in all caps read as title case
 * ("VOLTAGE VARIATION" → "Voltage Variation"), except short single-word acronyms (SAIDI, CAIDI).
 * Display only — filtering, keys and the data keep the raw name. */
export function indicatorLabel(name: string): string {
  if (name !== name.toUpperCase() || (!/\s/.test(name) && name.length <= 5)) return name;
  return name.toLowerCase().replace(/(^|[\s/(-])(\p{L})/gu, (_, pre: string, c: string) => pre + c.toUpperCase());
}

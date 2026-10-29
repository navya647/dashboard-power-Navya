"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GlossaryEntry } from "@/lib/glossary";
import { FAMILY_DEFINITIONS } from "@/lib/familyDefinitions";

/** indicators per page on a phone, where the frame isn't fitted to the window height */
const MOBILE_PAGE = 10;

interface Group {
  id: string;
  category: string;
  entries: GlossaryEntry[];
}

/** Indicator category → its indicators, in the glossary's own (pre-sorted) order. */
function groupsByBucket(entries: GlossaryEntry[]): [string, Group[]][] {
  const byBucket = new Map<string, Map<string, Group>>();
  for (const e of entries) {
    const groups = byBucket.get(e.bucket) ?? byBucket.set(e.bucket, new Map()).get(e.bucket)!;
    const g = groups.get(e.bucket) ?? groups.set(e.bucket, { id: e.bucket, category: e.bucket, entries: [] }).get(e.bucket)!;
    g.entries.push(e);
  }
  return [...byBucket].map(([bucket, groups]) => [bucket, [...groups.values()]]);
}

/** `text` with every case-insensitive occurrence of `query` wrapped in <mark> */
function highlight(text: string, query: string): ReactNode {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>));
}

/** one indicator; in find results it also names its indicator category, since results span them */
function Term({ e, query, showWhere }: { e: GlossaryEntry; query: string; showWhere: boolean }) {
  return (
    <div className="gl-term">
      {showWhere && (
        <div className="gl-term-where">
          {e.bucket}
        </div>
      )}
      <dt>{highlight(e.indicator, query)}</dt>
      <dd>{e.definition ? highlight(e.definition, query) : "N/A"}</dd>
      <dd className="gl-states">
        <span className="gl-states-label">{e.states.length === 1 ? "State/UT" : "States/UTs"}</span>
        {e.states.length ? [...e.states].sort().map((s) => <span key={s} className="gl-pill">{s}</span>) : "N/A"}
      </dd>
      {e.readings.map((r) => (
        <dd className="gl-reading" key={r.measure}>
          <span>Reported as</span> {r.measure} <span>{r.direction === "direction_unknown" ? "Interpretation" : r.direction === "higher_is_better" ? "Higher is better" : "Lower is better"}</span>
          {r.direction === "direction_unknown" ? " Not established." : r.interpretation.replace(/^(Higher|Lower) is better/, "")}
        </dd>
      ))}
    </div>
  );
}

const termKey = (e: GlossaryEntry) => `${e.bucket}::${e.category}::${e.indicator}`;

/** the families a reader is most likely to look for, listed first in their tab in this order
 * (names exactly as in the sheet's `indicator_family`); every other family follows, the ones the
 * most states set first. Order only, nothing is hidden. */
const KEY_FAMILIES = [
  "SAIDI",
  "SAIFI",
  "CAIDI",
  "CAIFI",
  "MAIFI",
  "Hours of supply",
  "Voltage variation limit - LV",
  "Voltage complaint - no network expansion needed",
  "Distribution transformer failure - replacement & restoration",
  "Distribution transformer failure rate",
  "Restoration after LT-side DT fuse / consumer-end fault",
  "Restoration after HT-side DT fuse / drop-out fuse",
  "Power transformer / switchgear failure repair or replacement",
  "Power transformer failure - interim restoration",
  "Overhead line/cable breakdown restoration",
  "Advance notice of scheduled outage",
  "New connection - supply from existing network",
  "Reconnection after payment of dues",
  "Billing complaint resolution (unsplit)",
  "Billing complaint - no additional information required",
  "Billing complaint - additional information required",
  "Billing complaint acknowledgement",
  "Billing complaint - arithmetical error / non-receipt",
  "Billing complaint - site visit required",
  "Billing mistakes (share of bills)",
  "Bill delivery timeliness",
  "First bill after new connection",
  "Provisional/average billing duration",
  "Final bill on vacation / special reading",
  "Refund of excess amount billed",
  "Billing efficiency",
  "Defective (slow/fast/stuck) meter replacement",
  "Compensation payment",
  "Complaint registration & number issue",
  "24x7 call centre / help desk availability",
  "Fatal electrical accidents - human",
  "Fatal electrical accidents - animal",
  "Non-fatal electrical accidents - human",
  "Non-fatal electrical accidents - animal",
  "Electrical accidents (total)",
  "Fatal accident reporting",
];
const keyRank = (f: string) => {
  const i = KEY_FAMILIES.indexOf(f);
  return i < 0 ? KEY_FAMILIES.length : i;
};
const stateCount = (es: GlossaryEntry[]) => new Set(es.flatMap((e) => e.states)).size;

/** a family's one line in the list: the signed-off summary where there is one, otherwise the
 * sheet's own definition word for word (the most-used wording among its indicators) */
function familyDefinition(name: string, es: GlossaryEntry[]): string | null {
  if (FAMILY_DEFINITIONS[name]) return FAMILY_DEFINITIONS[name];
  const n = new Map<string, number>();
  for (const e of es) if (e.definition) n.set(e.definition, (n.get(e.definition) ?? 0) + 1);
  let best: string | null = null;
  let most = 0;
  for (const [t, c] of n) if (c > most) [best, most] = [t, c];
  return best;
}

/** short codes for the coverage strip; a state missing here falls back to its first two letters */
const STATE_CODES: Record<string, string> = {
  "Andhra Pradesh": "AP",
  Assam: "AS",
  Bihar: "BR",
  Gujarat: "GJ",
  Karnataka: "KA",
  "Madhya Pradesh": "MP",
  Maharashtra: "MH",
  Odisha: "OD",
  Rajasthan: "RJ",
  "Tamil Nadu": "TN",
  Telangana: "TG",
  "Uttar Pradesh": "UP",
  "West Bengal": "WB",
};
const stateCode = (s: string) => STATE_CODES[s] ?? s.slice(0, 2).toUpperCase();

/** every state in the sheet, one mark each, lit where `has` carries the indicator */
function Coverage({ all, has }: { all: string[]; has: string[] }) {
  const on = new Set(has);
  return (
    <div className="gl-cov" aria-label={`Set in: ${[...on].sort().join(", ")}`}>
      {all.map((s) => (
        <span key={s} className={`gl-cov-s${on.has(s) ? " is-on" : ""}`} title={s}>
          {stateCode(s)}
        </span>
      ))}
    </div>
  );
}

/** what the panel lists: a tab's indicator families (the sheet's `indicator_family`), or the
 * indicators themselves, each wording exactly as the sheet has it */
type Item = { kind: "family"; name: string; def: string | null; states: string[] } | { kind: "entry"; e: GlossaryEntry };
const itemKey = (it: Item) => (it.kind === "family" ? `family::${it.name}` : termKey(it.e));

/** one indicator family: opens to its indicators */
function FamilyTerm({ name, def, states, allStates, onOpen }: { name: string; def: string | null; states: string[]; allStates: string[]; onOpen?: () => void }) {
  return (
    <div className="gl-term gl-family" onClick={onOpen}>
      <dt>
        <button type="button" className="gl-family-open" onClick={onOpen} tabIndex={onOpen ? undefined : -1}>
          {name}
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 3.5 4.5 4.5L6 12.5" />
          </svg>
        </button>
      </dt>
      <dd>{def ?? "N/A"}</dd>
      <dd className="gl-family-foot">
        <Coverage all={allStates} has={states} />
      </dd>
    </div>
  );
}

function ItemView({ it, query, showWhere, allStates, onOpen }: { it: Item; query: string; showWhere: boolean; allStates: string[]; onOpen?: (name: string) => void }) {
  return it.kind === "family" ? (
    <FamilyTerm name={it.name} def={it.def} states={it.states} allStates={allStates} onOpen={onOpen && (() => onOpen(it.name))} />
  ) : (
    <Term e={it.e} query={query} showWhere={showWhere} />
  );
}

/** Splits terms of the given heights, laid out `cols` to a row, into pages that each fit
 * `avail` pixels; returns each page's first index. A row taller than a whole page still gets a
 * page of its own. */
function paginate(heights: number[], cols: number, rowGap: number, avail: number): number[] {
  const starts = [0];
  let used = 0;
  for (let i = 0; i < heights.length; i += cols) {
    const row = Math.max(...heights.slice(i, i + cols));
    if (used > 0 && used + rowGap + row > avail) {
      starts.push(i);
      used = row;
    } else {
      used += (used > 0 ? rowGap : 0) + row;
    }
  }
  return starts;
}

/** The glossary on one screen, no page scroll: indicator-category tabs, then that category's indicators with their definitions, two columns, paged
 * by measured height so each page fits the panel exactly. A find control at the end of the tab row
 * swaps the panel for matching indicators from every indicator category until it's cleared or closed. */
export default function GlossaryList({ entries }: { entries: GlossaryEntry[] }) {
  const all = useMemo(() => groupsByBucket(entries), [entries]);
  const [bucketIdx, setBucketIdx] = useState(0);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [family, setFamily] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [starts, setStarts] = useState<number[]>([0]);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLDListElement>(null);
  const findRef = useRef<HTMLInputElement>(null);

  const [bucket, groups] = all[Math.min(bucketIdx, all.length - 1)] ?? ["", []];
  const group = groups.find((g) => g.id === groupId) ?? groups[0];

  // find: matches in indicator names and definitions, across every indicator category
  const q = query.trim();
  const finding = q.length > 0;
  const results = useMemo(() => {
    const needle = q.toLowerCase();
    if (!needle) return [];
    return entries.filter(
      (e) =>
        e.indicator.toLowerCase().includes(needle) ||
        e.indicator.toLowerCase().includes(needle) ||
        (e.definition ?? "").toLowerCase().includes(needle),
    );
  }, [entries, q]);

  // what the panel shows: the find results while searching, otherwise the selected category
  const families = useMemo(() => {
    const m = new Map<string, GlossaryEntry[]>();
    for (const e of group?.entries ?? []) (m.get(e.category) ?? m.set(e.category, []).get(e.category)!).push(e);
    return [...m].sort(([a, ea], [b, eb]) => keyRank(a) - keyRank(b) || stateCount(eb) - stateCount(ea) || a.localeCompare(b));
  }, [group]);
  const familyEntries = family ? (families.find(([f]) => f === family)?.[1] ?? []) : [];
  const list: Item[] = finding
    ? results.map((e) => ({ kind: "entry", e }))
    : family
      ? familyEntries.map((e) => ({ kind: "entry", e }))
      : families.map(([name, es]) => ({ kind: "family", name, def: familyDefinition(name, es), states: [...new Set(es.flatMap((e) => e.states))] }));
  const mode = finding || family ? "gl-terms--words" : "gl-terms--index";
  const allStates = useMemo(() => [...new Set(entries.flatMap((e) => e.states))].sort(), [entries]);
  const pages = starts.length;
  const current = Math.min(page, pages - 1);
  const from = starts[current] ?? 0;
  const to = starts[current + 1] ?? list.length;
  const pageEntries = list.slice(from, to);

  // fill the window below the title, so the page itself stays one screen tall (desktop only)
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const fit = () => {
      if (window.matchMedia("(max-width: 900px)").matches) {
        el.style.height = "";
        return;
      }
      const top = el.getBoundingClientRect().top + window.scrollY;
      let h = window.innerHeight - top - 24;
      el.style.height = `${Math.max(340, h)}px`;
      // whatever still overflows (main's bottom padding, etc.) comes off the frame too, as on the
      // Accessibility page, so the page itself never scrolls
      const over = document.documentElement.scrollHeight - window.innerHeight;
      if (over > 0) {
        h -= over + 1;
        el.style.height = `${Math.max(340, h)}px`;
      }
    };
    fit();
    document.fonts?.ready.then(fit);
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // pages: every term in the list is laid out in a hidden copy at the same width
  // (.gl-terms--measure), and pages are cut where the next row would overflow the panel, so no
  // page ever needs a scrollbar, however long its definitions. Re-run on resize and font load.
  const listKey = finding ? `find:${q}` : `${group?.id ?? ""}::${family ?? ""}`;
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const measurer = measureRef.current;
    if (!panel || !measurer) return;
    const measure = () => {
      const n = measurer.children.length;
      if (window.matchMedia("(max-width: 900px)").matches) {
        setStarts(Array.from({ length: Math.max(1, Math.ceil(n / MOBILE_PAGE)) }, (_, i) => i * MOBILE_PAGE));
        return;
      }
      const head = panel.querySelector<HTMLElement>(".gl-panel-head");
      const cs = getComputedStyle(measurer);
      const cols = cs.gridTemplateColumns.split(" ").filter(Boolean).length || 1;
      const avail = panel.clientHeight - (head?.offsetHeight ?? 0) - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 4; // a few px spare for rounding
      const heights = Array.from(measurer.children, (c) => (c as HTMLElement).offsetHeight);
      const next = paginate(heights, cols, parseFloat(cs.rowGap) || 0, avail);
      setStarts((prev) => (prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next));
    };
    measure();
    document.fonts?.ready.then(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(panel);
    return () => ro.disconnect();
  }, [listKey]);

  function openFind() {
    setFindOpen(true);
    requestAnimationFrame(() => findRef.current?.focus());
  }
  function closeFind() {
    setFindOpen(false);
    setQuery("");
    setPage(0);
  }
  // deep link from an indicator card's ⓘ: /about/glossary?family=<indicator_family> opens that
  // family in its category tab
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get("family");
    if (!want) return;
    const i = all.findIndex(([, gs]) => gs.some((g) => g.entries.some((e) => e.category === want)));
    if (i < 0) return;
    setBucketIdx(i);
    setGroupId(all[i][1].find((g) => g.entries.some((e) => e.category === want))?.id ?? null);
    setFamily(want);
    setPage(0);
  }, [all]);

  function chooseBucket(i: number) {
    if (findOpen) closeFind();
    setBucketIdx(i);
    setGroupId(null);
    setFamily(null);
    setPage(0);
  }
  function openFamily(name: string) {
    setFamily(name);
    setPage(0);
  }
  function closeFamily() {
    setFamily(null);
    setPage(0);
  }
  function chooseGroup(id: string) {
    if (findOpen) closeFind();
    setGroupId(id);
    setPage(0);
  }

  const indexView = !finding && !family;
  const pager =
    pages > 1 ? (
      <div className="gl-pager">
        <span>
          {from + 1}–{to} of {list.length}
        </span>
        <button type="button" onClick={() => setPage(current - 1)} disabled={current === 0} aria-label="Previous page">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3.5 5.5 8l4.5 4.5" />
          </svg>
        </button>
        <button type="button" onClick={() => setPage(current + 1)} disabled={current >= pages - 1} aria-label="Next page">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 3.5 4.5 4.5L6 12.5" />
          </svg>
        </button>
      </div>
    ) : null;

  return (
    <div className="gl" ref={rootRef}>
      <div className="gl-bar">
        <div className="gl-tabs" role="tablist" aria-label="Indicator groups">
          {all.map(([b, gs], i) => {
            const on = i === bucketIdx && !finding;
            return (
              <button key={b} type="button" role="tab" aria-selected={on} className={`gl-tab${on ? " is-active" : ""}`} onClick={() => chooseBucket(i)}>
                {b}
                <span className="gl-tab-n">{new Set(gs.flatMap((g) => g.entries.map((e) => e.category))).size}</span>
              </button>
            );
          })}
        </div>
        {indexView && pager}
        <div className="gl-find">
          {findOpen ? (
            <label className="gl-find-field">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="m13 13 4 4" />
              </svg>
              <input
                ref={findRef}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") closeFind();
                }}
                placeholder="Find an indicator"
                aria-label="Find an indicator by name or definition"
              />
              <button type="button" className="gl-find-close" onClick={closeFind} aria-label="Close find">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </label>
          ) : (
            <button type="button" className="gl-find-open" onClick={openFind}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="m13 13 4 4" />
              </svg>
              <span>Find</span>
            </button>
          )}
        </div>
      </div>

      <div className="gl-body">
        {group && (
          <section className="gl-panel" ref={panelRef} aria-label={finding ? "Find results" : group.category}>
            <header className={`gl-panel-head${indexView ? " gl-panel-head--hidden" : ""}${!finding && family ? " gl-panel-head--family" : ""}`}>
              <h2 aria-live={finding ? "polite" : undefined}>
                {finding ? (
                  `${results.length} ${results.length === 1 ? "match" : "matches"} for “${q}”`
                ) : family ? (
                  <>
                    <button type="button" className="gl-back" onClick={closeFamily}>
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M10 3.5 5.5 8l4.5 4.5" />
                      </svg>
                      {group.category}
                    </button>
                    {family}
                  </>
                ) : (
                  group.category
                )}
              </h2>
              {!indexView && pager}
            </header>
            {finding && results.length === 0 ? (
              <p className="gl-find-empty">No indicator names or definitions contain “{q}”. Try a shorter word.</p>
            ) : (
              <dl className={`gl-terms ${mode}`} key={`${listKey}:${from}`}>
                {pageEntries.map((it) => (
                  <ItemView key={itemKey(it)} it={it} query={q} showWhere={finding} allStates={allStates} onOpen={openFamily} />
                ))}
              </dl>
            )}
            <dl className={`gl-terms gl-terms--measure ${mode}`} ref={measureRef} aria-hidden="true">
              {list.map((it) => (
                <ItemView key={itemKey(it)} it={it} query={q} showWhere={finding} allStates={allStates} />
              ))}
            </dl>
          </section>
        )}
      </div>
      {indexView && <p className="gl-note">Open an indicator to see how each state words and defines it.</p>}
    </div>
  );
}

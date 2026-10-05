"use client";

import { Fragment, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { indicatorLabel, type GlossaryEntry } from "@/lib/glossary";

/** indicators per page on a phone, where the frame isn't fitted to the window height */
const MOBILE_PAGE = 10;

interface Group {
  id: string;
  category: string;
  entries: GlossaryEntry[];
}

/** Bucket → category groups, in the glossary's own (pre-sorted) order. A category can span buckets
 * (indicatorBuckets.ts sets some per type/indicator), so a group is one bucket + category pair. */
function groupsByBucket(entries: GlossaryEntry[]): [string, Group[]][] {
  const byBucket = new Map<string, Map<string, Group>>();
  for (const e of entries) {
    const groups = byBucket.get(e.bucket) ?? byBucket.set(e.bucket, new Map()).get(e.bucket)!;
    const id = `${e.bucket}::${e.category}`;
    const g = groups.get(id) ?? groups.set(id, { id, category: e.category, entries: [] }).get(id)!;
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

/** one indicator; in find results it also names its bucket and category, since results span them */
function Term({ e, query, showWhere }: { e: GlossaryEntry; query: string; showWhere: boolean }) {
  return (
    <div className="gl-term">
      {showWhere && (
        <div className="gl-term-where">
          {e.bucket} · {e.category}
        </div>
      )}
      <dt>{highlight(indicatorLabel(e.indicator), query)}</dt>
      <dd>{e.definition ? highlight(e.definition, query) : "N/A"}</dd>
    </div>
  );
}

const termKey = (e: GlossaryEntry) => `${e.bucket}::${e.category}::${e.indicator}`;

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

/** The glossary on one screen, no page scroll: bucket tabs, that bucket's categories on the left,
 * and the selected category's indicators with their definitions on the right, two columns, paged
 * by measured height so each page fits the panel exactly. A find control at the end of the tab row
 * swaps the panel for matching indicators from every category until it's cleared or closed. */
export default function GlossaryList({ entries }: { entries: GlossaryEntry[] }) {
  const all = useMemo(() => groupsByBucket(entries), [entries]);
  const [bucketIdx, setBucketIdx] = useState(0);
  const [groupId, setGroupId] = useState<string | null>(null);
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

  // find: matches in indicator names and definitions, across every bucket and category
  const q = query.trim();
  const finding = q.length > 0;
  const results = useMemo(() => {
    const needle = q.toLowerCase();
    if (!needle) return [];
    return entries.filter(
      (e) =>
        indicatorLabel(e.indicator).toLowerCase().includes(needle) ||
        e.indicator.toLowerCase().includes(needle) ||
        (e.definition ?? "").toLowerCase().includes(needle),
    );
  }, [entries, q]);

  // what the panel shows: the find results while searching, otherwise the selected category
  const list = finding ? results : (group?.entries ?? []);
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
  // (.gl-terms--measure), and pages are cut where the next row would overflow the panel — so no
  // page ever needs a scrollbar, however long its definitions. Re-run on resize and font load.
  const listKey = finding ? `find:${q}` : (group?.id ?? "");
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
  function chooseBucket(i: number) {
    if (findOpen) closeFind();
    setBucketIdx(i);
    setGroupId(null);
    setPage(0);
  }
  function chooseGroup(id: string) {
    if (findOpen) closeFind();
    setGroupId(id);
    setPage(0);
  }

  return (
    <div className="gl" ref={rootRef}>
      <div className="gl-bar">
        <div className="gl-tabs" role="tablist" aria-label="Indicator groups">
          {all.map(([b, gs], i) => {
            const on = i === bucketIdx && !finding;
            return (
              <button key={b} type="button" role="tab" aria-selected={on} className={`gl-tab${on ? " is-active" : ""}`} onClick={() => chooseBucket(i)}>
                {b}
                <span className="gl-tab-n">{gs.reduce((n, g) => n + g.entries.length, 0)}</span>
              </button>
            );
          })}
        </div>
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
        <nav className="gl-cats" aria-label={`${bucket} categories`}>
          {groups.map((g) => {
            const on = g.id === group?.id && !finding;
            return (
              <button key={g.id} type="button" className={`gl-cat${on ? " is-active" : ""}`} aria-current={on ? "true" : undefined} onClick={() => chooseGroup(g.id)}>
                <span>{g.category}</span>
                <span className="gl-cat-n">{g.entries.length}</span>
              </button>
            );
          })}
        </nav>

        {group && (
          <section className="gl-panel" ref={panelRef} aria-label={finding ? "Find results" : group.category}>
            <header className="gl-panel-head">
              <h2 aria-live={finding ? "polite" : undefined}>
                {finding ? `${results.length} ${results.length === 1 ? "match" : "matches"} for “${q}”` : group.category}
              </h2>
              {pages > 1 && (
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
              )}
            </header>
            {finding && results.length === 0 ? (
              <p className="gl-find-empty">No indicator names or definitions contain “{q}”. Try a shorter word.</p>
            ) : (
              <dl className="gl-terms" key={`${listKey}:${from}`}>
                {pageEntries.map((e) => (
                  <Term key={termKey(e)} e={e} query={q} showWhere={finding} />
                ))}
              </dl>
            )}
            <dl className="gl-terms gl-terms--measure" ref={measureRef} aria-hidden="true">
              {list.map((e) => (
                <Term key={termKey(e)} e={e} query={q} showWhere={finding} />
              ))}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}

const SECTIONS = [
  { id: 'm-purpose', label: 'Purpose' },
  { id: 'm-scope', label: 'Scope' },
  { id: 'm-method', label: 'Method' },
  { id: 'm-data-rules', label: 'Data Rules' },
  { id: 'm-limitations', label: 'Limitations' },
  { id: 'm-sources', label: 'Sources' },
];

/** A slim sticky anchor rail — not a sidebar — for a page that's grown long enough to want
 * quick jumps. Plain in-page anchor links, so keyboard/screen-reader navigation and browser
 * back/forward all work for free without any custom scroll-tracking JS. Fewer links than the page
 * has sections: "Scope" covers both Current Coverage and What We Track, and Methodological
 * Principles (secondary, bottom-of-page material) isn't promoted to the rail at all. */
export default function MethodologyNav() {
  return (
    <nav className="method-nav" aria-label="Methodology sections">
      {SECTIONS.map((s) => (
        <a key={s.id} href={`#${s.id}`} className="method-nav-link">
          {s.label}
        </a>
      ))}
    </nav>
  );
}

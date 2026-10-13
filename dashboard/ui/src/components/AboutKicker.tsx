import Link from 'next/link';

/** The eyebrow over each page reached from the About page's cards (Glossary, At a glance,
 * International comparison): "About / <page>", with About linking back, those pages have no
 * sidebar entry of their own. Same .kicker look as every other page's eyebrow. */
export default function AboutKicker({ here }: { here: string }) {
  return (
    <div className="kicker about-crumb" style={{ marginTop: 0 }}>
      <span className="bar" />
      <span className="label">
        <Link href="/about">About</Link>
        <span className="about-crumb-sep" aria-hidden="true">
          /
        </span>
        {here}
      </span>
    </div>
  );
}

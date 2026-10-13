'use client';

import { useEffect, type PointerEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LANDING_HREF, MAP_HREF } from '@/lib/routes';

/** The About page. Same shell as the Methodology and Accessibility pages (`methodology-page
 * about-page`: kicker, hero title, then wide ruled sections). Text is the project's About copy
 * (about_content_updated.docx), kept to purpose and relevance: coverage, definitions and sources
 * live on the Methodology and Accessibility pages, linked at the foot. The four ways in are the
 * only boxes. */

/** ACPET's Theory of Change. Left empty until the address is supplied; the line is only drawn when
 * it is set, so there is never a link that goes nowhere. */
const THEORY_OF_CHANGE_HREF = 'https://acpet.ashoka.edu.in/wp-content/uploads/2025/12/Theory-of-change_Final_People-centric-Power-Reform.jpg';

const CARDS = [
  {
    href: MAP_HREF,
    title: 'Explore the map',
    body: 'Pick a state and see how its DISCOMs perform.',
    // a folded map
    icon: <path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2-6-2ZM9 4.5v13M15 6.5v13" />,
  },
  {
    href: '/glance',
    title: 'Quick comparison',
    body: 'One indicator, every DISCOM, side by side.',
    // sorted bars, as the page itself draws them
    icon: <path d="M4 5h13M4 10h9M4 15h15M4 20h6" />,
  },
  {
    href: '/about/international',
    title: 'International comparison',
    body: 'SAIDI and SAIFI, India and the world.',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5s1.1-6.1 3.4-8.5Z" />
      </>
    ),
  },
  {
    href: '/about/glossary',
    title: 'Glossary',
    body: 'Every indicator, defined.',
    // an open book with lines of text
    icon: <path d="M12 6.5v13M12 6.5C10.5 5 8.3 4.5 4 4.5v13c4.3 0 6.5.5 8 2 1.5-1.5 3.7-2 8-2v-13c-4.3 0-6.5.5-8 2ZM6.5 8.5h3M6.5 11.5h3M14.5 8.5h3M14.5 11.5h3" />,
  },
];

/** the pages that back the data, linked at the foot */
const BACKING = [
  { href: '/methodology', head: 'Methodology', body: 'How indicators are defined, compared and interpreted.' },
  { href: '/accessibility', head: 'Accessibility', body: 'The availability of standards and reported data.' },
];

const SOURCES = ['Regulatory standards', 'Utility reports', 'Other public documents'];
const DIMENSIONS = ['Supply quality', 'Reliability', 'Service delivery', 'Safety'];

/** y of each row's centre in the diagram's 120 x 176 wire boxes (44px rows, three and four rows centred) */
const SOURCE_Y = [44, 88, 132];
const DIMENSION_Y = [22, 66, 110, 154];

const AUDIENCE = ['Consumers', 'Utilities', 'Regulators', 'Policymakers', 'Researchers', 'Civil society'];

/** ACPET's three directions, in its own "from … to …" wording (acpet.ashoka.edu.in/electricity-commons) */
const REFORM = [
  { head: 'Future-ready networks', from: 'Grid growth', to: 'Resilience and reliability' },
  { head: 'Participatory energy systems', from: 'Delivering power', to: 'Empowering people' },
  { head: 'Consumers as prosumers', from: 'One-way supply', to: 'Two-way collaboration' },
];


const Arrow = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8h9.5M8.5 4l4 4-4 4" />
  </svg>
);

const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

/** The mirror of the landing view's scroll-down hand-off (HeroSection): an upward wheel / swipe /
 * "scroll up" key with the About page already at its top goes back to the landing view. A wheel
 * gesture only counts if it began at the top (after a quiet gap), so the momentum of scrolling
 * up the page can never carry straight on into a navigation. Desktop only, like the hand-off. */
const MOBILE_QUERY = '(max-width: 980px)'; // same breakpoint as HeroSection
const BACK_WHEEL_PX = 40;
const BACK_GESTURE_GAP_MS = 250;
function useScrollUpToLanding() {
  const router = useRouter();
  useEffect(() => {
    const desktop = () => !window.matchMedia(MOBILE_QUERY).matches;
    let last = 0;
    let armed = false;
    let accum = 0;
    let leaving = false;
    const leave = () => {
      if (leaving) return;
      leaving = true;
      router.push(LANDING_HREF);
    };
    const atTop = () => window.scrollY <= 0;
    const onWheel = (e: WheelEvent) => {
      if (!desktop() || leaving) return;
      const now = performance.now();
      if (now - last > BACK_GESTURE_GAP_MS) {
        armed = atTop(); // a new gesture: it may navigate only if it started at the top
        accum = 0;
      }
      last = now;
      if (!armed || !atTop()) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      if (dy >= 0) {
        accum = 0;
        return;
      }
      accum += -dy;
      if (accum >= BACK_WHEEL_PX) leave();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!desktop() || leaving || !atTop() || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const onButton = t?.tagName === 'BUTTON';
      if (['ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey && !onButton)) leave();
    };
    let touchY: number | null = null;
    let touchAtTop = false;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
      touchAtTop = atTop();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!desktop() || leaving || touchY == null) return;
      const dy = (e.changedTouches[0]?.clientY ?? touchY) - touchY;
      touchY = null;
      if (touchAtTop && atTop() && dy > 40) leave();
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [router]);
}

/** the card under the pointer gets a soft spotlight that follows it */
function spot(e: PointerEvent<HTMLAnchorElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
}

export default function AboutView() {
  useScrollUpToLanding();

  return (
    <div className="methodology-page about-page abt">
      <div className="kicker" style={{ marginTop: 0 }}>
        <span className="bar" />
        <span className="label">About the dashboard</span>
      </div>
      <h1 className="method-hero-title">From Electricity Access to Electricity Quality</h1>

      <section className="abt-hero" aria-label="Introduction">
        <p className="abt-lead">
          India has expanded electricity access and strengthened supply. Attention is now also on the quality of the electricity consumers
          receive: <b>reliable, good quality, safe and supported by responsive services</b>. The dashboard is a systematic, transparent
          resource to enable comparison, support improvements in electricity distribution services, and inform quality-linked tariff design.
        </p>
        <div className="abt-flow" role="group" aria-label="How the dashboard brings evidence together">
          <p className="abt-flow-label abt-flow-label--a">Published across</p>
          <p className="abt-flow-label abt-flow-label--b">Brought together here</p>
          <p className="abt-flow-label abt-flow-label--c">Across four dimensions</p>
          <ul className="abt-flow-list abt-flow-list--a">
            {SOURCES.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <svg className="abt-wires abt-wires--a" viewBox="0 0 120 176" preserveAspectRatio="none" aria-hidden="true">
            {SOURCE_Y.map((y) => (
              <path key={y} d={`M0 ${y} C60 ${y} 60 88 120 88`} />
            ))}
          </svg>
          <p className="abt-flow-hub">
            <span>Standards of Performance</span>
            <span>
              <i>+</i> Reported data
            </span>
          </p>
          <svg className="abt-wires abt-wires--b" viewBox="0 0 120 176" preserveAspectRatio="none" aria-hidden="true">
            {DIMENSION_Y.map((y) => (
              <path key={y} d={`M0 88 C60 88 60 ${y} 120 ${y}`} />
            ))}
          </svg>
          <ul className="abt-flow-list abt-flow-list--c">
            {DIMENSIONS.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      </section>

      <nav className="abt-explore" aria-label="Explore the dashboard">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="abt-go" onPointerMove={spot}>
            <span className="abt-go-icon" aria-hidden="true">
              <Icon>{c.icon}</Icon>
            </span>
            <span className="abt-go-title">{c.title}</span>
            <span className="abt-go-body">{c.body}</span>
            <span className="abt-go-arrow">
              <Arrow />
            </span>
          </Link>
        ))}
      </nav>

      <div className="abt-pair">
        <section aria-label="Who it is for">
          <h2 className="abt-title-sm">Who it is for</h2>
          <ul className="abt-aud" aria-label="Audience">
            {AUDIENCE.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p className="abt-body">
            A public resource for everyone working on India’s power sector: a quick view of performance, and a starting point for deeper
            analysis.
          </p>
        </section>
        <section aria-label="Part of a people-centric transition">
          <h2 className="abt-title-sm">Part of a people-centric transition</h2>
          <ul className="abt-shifts">
            {REFORM.map((r) => (
              <li key={r.head}>
                <span className="abt-shift-head">{r.head}</span>
                <span className="abt-shift-row">
                  <span>{r.from}</span>
                  <Arrow />
                  <b>{r.to}</b>
                </span>
              </li>
            ))}
          </ul>
          <p className="abt-body">The dashboard is part of ACPET’s People-centric Power Reform work.</p>
          {THEORY_OF_CHANGE_HREF && (
            <a className="abt-toc" href={THEORY_OF_CHANGE_HREF} target="_blank" rel="noopener noreferrer">
              Explore ACPET’s Theory of Change
              <Arrow />
            </a>
          )}
        </section>
      </div>

      <section className="abt-sec" aria-label="Want to understand the data?">
        <h2 className="abt-title-sm">Want to understand the data?</h2>
        <nav className="abt-backing" aria-label="Behind the dashboard">
          {BACKING.map((b) => (
            <Link key={b.href} href={b.href} className="abt-back">
              <span className="abt-back-head">{b.head}</span>
              <span className="abt-back-body">{b.body}</span>
              <Arrow />
            </Link>
          ))}
        </nav>
      </section>
    </div>
  );
}

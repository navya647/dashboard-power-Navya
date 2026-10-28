'use client';

import type { PointerEvent, ReactNode } from 'react';
import Link from 'next/link';
import { MAP_HREF } from '@/lib/routes';

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
  { href: '/methodology', head: 'Methodology', body: 'How the evidence base was built: one figure followed from regulation to verdict, and the limits.' },
  { href: '/accessibility', head: 'Accessibility', body: 'Regulatory and data transparency: which states publish their SoP regulations and performance data, and how accessible it is.' },
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

/** the card under the pointer gets a soft spotlight that follows it */
function spot(e: PointerEvent<HTMLAnchorElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
}

export default function AboutView() {
  return (
    <div className="methodology-page about-page abt">
      <div className="kicker" style={{ marginTop: 0 }}>
        <span className="bar" />
        <span className="label">About the dashboard</span>
      </div>
      <h1 className="method-hero-title">From Electricity Access to Electricity Quality</h1>

      <section className="abt-hero" aria-label="Introduction">
        <div className="abt-intro">
          <span className="abt-badge">A public-interest tool</span>
          <p className="abt-statement-text">
            Consumers depend not only on electricity being available, but on its <em>quality, reliability and stability</em>.
          </p>
          <div className="abt-notes">
            <div className="abt-note">
              <h2 className="abt-intro-head">Background and context</h2>
              <p className="abt-lead">
                India has made significant progress in expanding electricity access, generation capacity and network reach. Yet information
                on power quality is fragmented across utilities, regulators, central entities and consumer groups.
              </p>
            </div>
            <div className="abt-note">
              <h2 className="abt-intro-head">Closing the information gap</h2>
              <p className="abt-lead">
                The dashboard brings that information together in one place, to support evidence-based policymaking, institutional accountability,
                compliance assessment and targeted improvements in electricity distribution.
              </p>
            </div>
          </div>
        </div>
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

      <section className="abt-band" aria-label="Who it is for">
        <div className="abt-band-head">
          <h2 className="abt-title-sm">Who it is for</h2>
          <p className="abt-body">
            A public-interest tool for everyone with a stake in India’s power sector: a consolidated view of how distribution utilities
            perform against their standards, and a transparent starting point for deeper analysis.
          </p>
        </div>
        <ul className="abt-aud" aria-label="Audience">
          {AUDIENCE.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>

      <section className="abt-band" aria-label="Part of a people-centric transition">
        <div className="abt-band-head">
          <h2 className="abt-title-sm">Part of a people-centric transition</h2>
          <p className="abt-body">
            This dashboard is an initiative under the Ashoka Centre for a People-centric Energy Transition’s (ACPET) Theory of Change for a People-centric Power Reform.
            {THEORY_OF_CHANGE_HREF && (
              <a className="abt-toc" href={THEORY_OF_CHANGE_HREF} target="_blank" rel="noopener noreferrer">
                Explore ACPET’s Theory of Change
                <Arrow />
              </a>
            )}
          </p>
        </div>
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
      </section>

      <section className="abt-band" aria-label="Method and transparency">
        <div className="abt-band-head">
          <h2 className="abt-title-sm">Method and transparency</h2>
          <p className="abt-body">How the evidence was assembled, and how openly each state publishes it.</p>
        </div>
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

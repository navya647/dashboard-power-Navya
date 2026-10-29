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
    body: 'View DISCOM performance by state/UT or compare across states/UTs.',
    // a folded map
    icon: <path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2-6-2ZM9 4.5v13M15 6.5v13" />,
  },
  {
    href: '/glance',
    title: 'Quick comparison',
    body: 'Compare DISCOM performance across key indicators and reporting years.',
    // sorted bars, as the page itself draws them
    icon: <path d="M4 5h13M4 10h9M4 15h15M4 20h6" />,
  },
  {
    href: '/about/international',
    title: 'International comparison',
    body: 'Explore India’s electricity supply reliability in an international context.',
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
    body: 'Understand the indicators and terminology used across the dashboard.',
    // an open book with lines of text
    icon: <path d="M12 6.5v13M12 6.5C10.5 5 8.3 4.5 4 4.5v13c4.3 0 6.5.5 8 2 1.5-1.5 3.7-2 8-2v-13c-4.3 0-6.5.5-8 2ZM6.5 8.5h3M6.5 11.5h3M14.5 8.5h3M14.5 11.5h3" />,
  },
];

/** the pages that back the data, linked at the foot */
const BACKING = [
  {
    href: '/methodology', head: 'Methodology', body: 'How regulatory standards and reported performance data are compiled, analysed and compared.',
    // the sidebar's Methodology icon (an open book)
    icon: <path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3Z" />,
  },
  {
    href: '/accessibility', head: 'Accessibility', body: 'Explore the availability, transparency and accessibility of regulatory standards and DISCOM performance data.',
    // the sidebar's Accessibility icon (a checked document)
    icon: <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v4a2 2 0 0 0 2 2h4M9 15l2 2 4-4" />,
  },
];

/** the About diagram's three groups */
const CATEGORIES = ['Quality & Reliability of Supply', 'Quality of Service', 'Safety'];
const EVIDENCE = [
  { source: 'Regulatory notifications', gives: 'Applicable standards' },
  { source: 'DISCOM performance reports', gives: 'Reported performance' },
];
const STRUCTURE = ['State-wise Exploration', 'Inter-State DISCOM Comparisons', 'Historical Trends', 'Evidence Accessibility'];


/** who the dashboard is for, each with a line icon in the cards' style (decorative, not links) */
const AUDIENCE: { name: string; icon: ReactNode }[] = [
  // a home with a lit bulb inside
  { name: 'Consumers', icon: <path d="M3.5 11 12 4l8.5 7M5.5 9.5V20h13V9.5M12 11.5a2.5 2.5 0 0 0-1.5 4.5v1.5h3V16a2.5 2.5 0 0 0-1.5-4.5Z" /> },
  // a transmission pylon
  { name: 'Utilities', icon: <path d="M12 3 8 21M12 3l4 18M6 8h12M7.5 13h9M9.7 8 14.6 13M14.3 8 9.4 13M5 8l1 2M19 8l-1 2" /> },
  // balance scales
  { name: 'Regulators', icon: <path d="M12 4v16M8 20h8M5 7h14M7 7l-3 6a3 3 0 0 0 6 0L7 7ZM17 7l-3 6a3 3 0 0 0 6 0l-3-6Z" /> },
  // a columned public building
  { name: 'Policymakers', icon: <path d="M3.5 9 12 4l8.5 5M4.5 20h15M6 10v7.5M10 10v7.5M14 10v7.5M18 10v7.5M3.5 20h17" /> },
  // a magnifier over rising bars
  { name: 'Researchers', icon: <path d="M4 19V14M8 19v-7M12 19v-4M14.5 9.5a4 4 0 1 0 5.66-5.66 4 4 0 0 0-5.66 5.66ZM20.2 9.5l1.3 1.3" /> },
  // a group of people
  { name: 'Civil society', icon: <path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 20v-1.5a6 6 0 0 1 12 0V20M5.5 11.5a2.2 2.2 0 1 0 0-4.4M3 18v-1a4 4 0 0 1 2.5-3.7M18.5 11.5a2.2 2.2 0 1 1 0-4.4M21 18v-1a4 4 0 0 0-2.5-3.7" /> },
];

/** ACPET's three directions, in its own "from … to …" wording (acpet.ashoka.edu.in/electricity-commons) */
const REFORM: { head: string; from: string; to: string; icon: ReactNode }[] = [
  // a network of connected nodes
  {
    head: 'Future-ready networks', from: 'Grid growth', to: 'Resilience and reliability',
    icon: <path d="M12 5.5a2 2 0 1 0 0-.01M5 18.5a2 2 0 1 0 0-.01M19 18.5a2 2 0 1 0 0-.01M12 7.5v4M12 11.5l-5.6 5.6M12 11.5l5.6 5.6M7 18.5h10" />,
  },
  // a person beside a lightning bolt
  {
    head: 'Participatory energy systems', from: 'Delivering power', to: 'Empowering people',
    icon: <path d="M8.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20v-1.5a5.5 5.5 0 0 1 9.5-3.8M17 9l-3 5h3.5l-2 6 4.5-7h-3.5l1.5-4Z" />,
  },
  // two-way arrows between home and grid
  {
    head: 'Consumers as prosumers', from: 'One-way supply', to: 'Two-way collaboration',
    icon: <path d="M4 8h13M14 5l3 3-3 3M20 16H7M10 13l-3 3 3 3" />,
  },
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
      <h1 className="method-hero-title abt-title">About the India Power Supply, Service Quality and Safety Dashboard</h1>

      <section className="abt-hero" aria-label="Introduction">
        <div className="abt-intro">
          <div className="abt-notes">
            <div className="abt-note">
              <h2 className="abt-intro-head">Background and context</h2>
              <p className="abt-lead">
                India has made significant progress in expanding electricity access and strengthening its power infrastructure. However,
                ensuring reliable, good-quality electricity supply and responsive consumer services remains an important priority. Information
                on these dimensions is often fragmented across utilities and regulatory institutions. This makes it difficult to compare performance, identify gaps and
                assess improvements over time.
              </p>
            </div>
            <div className="abt-note">
              <h2 className="abt-intro-head">Closing the information gap</h2>
              <p className="abt-lead">
                The dashboard brings together publicly available regulatory standards and reported DISCOM performance data to enable comparisons,
                identify performance gaps, assess compliance where data permits, and support evidence-based improvements in electricity
                distribution services.
              </p>
            </div>
          </div>
        </div>
        {/* what the dashboard covers, as three labelled groups (no flow between them): the indicator
            categories, the evidence each source supplies, and how the data is organised */}
        <div className="vf" role="group" aria-label="What the dashboard covers">
          <div className="vf-group">
            <p className="vf-label">Indicator categories</p>
            <ul className="vf-row vf-row--3">
              {CATEGORIES.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          <div className="vf-group vf-group--evidence">
            <p className="vf-label">Evidence base</p>
            <ul className="vf-pairs">
              {EVIDENCE.map((e) => (
                <li key={e.source}>
                  <span>{e.source}</span>
                  <Arrow />
                  <b>{e.gives}</b>
                </li>
              ))}
            </ul>
          </div>
          <div className="vf-group">
            <p className="vf-label">Dashboard structure</p>
            <ul className="vf-row vf-row--2">
              {STRUCTURE.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
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
            A public-interest tool for consumers, utilities, regulators, policymakers, researchers and civil society, providing accessible
            information to support transparency, accountability and informed decision-making in electricity distribution.
          </p>
        </div>
        <ul className="abt-aud" aria-label="Audience">
          {AUDIENCE.map((x) => (
            <li key={x.name}>
              <span className="abt-aud-icon">
                <Icon>{x.icon}</Icon>
              </span>
              {x.name}
            </li>
          ))}
        </ul>
      </section>

      <section className="abt-band" aria-label="Part of a people-centric transition">
        <div className="abt-band-head">
          <h2 className="abt-title-sm">Part of a people-centric transition</h2>
          <p className="abt-body">
            The dashboard contributes to the Ashoka Centre for a People-centric Energy Transition’s (ACPET) broader vision of People-centric Power Reform by placing consumer outcomes, reliable electricity
            supply and institutional accountability at the centre of electricity distribution reforms.
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
              <span className="abt-aud-icon abt-shift-icon">
                <Icon>{r.icon}</Icon>
              </span>
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
          <p className="abt-body">Explore the dashboard’s methodology, limitations, and the availability and accessibility of its underlying evidence.</p>
        </div>
        <nav className="abt-backing" aria-label="Behind the dashboard">
          {BACKING.map((b) => (
            <Link key={b.href} href={b.href} className="abt-back">
              <span className="abt-aud-icon abt-back-icon">
                <Icon>{b.icon}</Icon>
              </span>
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

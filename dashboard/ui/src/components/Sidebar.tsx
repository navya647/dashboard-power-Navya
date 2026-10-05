'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import { MAP_HREF } from '@/lib/routes';

// Placeholder icons — stand-ins for real ones, swap the path data out once real iconography for
// each section is settled rather than treating these as final.
const NAV = [
  // Home goes to the map explorer, never the landing hero (MAP_HREF, shared with every other
  // back-to-the-map control)
  {
    href: MAP_HREF,
    label: 'Home',
    icon: <path d="M4 11 12 4l8 7M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9M10 20v-6h4v6" />,
  },
  {
    href: '/glance',
    label: 'At a glance',
    // sorted bars: one indicator, every DISCOM side by side
    icon: <path d="M4 5h13M4 10h9M4 15h15M4 20h6" />,
  },
  {
    href: '/about',
    label: 'About',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8h.01M11 11.5h1v5" />
      </>
    ),
  },
  {
    href: '/accessibility',
    label: 'Accessibility',
    // document with a tick: is the data published, and is it usable (public + machine-readable)
    icon: <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7ZM14 2v4a2 2 0 0 0 2 2h4M9 15l2 2 4-4" />,
  },
  {
    href: '/methodology',
    label: 'Methodology',
    // open book: how the data was compiled, a reference
    icon: <path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3Z" />,
  },
];

/** Always-visible, non-collapsible: a permanent part of the layout, not a drawer — there is
 * deliberately no toggle/close control (see layout.css, which reserves the sidebar's width in
 * main.app-main's margin unconditionally rather than behind any open/closed state). */
export default function Sidebar() {
  const pathname = usePathname();
  // the ACPET logo is never in the sidebar: every page carries it top right instead (the home page
  // in HeroSection, the rest via PageLogo), so it stays in one place across the site. Its look is
  // the home page map view's on every page (layout.css), background and nav placement included;
  // only the landing hero's sunset tint is home-page-only.
  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <nav className="sidenav">
          {NAV.map((item) => {
            const active = item.href === MAP_HREF ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={active ? 'active' : ''}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  {item.icon}
                </svg>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

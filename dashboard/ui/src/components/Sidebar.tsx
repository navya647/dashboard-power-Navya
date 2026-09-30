'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

// Placeholder icons — stand-ins for real ones, swap the path data out once real iconography for
// each section is settled rather than treating these as final.
const NAV = [
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
  // Home still routes to '/' — the landing page — only its position in the nav list moved.
  {
    href: '/',
    label: 'Home',
    icon: <path d="M4 11 12 4l8 7M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9M10 20v-6h4v6" />,
  },
  {
    href: '/accessibility',
    label: 'Accessibility',
    icon: <path d="M12 3 3 7.5 12 12l9-4.5L12 3Zm-9 9 9 4.5 9-4.5M3 16.5l9 4.5 9-4.5" />,
  },
  {
    href: '/methodology',
    label: 'Methodology',
    icon: <path d="M9 4h6l3 4v12H6V8l3-4Zm-1 8h8M8 15h5" />,
  },
];

/** Always-visible, non-collapsible: a permanent part of the layout, not a drawer — there is
 * deliberately no toggle/close control (see layout.css, which reserves the sidebar's width in
 * main.app-main's margin unconditionally rather than behind any open/closed state). */
export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export has no Image Optimization API */}
          <img src="/acpet-logo.png" alt="ACPET" width={208} height={69} className="brand-logo brand-logo-light" />
          {/* eslint-disable-next-line @next/next/no-img-element -- static export has no Image Optimization API */}
          <img src="/acpet-logo-white.png" alt="ACPET" width={208} height={69} className="brand-logo brand-logo-dark" />
        </div>
        <nav className="sidenav">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
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

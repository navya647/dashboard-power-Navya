'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import ThemeToggle from './ThemeToggle';

const NAV = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <path d="M4 11 12 4l8 7M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9M10 20v-6h4v6" />
    ),
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

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // lets the main content wrapper react to the sidebar's state (layout.css) even though they're
  // siblings under app-shell, without threading this through context/props.
  useEffect(() => {
    document.body.classList.toggle('sidebar-open', open);
    return () => document.body.classList.remove('sidebar-open');
  }, [open]);

  // closes on a tap/click anywhere outside the open panel — the hamburger button itself is
  // excluded so its own click isn't immediately undone by this same handler.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (asideRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const toggle = () => setOpen((v) => !v);

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className={`menu-toggle${open ? ' open' : ''}`}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="bar" />
        <span className="bar" />
        <span className="bar" />
      </button>
      <aside ref={asideRef} className={`sidebar${open ? ' open' : ''}`}>
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
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
    </>
  );
}

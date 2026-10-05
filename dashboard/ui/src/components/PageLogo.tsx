'use client';

import { usePathname } from 'next/navigation';

/** The ACPET logo, top right of every page except home — whose HeroSection shows the same logo in
 * the same spot — so it stays in one place across the site rather than moving into the sidebar. */
export default function PageLogo() {
  if (usePathname() === '/') return null;
  return (
    <div className="page-logo">
      {/* eslint-disable-next-line @next/next/no-img-element -- static export has no Image Optimization API */}
      <img src="/acpet-logo.png" alt="ACPET" width={208} height={69} className="page-logo-light" />
      {/* eslint-disable-next-line @next/next/no-img-element -- static export has no Image Optimization API */}
      <img src="/acpet-logo-white.png" alt="ACPET" width={208} height={69} className="page-logo-dark" />
    </div>
  );
}

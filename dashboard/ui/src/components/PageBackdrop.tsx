'use client';

import { usePathname } from 'next/navigation';

/** The home page map view's photo backdrop (layout.css), behind every page except home — whose
 * HeroSection draws its own (the landing hero, then the same photo behind the map). */
export default function PageBackdrop() {
  if (usePathname() === '/') return null;
  return <div className="page-backdrop" aria-hidden="true" />;
}

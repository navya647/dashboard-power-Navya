'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface Crumb {
  label: string;
  href?: string;
}

const DASHBOARD_NAME = 'India Power Supply, Service Quality and Safety Dashboard';

/** The back button + breadcrumb row shared by the state overview, its Detailed Data page and the
 * "data being compiled" fallback. The last crumb is the current page (bold, not a link). */
export default function StateTopbar({ backLabel, backHref, crumbs }: { backLabel: string; backHref: string; crumbs: Crumb[] }) {
  const router = useRouter();
  return (
    <div className="state-topbar">
      <button type="button" className="back-btn" onClick={() => router.push(backHref)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        {backLabel}
      </button>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        {DASHBOARD_NAME}
        {crumbs.map((c, i) => (
          <span key={c.label} className="breadcrumb-item">
            <span aria-hidden="true">/</span>{' '}
            {i === crumbs.length - 1 || !c.href ? (
              <b aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c.label}</b>
            ) : (
              <Link href={c.href}>{c.label}</Link>
            )}
          </span>
        ))}
      </nav>
    </div>
  );
}

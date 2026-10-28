'use client';

import Link from 'next/link';
import { MAP_HREF } from '@/lib/routes';

/** Stand-in for a page that's switched off while DISCOM_SoP_master.xlsx has too few plain-number
 * figures to compare across DISCOMs (Compare, Quick comparison). Its entry points are hidden; this
 * only catches an old link or bookmark. */
export default function PausedPage({ title }: { title: string }) {
  return (
    <div className="state-page">
      <p className="detail-placeholder">
        {title} will return once more reported figures are available. Meanwhile, every figure is on each state’s page:{' '}
        <Link href={MAP_HREF}>explore the map</Link>.
      </p>
    </div>
  );
}

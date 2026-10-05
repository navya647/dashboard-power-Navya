'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import GlanceView from '@/components/GlanceView';

// ?indicator=&year= are read on the client (useSearchParams) so the page stays a static export —
// same pattern as /compare.
function GlancePageContent() {
  const params = useSearchParams();
  return <GlanceView initialIndicator={params.get('indicator')} initialYear={params.get('year')} />;
}

export default function GlancePage() {
  return (
    <Suspense fallback={<p className="detail-placeholder">Loading…</p>}>
      <GlancePageContent />
    </Suspense>
  );
}

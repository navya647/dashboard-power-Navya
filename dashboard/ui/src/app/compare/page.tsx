'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CompareView from '@/components/CompareView';

// `searchParams` as a page prop forces per-request server rendering, which `output: 'export'`
// can't do — `useSearchParams()` instead resolves on the client, so the page can be pre-built as
// static HTML and still pick up ?states=&year= at load time. Next requires a Suspense boundary
// around any component that calls it.
function ComparePageContent() {
  const searchParams = useSearchParams();
  const states = searchParams.get('states');
  const stateList = states ? states.split(',').filter(Boolean) : [];
  return <CompareView states={stateList} />;
}

export default function ComparePage() {
  return (
    <Suspense fallback={<p className="detail-placeholder">Loading…</p>}>
      <ComparePageContent />
    </Suspense>
  );
}

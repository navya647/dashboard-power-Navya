import type { Metadata } from 'next';
import { DataProvider } from '@/lib/DataContext';
import Sidebar from '@/components/Sidebar';
import PageLogo from '@/components/PageLogo';
import PageBackdrop from '@/components/PageBackdrop';
import OnboardingTour from '@/components/OnboardingTour';
import './globals.css';

export const metadata: Metadata = {
  title: 'India Power Supply, Service Quality and Safety Dashboard',
  description:
    'Understanding how electricity distribution companies in India perform with respect to the Standards of Performance specified by their respective State Electricity Regulatory Commissions (SERCs), and assessing comparative performance among states.',
};

// Sets data-theme on <html> before first paint — a plain synchronous inline script (not an
// effect) is the only way to avoid a flash of the wrong theme on load in a statically exported
// app with no per-request server render to inject it during.
// Dark is the default. The storage key is versioned ('-v2'): moving it reset everyone's old saved
// choice once, so every visitor starts in dark; after that their own toggle choice persists again.
// A direct load of the home page on desktop also sets data-hero-landing (the sunset-matched sidebar,
// no theme toggle) or, for ?view=map, data-hero-map (the map view's warm sidebar) up front, so
// neither flashes in after hydration; HeroSection keeps them in sync from there.
const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,s=localStorage.getItem('acpet-theme-v2');var t=s==='light'||s==='dark'?s:'dark';d.setAttribute('data-theme',t);if((location.pathname==='/'||location.pathname==='/index.html')&&!matchMedia('(max-width: 980px)').matches)d.setAttribute(location.search.indexOf('view=map')<0?'data-hero-landing':'data-hero-map','');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: THEME_INIT_SCRIPT sets data-theme before React hydrates, so the
    // attribute intentionally differs from the server HTML
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&family=Playfair+Display:wght@400;500;600;700&display=swap"
        />
      </head>
      {/* browser extensions (Grammarly etc.) add attributes to <body> before React loads; that's
          not ours to reconcile, so it doesn't count as a hydration mismatch */}
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <DataProvider>
          <div className="app-shell">
            <Sidebar />
            <main className="app-main">
              <PageBackdrop />
              <PageLogo />
              {children}
            </main>
          </div>
          <OnboardingTour />
        </DataProvider>
      </body>
    </html>
  );
}

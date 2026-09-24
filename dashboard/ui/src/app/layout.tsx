import type { Metadata } from 'next';
import { Montserrat, Playfair_Display } from 'next/font/google';
import { DataProvider } from '@/lib/DataContext';
import Sidebar from '@/components/Sidebar';
import OnboardingTour from '@/components/OnboardingTour';
import './globals.css';

const montserrat = Montserrat({ variable: '--font-montserrat', subsets: ['latin'], weight: ['300', '400', '500', '600'] });
const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'India Power Supply and Service Quality Dashboard',
  description:
    'Understanding how electricity distribution companies in India perform with respect to the Standards of Performance specified by their respective State Electricity Regulatory Commissions (SERCs), and assessing comparative performance among states.',
};

// Sets data-theme on <html> before first paint — a plain synchronous inline script (not an
// effect) is the only way to avoid a flash of the wrong theme on load in a statically exported
// app with no per-request server render to inject it during.
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('acpet-theme');var t=s==='light'||s==='dark'?s:'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${playfair.variable}`}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <DataProvider>
          <div className="app-shell">
            <Sidebar />
            <main className="app-main">{children}</main>
          </div>
          <OnboardingTour />
        </DataProvider>
      </body>
    </html>
  );
}

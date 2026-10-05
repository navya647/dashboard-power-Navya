'use client';

import { useEffect, useState } from 'react';

const SLIDES = [
  {
    title: 'Welcome to the India Power Supply, Service Quality and Safety Dashboard',
    body: 'A quick look at how to find your way around before you dive in — this only takes a few seconds.',
  },
  {
    title: 'Explore the map',
    body: 'Scroll down on the home page to bring the map of India into focus.',
    image: '/tour/map.png',
  },
  {
    title: "Open a State's or Union Territory's Performance Report",
    body: 'Click on any state or union territory to explore the performance of its distribution companies.',
    image: '/tour/report.png',
  },
  {
    title: 'Compare performance side by side',
    body: 'Switch to Compare in the "Explore the data" panel, add states or union territories from the list or the map, then review their comparable indicators.',
    image: '/tour/compare.png',
  },
];

// sessionStorage (not localStorage) is deliberate: the tour should show once per browser tab —
// still gone after navigating between pages in that tab — but come back if the tab is closed and
// reopened, rather than being permanently dismissed the first time anyone ever sees it.
const STORAGE_KEY = 'acpet-tour-completed';

export default function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  function goTo(next: number) {
    setDirection(next > step ? 'forward' : 'back');
    setStep(next);
  }

  useEffect(() => {
    let alreadyCompleted = false;
    try {
      alreadyCompleted = sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      // sessionStorage unavailable (private browsing, etc.) — fall back to showing the tour
    }
    if (!alreadyCompleted) setVisible(true);
  }, []);

  function finish() {
    setVisible(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore — worst case the tour reappears on the next page in this tab
    }
  }

  if (!visible) return null;

  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];

  return (
    <div className="tour-scrim" role="presentation">
      <div className="tour-dialog" role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <button type="button" className="tour-skip" onClick={finish}>
          Skip tour
        </button>
        <div className="tour-track">
          <div key={step} className={`tour-slide tour-slide--${direction}`}>
            {slide.image && (
              <div className="tour-visual" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={slide.image} alt="" className="tour-visual-img" />
              </div>
            )}
            <div className="tour-step-count">
              {step + 1} / {SLIDES.length}
            </div>
            <h2 id="tour-title">{slide.title}</h2>
            <p>{slide.body}</p>
          </div>
        </div>
        <div className="tour-bottom">
          <div className="tour-dots" aria-hidden="true">
            {SLIDES.map((_, i) => (
              <span key={i} className={`tour-dot${i === step ? ' active' : ''}`} />
            ))}
          </div>
          <div className="tour-actions">
            <button type="button" className="tour-btn tour-btn--ghost" onClick={() => goTo(step - 1)} disabled={step === 0}>
              Back
            </button>
            <button type="button" className="tour-btn tour-btn--primary" onClick={() => (isLast ? finish() : goTo(step + 1))}>
              {isLast ? 'Get started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
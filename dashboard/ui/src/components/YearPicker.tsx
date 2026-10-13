'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { fyLabel } from '@/lib/format';

interface Props {
  years: string[];
  active: string;
  onChange: (y: string) => void;
}

/** A sliding pill selector for financial years, used anywhere a single-year filter is needed
 * (SoP section, DISCOM Scorecards). The slider's position/width is measured from the actual
 * active button rather than assumed from index * fixed-width, so it lands exactly under the
 * label regardless of how wide "2025-26" renders vs "2021-22". */
export default function YearPicker({ years, active, onChange }: Props) {
  // earliest year first, left to right (ascending)
  const ordered = [...years].sort((a, b) => (a < b ? -1 : 1));
  const trackRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [slider, setSlider] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const btn = btnRefs.current[active];
    if (!track || !btn) return;
    const trackRect = track.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setSlider({ left: btnRect.left - trackRect.left, width: btnRect.width });
  }, [active, years.join(',')]);

  return (
    <div className="year-picker">
      <span className="yp-label">Focus Year</span>
      <div className="yp-years" ref={trackRef}>
        {slider && <span className="yp-slider" style={{ left: slider.left, width: slider.width }} />}
        {ordered.map((y) => (
          <button
            key={y}
            type="button"
            ref={(el) => {
              btnRefs.current[y] = el;
            }}
            className={y === active ? 'active' : ''}
            onClick={() => onChange(y)}
            aria-pressed={y === active}
          >
            {fyLabel(y)}
          </button>
        ))}
      </div>
    </div>
  );
}

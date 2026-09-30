'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { STREET_SVG } from '@/lib/streetSvg.generated';
import { startStreetAnimation, type StreetController } from '@/lib/streetAnimation';

interface Props {
  /** HeroSection pauses the loop through this once the landing view has scrolled away. */
  controllerRef: MutableRefObject<StreetController | null>;
  /** the outer layer, which HeroSection fades and scales as part of its scroll timeline */
  layerRef: MutableRefObject<HTMLDivElement | null>;
}

// Framing (SVG viewBox) of the cul-de-sac: centred right of middle so the left side stays clear
// for the editorial copy and its gradient.
const VIEWBOX = '60 -715 1120 630';

/** The animated cul-de-sac behind the landing page's headline. The SVG markup is static and
 * generated at build time (scripts/build-street-svg.mjs); all motion is started in an effect. */
export default function StreetHero({ controllerRef, layerRef }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const statusTextRef = useRef<HTMLSpanElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ctl = startStreetAnimation(svg, { status: statusRef.current, statusText: statusTextRef.current });
    controllerRef.current = ctl;
    return () => {
      ctl.destroy();
      controllerRef.current = null;
    };
  }, [controllerRef]);

  function togglePause() {
    const next = !paused;
    setPaused(next);
    controllerRef.current?.setUserPaused(next);
  }

  return (
    <div className="street-layer" ref={layerRef}>
      <svg
        ref={svgRef}
        className="street-scene"
        viewBox={VIEWBOX}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
        dangerouslySetInnerHTML={{ __html: STREET_SVG }}
      />
      <div className="street-hud">
        <div className="street-pill" ref={statusRef} data-state="ok">
          <span className="street-pill-dot" aria-hidden="true" />
          <span ref={statusTextRef}>All homes powered</span>
        </div>
        <button
          type="button"
          className="street-toggle"
          aria-pressed={paused}
          aria-label={paused ? 'Play background animation' : 'Pause background animation'}
          onClick={togglePause}
        >
          {paused ? (
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5z" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.5" width="3" height="11" rx="1" /><rect x="9.5" y="2.5" width="3" height="11" rx="1" /></svg>
          )}
        </button>
      </div>
    </div>
  );
}

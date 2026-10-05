'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';
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

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ctl = startStreetAnimation(svg);
    controllerRef.current = ctl;
    return () => {
      ctl.destroy();
      controllerRef.current = null;
    };
  }, [controllerRef]);

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
    </div>
  );
}

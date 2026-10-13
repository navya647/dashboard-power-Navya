'use client';

import { useEffect, useRef, useState } from 'react';
import { fmt } from '@/lib/format';

interface Props {
  target: number | null;
  digits?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}

export default function AnimatedNumber({ target, digits = 0, duration = 750, prefix = '', suffix = '' }: Props) {
  const [display, setDisplay] = useState('N/A');
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (target === null || Number.isNaN(target)) return;
    const t0 = performance.now();
    function step(now: number) {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(prefix + fmt(target! * eased, digits) + suffix);
      if (p < 1) frame.current = requestAnimationFrame(step);
    }
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, digits, duration, prefix, suffix]);

  if (target === null || Number.isNaN(target)) return <>N/A</>;
  return <>{display}</>;
}

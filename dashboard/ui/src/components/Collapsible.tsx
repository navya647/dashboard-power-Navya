'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { hexToRgba } from '@/lib/colors';
import { animateScrollTo } from '@/lib/scroll';

interface Props {
  label: ReactNode;
  meta?: ReactNode;
  /** The DISCOM's assigned categorical color (same one used on its scorecard/chart line above) —
   * turns the plain label into a colored chip so it's immediately clear which DISCOM this row's
   * detail belongs to, rather than reading as generic unlabeled text. */
  color?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  animationDelay?: number;
  /** Controlled open state — pass this (with onOpenChange) when something outside the row itself
   * needs to open it, e.g. clicking that DISCOM's scorecard above. Omit both for a normal
   * self-contained accordion row that only ever responds to its own header click. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** An accordion row that slides open/closed (native <details> jumps instantly, with no way to
 * transition height) and carries a chevron that flips to signal state, so it reads as an
 * expandable control rather than a static card. Shared by the reliability report's per-DISCOM
 * detail and the Standards-of-Performance section so both accordions look and move identically. */
export default function Collapsible({ label, meta, color, children, defaultOpen = false, animationDelay, open: openProp, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const wasOpen = useRef(open);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  // fires on every transition into the open state, however it was triggered — a click on this
  // row's own header, or `open` flipping true because a parent set it (e.g. that DISCOM's
  // scorecard was clicked) — so the "scroll to reveal it" behavior isn't tied to one input path.
  useEffect(() => {
    if (open && !wasOpen.current) {
      const container = containerRef.current;
      const panel = panelRef.current;
      if (container && panel) {
        const scrollToContainer = (duration?: number) => {
          const marginTop = parseFloat(getComputedStyle(container).scrollMarginTop) || 0;
          const targetY = window.scrollY + container.getBoundingClientRect().top - marginTop;
          animateScrollTo(targetY, duration);
        };
        // scrolling has to wait for the grid-template-rows transition to actually finish, not
        // just for the 'open' class to apply: the page is still its pre-expansion height for the
        // whole 280ms the row takes to grow, so scrolling immediately would target a page that
        // hasn't grown tall enough yet to actually reach that position.
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          scrollToContainer(0);
        } else {
          const onTransitionEnd = (e: TransitionEvent) => {
            if (e.target !== panel || e.propertyName !== 'grid-template-rows') return;
            panel.removeEventListener('transitionend', onTransitionEnd);
            scrollToContainer();
          };
          panel.addEventListener('transitionend', onTransitionEnd);
        }
      }
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <div ref={containerRef} className={`discom-detail animate-in${open ? ' open' : ''}`} style={animationDelay ? { animationDelay: `${animationDelay}ms` } : undefined}>
      <button type="button" className="discom-detail-summary" aria-expanded={open} onClick={() => setOpen(!open)}>
        {color ? (
          <span className="discom-detail-badge" style={{ background: hexToRgba(color, 0.14), '--badge-color': color } as CSSProperties}>
            {label}
          </span>
        ) : (
          <span className="discom-detail-plain-label">{label}</span>
        )}
        {meta && <span className="reg">{meta}</span>}
        <svg className="discom-detail-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div ref={panelRef} className="discom-detail-panel">
        <div className="discom-detail-panel-inner">
          <div className="discom-detail-panel-slide">{children}</div>
        </div>
      </div>
    </div>
  );
}

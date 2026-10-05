'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  /** the collapsed value shown in the trigger (inside the shared `.filter-value` row) */
  value: ReactNode;
  /** accessible name for the trigger, e.g. "DISCOM: All DISCOMs" */
  ariaLabel?: string;
  /** extra class(es) on the menu panel, for per-filter content styling */
  panelClassName?: string;
  /** cap on the menu's height; the menu also shrinks to the room left in the window */
  maxHeight?: number;
  /** the menu is as wide as the trigger, clamped to these bounds (px) */
  minPanelWidth?: number;
  maxPanelWidth?: number;
  /** element to focus when the menu opens (defaults to the menu's first focusable control) */
  initialFocus?: () => HTMLElement | null | undefined;
  /** called when the menu closes, however it closes */
  onClose?: () => void;
  /** the menu's contents; clicking any element inside marked `data-close-menu` closes the menu
   * and returns focus to the trigger (single-select rows) */
  children: ReactNode;
}

const FOCUSABLE = 'input:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])';
const GAP = 4;
const EDGE = 8;

/** The one dropdown shell behind every filter-bar control (DISCOM, Indicator, Year): an underlined
 * trigger plus a menu panel. The panel renders through a portal into <body> with `position: fixed`
 * under the trigger, on the shared `--z-dropdown` layer, so no stacking context on the page (the
 * bar's own, sticky table headers, the Focus Year bar, animated cards) can ever cover it — it
 * re-anchors on scroll/resize, flips above the trigger when there's clearly more room there, and is
 * clamped inside the window. Since the panel lives at the end of <body>, focus moves into it on
 * open, and tabbing past either end of it closes it and returns focus to the trigger. */
export default function FilterDropdown({ value, ariaLabel, panelClassName, maxHeight = 320, minPanelWidth = 0, maxPanelWidth = Infinity, initialFocus, onClose, children }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    left: number;
    top?: number;
    bottom?: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = `${useId().replace(/:/g, '')}-menu`;
  // callers pass these inline; held in refs so a re-render (e.g. ticking a checkbox) never re-runs
  // the open/focus effects below
  const onCloseRef = useRef(onClose);
  const initialFocusRef = useRef(initialFocus);
  useEffect(() => {
    onCloseRef.current = onClose;
    initialFocusRef.current = initialFocus;
  });

  const close = useCallback((refocus = true) => {
    setOpen(false);
    onCloseRef.current?.();
    if (refocus) triggerRef.current?.focus();
  }, []);

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    const up = below < 220 && above > below;
    const width = Math.min(maxPanelWidth, Math.max(minPanelWidth, r.width));
    const actual = Math.max(width, panelRef.current?.offsetWidth ?? 0);
    const left = Math.max(EDGE, Math.min(r.left, window.innerWidth - actual - EDGE));
    setPos({
      left,
      width,
      maxHeight: Math.max(140, Math.min(maxHeight, up ? above : below)),
      ...(up ? { bottom: window.innerHeight - r.top + GAP } : { top: r.bottom + GAP }),
    });
  }, [maxHeight, minPanelWidth, maxPanelWidth]);

  // position before paint, then once more after the panel has its real width (for edge clamping)
  useLayoutEffect(() => {
    if (!open) return;
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { passive: true, capture: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, { capture: true });
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const target = initialFocusRef.current?.() ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus({ preventScroll: true });
    function handlePointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open, close]);

  function onPanelKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items[items.length - 1];
    if ((e.shiftKey && document.activeElement === first) || (!e.shiftKey && document.activeElement === last)) {
      e.preventDefault();
      close();
    }
  }

  return (
    <div className="discom-multiselect">
      <button
        ref={triggerRef}
        type="button"
        className="discom-multiselect-trigger"
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.stopPropagation();
            close();
          }
        }}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={ariaLabel}
      >
        <span className="filter-value">{value}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            className={`discom-multiselect-panel${panelClassName ? ` ${panelClassName}` : ''}`}
            style={
              pos
                ? {
                    left: pos.left,
                    top: pos.top,
                    bottom: pos.bottom,
                    minWidth: pos.width,
                    maxHeight: pos.maxHeight,
                  }
                : { visibility: 'hidden' }
            }
            onKeyDown={onPanelKeyDown}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('[data-close-menu]')) close();
            }}
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}

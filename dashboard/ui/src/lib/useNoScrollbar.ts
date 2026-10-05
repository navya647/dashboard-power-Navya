import { useEffect } from 'react';

/** Hides the window's scrollbar while the calling page is mounted (html[data-no-scrollbar],
 * layout.css). For pages laid out to fit one screen (About, At a glance): they size themselves to
 * the window, so normally there's nothing to scroll — and on a window too short even for that, the
 * page still scrolls by wheel/touch/keys, it just never draws a bar. Nothing is ever clipped. */
export function useNoScrollbar() {
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('data-no-scrollbar', '');
    return () => html.removeAttribute('data-no-scrollbar');
  }, []);
}

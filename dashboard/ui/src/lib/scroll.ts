const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

/** Scrolls the window to `targetY` over a fixed, deliberately unhurried duration — native
 * `scrollIntoView({behavior:'smooth'})` hands timing entirely to the browser, which tends to
 * read as an abrupt snap on a short distance rather than a visible glide. */
export function animateScrollTo(targetY: number, duration = 700) {
  const startY = window.scrollY;
  const distance = targetY - startY;
  if (Math.abs(distance) < 1) return;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    window.scrollTo(0, startY + distance * easeInOutQuad(t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

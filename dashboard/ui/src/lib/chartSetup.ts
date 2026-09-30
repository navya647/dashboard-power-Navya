import { Chart, registerables } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(...registerables, annotationPlugin);

/** Chart.js axis ticks/legend text has no per-chart color set in IndicatorVisualCard.tsx, so it
 * always renders from this one global default — pull it from the live `--muted` token (not a
 * hardcoded hex) so it's correct for whichever theme is active on load, and keep it correct after
 * a live theme toggle too (ThemeToggle.tsx flips `data-theme` without a page reload, so a value
 * read only once at import time would otherwise go stale — e.g. dark mode's lighter `--muted`,
 * tuned for contrast against the dark panel, would silently keep using light mode's darker one). */
function applyMutedDefault() {
  const muted = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
  if (muted) Chart.defaults.color = muted;
}

if (typeof window !== 'undefined') {
  const sans = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim();
  if (sans) Chart.defaults.font.family = sans;
  applyMutedDefault();

  new MutationObserver(() => {
    applyMutedDefault();
    for (const chart of Object.values(Chart.instances)) chart.update('none');
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

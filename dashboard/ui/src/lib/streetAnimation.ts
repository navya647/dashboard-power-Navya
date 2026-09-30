/**
 * Power-cycle animation for the landing page's animated street (markup from
 * streetSvg.generated.ts). A port of the standalone prototype's "street" mode
 * (D:\power dashboard\animated-hero\main.js) that uses the Web Animations API and a
 * pausable clock instead of GSAP, so the app gains no dependency.
 *
 * Cycle: all homes lit for STREET_ON seconds, then the transformer bursts, the birds fly off,
 * every home cuts at once and the street dims; after STREET_OFF seconds supply returns to every
 * house together (stutter + blue "energise" effect at the transformer), and it repeats.
 *
 * Visual state is a single `off` class (see styles/street.css), so cuts are instant.
 */

export const STREET_CONFIG = {
  STREET_ON: 5,
  STREET_OFF: 5,
  // restore stutter: times the lights toggle on, off, on, off, on. Spread over 0.9s so nothing
  // flashes more than 3 times a second.
  FLICKER: [0, 0.15, 0.4, 0.55, 0.9],
  FAN_REV_MS: 700,
  FAN_SPINDOWN: 1.5,
  FAN_SPINUP: 1.2,
  TV_CHANGE: [0.35, 0.8],
  TV_LEVEL: [0.45, 0.85],
  PULSE_GAP: 64, // must equal the sum of the .pulse stroke-dasharray in street.css
  PULSE_SPEED: 85,
  SCENE_DIM: 0.3,
};

export interface StreetController {
  /** false pauses everything (e.g. the landing view has scrolled away). */
  setActive(active: boolean): void;
  setUserPaused(paused: boolean): void;
  destroy(): void;
}

interface UiRefs {
  status?: HTMLElement | null;
  statusText?: HTMLElement | null;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function startStreetAnimation(svg: SVGSVGElement, ui: UiRefs): StreetController {
  const C = STREET_CONFIG;
  const q = <T extends Element>(sel: string) => [...svg.querySelectorAll<T>(sel)];
  const byId = <T extends Element>(id: string) => svg.querySelector<T>(`#${id}`);

  const toggles = [
    ...q('.house'), ...q('.spill'), ...q('.drop'), ...q('.lamp'), ...q('.lamp-pool'), ...q('.main-pulse'),
  ];
  const tvs = q<SVGElement>('.tv');
  const fans = q<SVGElement>('.fan');
  const birds = q<SVGGElement>('.bird');
  const dim = byId<SVGElement>('scene-dim');
  const spark = byId<SVGGElement>('transformer-spark');
  const energizeG = byId<SVGGElement>('transformer-energize');

  let powered = true;
  let outageStart = -1;
  let lastStatus = '';
  function status() {
    let text = 'All homes powered', state = 'ok';
    if (outageStart >= 0) {
      text = `Outage across the street · 0:${String(Math.min(59, Math.floor(now - outageStart))).padStart(2, '0')}`;
      state = 'outage';
    }
    if (text === lastStatus) return;
    lastStatus = text;
    if (ui.statusText) ui.statusText.textContent = text;
    if (ui.status) ui.status.dataset.state = state;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    // static, fully lit street: no loop, no flicker
    status();
    return { setActive() {}, setUserPaused() {}, destroy() {} };
  }

  // ---------- run state (declared first: track() below reads `running`) ----------
  let running = false, active = true, userPaused = false, inView = true;
  let raf = 0, lastTs = 0;

  // ---------- pausable clock + scheduled events ----------
  let now = 0;
  let events: { at: number; fn: () => void }[] = [];
  const after = (delay: number, fn: () => void) => events.push({ at: now + delay, fn });

  // ---------- Web Animations bookkeeping ----------
  const anims = new Set<Animation>();
  const held = new Set<Animation>(); // intentionally paused (e.g. pulses while off)
  function track(a: Animation) {
    anims.add(a);
    // one-shot animations without a lasting fill are done for good once finished
    a.addEventListener('finish', () => {
      const fill = a.effect?.getTiming().fill;
      if (!fill || fill === 'none' || fill === 'auto' || fill === 'backwards') anims.delete(a);
    });
    if (!running) a.pause();
    return a;
  }

  const pulseAnims = q<SVGPathElement>('.pulse').map((el) =>
    track(el.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -C.PULSE_GAP }], {
      duration: (C.PULSE_GAP / C.PULSE_SPEED) * 1000, iterations: Infinity, easing: 'linear',
    })),
  );
  const fanAnims = fans.map((el) =>
    track(el.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: C.FAN_REV_MS, iterations: Infinity })),
  );
  let fanRate = 1, fanTarget = 1;
  q<SVGGElement>('.cloud').forEach((c, k) => {
    track(c.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${90 + k * 30}px)` }], {
      duration: (50 + k * 14) * 1000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out',
    }));
  });

  // ---------- power state ----------
  function visual(on: boolean) {
    toggles.forEach((el) => el.classList.toggle('off', !on));
  }
  function setPulses(on: boolean) {
    pulseAnims.forEach((a) => {
      if (on) { held.delete(a); if (running) a.play(); } else { held.add(a); a.pause(); }
    });
  }
  let tvRunning = false;
  function tvTick() {
    if (!powered) { tvRunning = false; return; }
    tvRunning = true;
    tvs.forEach((tv) => tv.setAttribute('opacity', rand(C.TV_LEVEL[0], C.TV_LEVEL[1]).toFixed(2)));
    after(rand(C.TV_CHANGE[0], C.TV_CHANGE[1]), tvTick);
  }

  function burst() {
    if (spark) {
      track(spark.animate([{ opacity: 1 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: 520, easing: 'ease-in' }));
      const flash = spark.querySelector('.flash');
      if (flash) track(flash.animate([{ transform: 'scale(0.3)' }, { transform: 'scale(1.15)' }], { duration: 220, easing: 'ease-out' }));
    }
  }
  function energize() {
    if (!energizeG) return;
    track(energizeG.animate([{ opacity: 1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 1500 }));
    energizeG.querySelectorAll<SVGPathElement>('.energize-arcs path').forEach((a, k) => {
      const L = a.getTotalLength();
      a.style.strokeDasharray = `${L} ${L}`;
      track(a.animate(
        [{ strokeDashoffset: L, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: 0.35 }, { strokeDashoffset: 0, opacity: 1, offset: 0.65 }, { strokeDashoffset: 0, opacity: 0 }],
        { duration: 1100, delay: k * 70, easing: 'ease-out', fill: 'backwards' },
      ));
    });
    const glow = energizeG.querySelector('.energize-glow');
    if (glow) track(glow.animate([{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'scale(1)', offset: 0.25 }, { opacity: 0, transform: 'scale(1)' }], { duration: 1500 }));
    const ring = energizeG.querySelector('.energize-ring');
    if (ring) track(ring.animate([{ opacity: 0.9, transform: 'scale(0.3)' }, { opacity: 0, transform: 'scale(2.2)' }], { duration: 900, delay: 100, easing: 'ease-out', fill: 'backwards' }));
  }

  let birdAnims: Animation[] = [];
  function birdsFly() {
    birdAnims.forEach((a) => a.cancel());
    birdAnims = birds.flatMap((b, k) => {
      b.classList.add('flying');
      const fly = b.animate(
        [{ transform: 'translate(0px,0px) rotate(0deg)', opacity: 1 }, { opacity: 1, offset: 0.8 }, { transform: `translate(${240 + k * 70}px,${-320 - k * 50}px) rotate(-12deg)`, opacity: 0 }],
        { duration: 2200, delay: k * 100, easing: 'ease-in', fill: 'forwards' },
      );
      const wing = b.querySelector('.wing');
      const flap = wing ? [wing.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(-1)' }], { duration: 170, iterations: 14, direction: 'alternate' })] : [];
      return [fly, ...flap].map(track);
    });
  }
  function birdsReturn() {
    birdAnims.forEach((a) => a.cancel());
    birdAnims = birds.map((b, k) => {
      const a = b.animate(
        [{ transform: `translate(${-280 - k * 40}px,-260px) rotate(10deg)`, opacity: 0 }, { transform: 'translate(0px,0px) rotate(0deg)', opacity: 1 }],
        { duration: 2000, delay: k * 200, easing: 'ease-out', fill: 'both' },
      );
      a.addEventListener('finish', () => b.classList.remove('flying'));
      return track(a);
    });
  }

  function trip() {
    burst();
    birdsFly();
    powered = false;
    visual(false);
    setPulses(false);
    fanTarget = 0;
    outageStart = now;
    if (dim) track(dim.animate([{ opacity: 0 }, { opacity: C.SCENE_DIM }], { duration: 60, fill: 'forwards' }));
    status();
    after(C.STREET_OFF, restore);
  }
  function restore() {
    energize();
    setPulses(true);
    fanTarget = 1;
    const last = C.FLICKER[C.FLICKER.length - 1];
    C.FLICKER.forEach((t, k) => after(t, () => visual(k % 2 === 0)));
    after(last, () => {
      powered = true;
      outageStart = -1;
      status();
      if (!tvRunning) tvTick();
    });
    if (dim) track(dim.animate([{ opacity: C.SCENE_DIM }, { opacity: 0 }], { duration: 600, fill: 'forwards' }));
    birdsReturn();
    after(C.STREET_ON, trip);
  }

  // ---------- frame loop ----------
  function frame(ts: number) {
    const dt = Math.min(0.1, (ts - lastTs) / 1000);
    lastTs = ts;
    now += dt;
    for (;;) {
      const due = events.filter((e) => e.at <= now);
      if (!due.length) break;
      events = events.filter((e) => e.at > now);
      due.sort((a, b) => a.at - b.at).forEach((e) => e.fn());
    }
    // fan coasts down over FAN_SPINDOWN and spins back up over FAN_SPINUP
    if (fanRate !== fanTarget) {
      fanRate = fanTarget < fanRate ? Math.max(fanTarget, fanRate - dt / C.FAN_SPINDOWN) : Math.min(fanTarget, fanRate + dt / C.FAN_SPINUP);
      fanAnims.forEach((a) => (a.playbackRate = Math.max(0.0001, fanRate)));
    }
    if (outageStart >= 0) status();
    raf = requestAnimationFrame(frame);
  }
  function apply() {
    const run = active && !userPaused && inView && !document.hidden;
    if (run === running) return;
    running = run;
    if (run) {
      anims.forEach((a) => { if (!held.has(a) && a.playState === 'paused') a.play(); });
      lastTs = performance.now();
      raf = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(raf);
      anims.forEach((a) => { if (a.playState === 'running') a.pause(); });
    }
  }

  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; apply(); });
  io.observe(svg);
  document.addEventListener('visibilitychange', apply);

  status();
  tvTick();
  after(C.STREET_ON, trip);
  apply();

  return {
    setActive(v) { active = v; apply(); },
    setUserPaused(v) { userPaused = v; apply(); },
    destroy() {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', apply);
      anims.forEach((a) => a.cancel());
      birdAnims.forEach((a) => a.cancel());
      events = [];
    },
  };
}

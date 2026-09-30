/* ============================================================
   scene.js: builds the isometric cul-de-sac ("Groove Street" style) as
   inline SVG.

   If #scene already contains a hand-made illustration (it has a #layer-street
   group), this script does nothing. main.js only relies on element ids and
   classes, never on how the artwork was produced, so a professional SVG with
   the same ids is a drop-in replacement. See README.md.

   World coordinates: x and y are ground axes, z is height. 2:1 isometric:
     screen.x = x + y,  screen.y = (y - x) / 2 - z
   The viewer looks along (1, -1, -1), so a face is visible when its outward
   normal n satisfies n.x - n.y - n.z < 0.
   ============================================================ */
(function () {
  const svg = document.getElementById('scene');
  if (!svg || svg.querySelector('#layer-street')) return;

  // ---------- projection helpers ----------
  const iso = (x, y, z = 0) => [x + y, (y - x) / 2 - z];
  const f = (n) => Math.round(n * 10) / 10;
  const pt = (p) => iso(p[0], p[1], p[2] || 0).map(f).join(',');
  const pts = (list) => list.map(pt).join(' ');
  const poly = (list, fill, attrs = '') => `<polygon points="${pts(list)}" style="fill:${fill}" ${attrs}/>`;
  const v = (name) => `var(--${name})`;
  const rad = (deg) => (deg * Math.PI) / 180;
  // Plane transforms: draw ordinary 2D shapes, get them projected onto a plane.
  const GROUND = 'matrix(1,-0.5,1,0.5,0,0)';               // z = 0, local (x, y)
  const FRONT = (y) => `matrix(1,-0.5,0,-1,${y},${y / 2})`; // y = const, local (x, z)
  /** Vertical plane through world point o, running along unit direction t. Local (s, z). */
  const WALL = (o, t) => {
    const [ex, ey] = iso(o[0], o[1], 0);
    return `matrix(${f(t[0] + t[1])},${f((t[1] - t[0]) / 2 * 1000) / 1000},0,-1,${f(ex)},${f(ey)})`;
  };
  const visible = (n) => n[0] - n[1] - (n[2] || 0) < 0;

  // deterministic "random" so the scene is identical on every load
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  /** Axis-aligned box with the three visible faces: left (-x), front (+y), top. */
  function box(x0, x1, y0, y1, z0, z1, t, attrs = '') {
    return `<g ${attrs}>` +
      poly([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], t.left) +
      poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], t.front) +
      poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], t.top) +
      '</g>';
  }
  const wall = (n) => ({ left: v(`wall${n}-left`), front: v(`wall${n}-front`), top: v(`wall${n}-top`) });
  const roof = (n) => ({ top: v(`roof${n}-top`), edge: v(`roof${n}-edge`), line: v(`roof${n}-line`) });
  const HEDGE = { top: v('hedge-top'), left: v('hedge-left'), front: v('hedge-front') };

  // ---------- layout ----------
  const C = [700, 120];       // centre of the cul-de-sac turnaround
  const R = 125;              // asphalt radius
  const WALK = 14;            // sidewalk width
  const RF = R + WALK + 50;   // radius of the house fronts (front yards are 50 deep)
  const ROAD_HW = 40;         // half-width of the entry road (runs in from -x)
  const WIRE_Z = 150, SAG = 12;

  // Houses: five around the turnaround (angle = direction from the centre, degrees) plus one on
  // the entry road. They sit close together, as on a real cul-de-sac. Single-storey bungalows
  // with low hip roofs.
  const ring = (a, r = RF) => [C[0] + r * Math.cos(rad(a)), C[1] + r * Math.sin(rad(a))];
  const HOUSES = [
    { front: [392, C[1] - ROAD_HW - WALK - 44], a: -90, w: 104, wall: 2, roof: 4 },
    { front: ring(-122), a: -122, w: 102, wall: 1, roof: 1, garage: true },
    { front: ring(-86), a: -86, w: 104, wall: 3, roof: 2, fan: true },
    { front: ring(-50), a: -50, w: 100, wall: 5, roof: 4, garage: true },
    { front: ring(-14), a: -14, w: 104, wall: 4, roof: 3, tv: true },
    { front: ring(22), a: 22, w: 100, wall: 2, roof: 1, garage: true },
  ];
  const D = 68, H = 40, RH = 22, O = 7; // depth, wall height, roof rise, eave overhang

  // Overhead line: poles along the north sidewalk of the entry road, ending at the transformer
  // pole on the turnaround sidewalk between houses 2 and 3.
  const LINE_Y = C[1] - ROAD_HW - 7;
  const TXP = ring(-68, R + 9);            // transformer pole position
  const TX = TXP[0], WIRE_Y = TXP[1];
  const POLES = [[-880, LINE_Y], [-540, LINE_Y], [-200, LINE_Y], [140, LINE_Y], [470, LINE_Y], [TX, WIRE_Y]];
  const LAMPS = [
    { p: [250, C[1] + ROAD_HW + 7], dir: [0, -1] },
    { p: [-150, C[1] + ROAD_HW + 7], dir: [0, -1] },
    { p: ring(-104, R + 7), dir: [-Math.cos(rad(-104)), -Math.sin(rad(-104))] },
    { p: ring(-32, R + 7), dir: [-Math.cos(rad(-32)), -Math.sin(rad(-32))] },
    { p: ring(6, R + 7), dir: [-Math.cos(rad(6)), -Math.sin(rad(6))] },
  ];

  // ---------- overhead line geometry ----------
  const topOf = (p) => iso(p[0], p[1], WIRE_Z);
  const bez = (P0, P1, t, sag = SAG) => {
    const C2 = [(P0[0] + P1[0]) / 2, (P0[1] + P1[1]) / 2 + sag], u = 1 - t;
    return [u * u * P0[0] + 2 * u * t * C2[0] + t * t * P1[0], u * u * P0[1] + 2 * u * t * C2[1] + t * t * P1[1]];
  };
  function wirePath(poles) {
    let d = `M${topOf(poles[0]).map(f)}`;
    for (let k = 1; k < poles.length; k++) {
      const P0 = topOf(poles[k - 1]), P1 = topOf(poles[k]);
      d += ` Q${f((P0[0] + P1[0]) / 2)},${f((P0[1] + P1[1]) / 2 + SAG)} ${P1.map(f)}`;
    }
    return d;
  }

  // ---------- defs ----------
  const defs = `<defs>
    <linearGradient id="sky-grad" gradientUnits="userSpaceOnUse" x1="0" y1="-1150" x2="0" y2="-500">
      <stop offset="0" style="stop-color:var(--sky-top)"/>
      <stop offset="0.45" style="stop-color:var(--sky-mid)"/>
      <stop offset="0.78" style="stop-color:var(--sky-low)"/>
      <stop offset="1" style="stop-color:var(--sky-horizon)"/>
    </linearGradient>
    <radialGradient id="sun-grad"><stop offset="0" style="stop-color:var(--sun-glow)" stop-opacity="0.55"/><stop offset="1" style="stop-color:var(--sun-glow)" stop-opacity="0"/></radialGradient>
    <linearGradient id="pane-on" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--win-on-2)"/><stop offset="1" style="stop-color:var(--win-on-1)"/>
    </linearGradient>
    <radialGradient id="spill-grad"><stop offset="0" style="stop-color:var(--spill)" stop-opacity="0.6"/><stop offset="0.55" style="stop-color:var(--spill)" stop-opacity="0.2"/><stop offset="1" style="stop-color:var(--spill)" stop-opacity="0"/></radialGradient>
    <radialGradient id="lamp-grad"><stop offset="0" style="stop-color:var(--lamp-light)" stop-opacity="0.75"/><stop offset="1" style="stop-color:var(--lamp-light)" stop-opacity="0"/></radialGradient>
    <radialGradient id="pool-grad"><stop offset="0" style="stop-color:var(--lamp-light)" stop-opacity="0.38"/><stop offset="1" style="stop-color:var(--lamp-light)" stop-opacity="0"/></radialGradient>
    <radialGradient id="ceil-grad"><stop offset="0" style="stop-color:var(--ceil)"/><stop offset="1" style="stop-color:var(--ceil)" stop-opacity="0"/></radialGradient>
    <radialGradient id="flash-grad"><stop offset="0" stop-color="#ffffff"/><stop offset="0.3" stop-color="#cfe6ff" stop-opacity="0.8"/><stop offset="1" stop-color="#7fb2ff" stop-opacity="0"/></radialGradient>
    <radialGradient id="energize-grad"><stop offset="0" stop-color="#dff3ff" stop-opacity="0.7"/><stop offset="0.45" stop-color="#8fd0ff" stop-opacity="0.3"/><stop offset="1" stop-color="#5aa8ff" stop-opacity="0"/></radialGradient>
    <linearGradient id="ao-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.32"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    <pattern id="paving" patternUnits="userSpaceOnUse" width="22" height="40"><rect width="22" height="40" style="fill:var(--paving)"/><rect width="0.9" height="40" style="fill:var(--paving-line)"/></pattern>
    <pattern id="mow" patternUnits="userSpaceOnUse" width="90" height="10"><rect width="45" height="10" style="fill:var(--lawn-dark)"/></pattern>
    <pattern id="chain" patternUnits="userSpaceOnUse" width="5" height="5"><path d="M0,0 L5,5 M5,0 L0,5" style="stroke:var(--chain)" stroke-width="0.5"/></pattern>
    <filter id="glow" filterUnits="userSpaceOnUse" x="-2500" y="-2500" width="7000" height="5000"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter>
    <filter id="blur-sm" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.6"/></filter>
    <filter id="cloud-blur" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>`;

  // ---------- sky layer ----------
  function skyLayer() {
    let s = '<rect x="-900" y="-1700" width="3800" height="2400" fill="url(#sky-grad)"/>';
    s += '<ellipse cx="300" cy="-560" rx="700" ry="260" fill="url(#sun-grad)"/>';
    for (let k = 0; k < 30; k++) {
      const x = -200 + rnd() * 1800, y = -1100 + rnd() * 420;
      s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.6 + rnd() * 0.9)}" style="fill:var(--star)" opacity="${f(0.35 + rnd() * 0.5)}"/>`;
    }
    const clouds = [[180, -880, 1], [760, -960, 0.8], [1250, -860, 0.9], [-80, -700, 0.8]];
    clouds.forEach(([x, y, s2], k) => {
      s += `<g id="cloud-${k}" class="cloud" filter="url(#cloud-blur)" opacity="0.5" style="fill:var(--cloud)">
        <ellipse cx="${x}" cy="${y}" rx="${f(120 * s2)}" ry="${f(18 * s2)}"/>
        <ellipse cx="${f(x + 50 * s2)}" cy="${f(y - 12 * s2)}" rx="${f(70 * s2)}" ry="${f(16 * s2)}"/>
        <ellipse cx="${f(x - 60 * s2)}" cy="${f(y + 4)}" rx="${f(60 * s2)}" ry="${f(10 * s2)}"/></g>`;
    });
    return `<g id="layer-sky">${s}</g>`;
  }

  // ---------- far layer: the rest of the neighbourhood, wrapped around the back of the lot ----------
  const LAWN_X1 = C[0] + 470, LAWN_Y0 = C[1] - 470; // far edges of the street layer's lawn
  function farLayer() {
    // plain grass continuing past the lot to the horizon, with no buildings, so nothing competes
    // with the cul-de-sac
    const s = `<g transform="${GROUND}"><rect x="-2600" y="${LAWN_Y0 - 300}" width="${LAWN_X1 + 300 + 2600}" height="3000" style="fill:var(--lawn)"/></g>`;
    return `<g id="layer-far">${s}</g>`;
  }

  // ---------- windows ----------
  function windowParts(u, z, ww, hh, interior = '') {
    return {
      glow: `<rect class="glow-rect" x="${f(u - 5)}" y="${f(z - 5)}" width="${ww + 10}" height="${hh + 10}" rx="4" filter="url(#blur-sm)"/>`,
      body:
        `<rect x="${f(u - 2)}" y="${f(z - 2)}" width="${ww + 4}" height="${hh + 4}" style="fill:var(--frame)"/>` +
        `<rect class="pane" x="${f(u)}" y="${f(z)}" width="${ww}" height="${hh}"/>` +
        interior +
        `<rect x="${f(u + ww / 2 - 0.6)}" y="${f(z)}" width="1.2" height="${hh}" style="fill:var(--frame)"/>` +
        `<rect x="${f(u - 3.5)}" y="${f(z - 4.5)}" width="${ww + 7}" height="2.6" style="fill:var(--sill)"/>`,
    };
  }
  const ceilLight = (u, z, ww, hh) =>
    `<ellipse class="ceil" cx="${f(u + ww / 2)}" cy="${f(z + hh - 3)}" rx="8" ry="4" fill="url(#ceil-grad)"/>`;

  // ---------- a bungalow at any orientation ----------
  /** Pose: front-centre point F, "back" unit vector b (away from the street), tangent t.
   * Local (u, v, z): u along the facade (-w/2..w/2), v from the facade (0) to the back (D). */
  function house(i, s) {
    const b = [Math.cos(rad(s.a)), Math.sin(rad(s.a))], t = [-b[1], b[0]], F = s.front, w = s.w;
    const W = (u, vv, z = 0) => [F[0] + u * t[0] + vv * b[0], F[1] + u * t[1] + vv * b[1], z];
    const Wl = wall(s.wall), Rf = roof(s.roof), id = `house-${i}`;
    const centre = W(0, D / 2);
    let g = `<g id="${id}" class="house" data-index="${i}" data-cx="${f(centre[0])}" data-cy="${f(centre[1])}">`;
    const shade = [];
    const lit = (n) => (n[0] * -0.8 + n[1] * 0.35 > 0.05 ? Wl.left : Wl.front); // sunset from the left

    // walls: front (-b), right (+t), back (+b), left (-t); draw the visible ones
    const walls = [
      { a: W(-w / 2, 0), b: W(w / 2, 0), n: [-b[0], -b[1], 0], face: 'front' },
      { a: W(w / 2, 0), b: W(w / 2, D), n: [t[0], t[1], 0], face: 'right' },
      { a: W(w / 2, D), b: W(-w / 2, D), n: [b[0], b[1], 0], face: 'back' },
      { a: W(-w / 2, D), b: W(-w / 2, 0), n: [-t[0], -t[1], 0], face: 'left' },
    ];
    const glows = [], bodies = [];
    walls.filter((wl) => visible(wl.n)).forEach((wl) => {
      const q = [[wl.a[0], wl.a[1], 0], [wl.b[0], wl.b[1], 0], [wl.b[0], wl.b[1], H], [wl.a[0], wl.a[1], H]];
      g += poly(q, lit(wl.n));
      shade.push(q);
      const len = Math.hypot(wl.b[0] - wl.a[0], wl.b[1] - wl.a[1]);
      const dir = [(wl.b[0] - wl.a[0]) / len, (wl.b[1] - wl.a[1]) / len];
      const T = WALL(wl.a, dir);
      g += `<rect transform="${T}" x="0" y="0" width="${f(len)}" height="12" fill="url(#ao-grad)"/>`;
      // openings on this wall, in wall-local s (0..len from wl.a) and z
      let glow = '', body = '';
      const add = (u, z, ww, hh, interior) => { const p = windowParts(u, z, ww, hh, interior); glow += p.glow; body += p.body; };
      if (wl.face === 'front') {
        // wl.a is the facade's u = -w/2 corner, so s = u + w/2
        const doorS = s.garage ? w * 0.42 : w * 0.18;
        g += `<g transform="${T}"><rect x="${f(doorS - 2)}" y="0" width="18" height="30" style="fill:var(--frame)"/><rect x="${f(doorS)}" y="0" width="14" height="28" style="fill:var(--door)"/></g>`;
        if (s.garage) {
          g += `<g transform="${T}"><rect x="${f(w * 0.62)}" y="0" width="${f(w * 0.33)}" height="26" style="fill:var(--garage-door)"/>`;
          for (let z = 4; z < 26; z += 4.4) g += `<rect x="${f(w * 0.62)}" y="${z}" width="${f(w * 0.33)}" height="0.8" style="fill:var(--garage-line)"/>`;
          g += '</g>';
          add(w * 0.08, 12, 20, 16, ceilLight(w * 0.08, 12, 20, 16));
        } else {
          add(w * 0.40, 12, 20, 16, s.tv ? `<g class="tv-wrap"><rect id="${id}-tv" class="tv" x="${f(w * 0.40 + 2)}" y="13" width="16" height="8" style="fill:var(--tv)" opacity="0.7"/></g>` : ceilLight(w * 0.40, 12, 20, 16));
          const u2 = w * 0.68;
          let interior = '';
          if (s.fan) {
            const cx = u2 + 11, cy = 12 + 16 - 4;
            interior = `<rect x="${f(cx - 0.4)}" y="${f(cy)}" width="0.8" height="4" style="fill:var(--fan)"/>` +
              `<g transform="translate(${f(cx)},${f(cy)}) scale(1,0.32)"><g id="${id}-fan" class="fan" style="fill:var(--fan)">` +
              [0, 120, 240].map((ang) => `<ellipse cx="5" cy="0" rx="5" ry="1.7" transform="rotate(${ang})"/>`).join('') +
              // invisible ring keeps the bounding box centred on the hub so the fan spins around it
              '<circle r="1.6"/><circle r="10.5" fill="none"/></g></g>';
          }
          add(u2, 12, 22, 16, interior);
        }
      } else if (wl.face !== 'back') {
        add(len * 0.5 - 9, 12, 18, 16, ceilLight(len * 0.5 - 9, 12, 18, 16));
      }
      if (glow) { glows.push(`<g transform="${T}">${glow}</g>`); bodies.push(`<g transform="${T}">${body}</g>`); }
    });
    g += `<g id="${id}-glow">${glows.join('')}</g><g id="${id}-windows">${bodies.join('')}</g>`;

    // low hip roof: four planes up to a short ridge; draw the visible ones
    const E = [W(-w / 2 - O, -O, H), W(w / 2 + O, -O, H), W(w / 2 + O, D + O, H), W(-w / 2 - O, D + O, H)];
    const rr = w / 2 - D / 2;
    const R1 = W(-rr, D / 2, H + RH), R2 = W(rr, D / 2, H + RH);
    const planes = [
      { q: [E[0], E[1], R2, R1], n: [-b[0] * RH, -b[1] * RH, D / 2] },
      { q: [E[1], E[2], R2], n: [t[0] * RH, t[1] * RH, D / 2] },
      { q: [E[2], E[3], R1, R2], n: [b[0] * RH, b[1] * RH, D / 2] },
      { q: [E[3], E[0], R1], n: [-t[0] * RH, -t[1] * RH, D / 2] },
    ];
    planes.filter((p) => visible(p.n)).forEach((p) => {
      const litRoof = p.n[0] * -0.8 + p.n[1] * 0.35 > 0;
      g += poly(p.q, litRoof ? Rf.top : Rf.line);
      shade.push(p.q);
    });
    // fascia board along the visible eaves, and the hip/ridge lines
    walls.forEach((wl, k) => {
      if (!visible(wl.n)) return;
      const a = E[k], c = E[(k + 1) % 4];
      g += poly([a, c, [c[0], c[1], H - 4], [a[0], a[1], H - 4]], Rf.edge);
    });
    g += `<polyline points="${pts([E[0], R1, R2, E[1]])}" stroke="#ffffff" stroke-opacity="0.16" stroke-width="1" fill="none"/>`;

    // service-drop attachment under the front eave
    const att = W(w * 0.3, 0, H - 4);
    const [atx, aty] = iso(att[0], att[1], att[2]);
    g += `<circle cx="${f(atx)}" cy="${f(aty)}" r="1.7" style="fill:var(--bushing)"/>`;

    g += `<g id="${id}-shade" class="shade" style="fill:var(--shade)">${shade.map((q) => `<polygon points="${pts(q)}"/>`).join('')}</g></g>`;

    // ground pieces for this lot: contact shadow, driveway or path, flower bed, light spill
    const foot = [W(-w / 2 - 6, -6), W(w / 2 + 6, -6), W(w / 2 + 6, D + 8), W(-w / 2 - 6, D + 8)];
    const yard = RF - R - WALK; // front yard depth
    const lane = s.garage ? [w * 0.12, w * 0.46] : [w * -0.34, w * -0.18];
    const drive = [W(lane[0], 0), W(lane[1], 0), W(lane[1], -yard), W(lane[0], -yard)];
    const bed = [W(-w / 2 + 2, -2), W(-w / 2 + 2 + (s.garage ? w * 0.5 : w * 0.3), -2), W(-w / 2 + 2 + (s.garage ? w * 0.5 : w * 0.3), -9), W(-w / 2 + 2, -9)];
    const sp = W(0, -yard * 0.55), angDeg = (Math.atan2(t[1], t[0]) * 180) / Math.PI;
    let ground = `<polygon points="${foot.map((p) => p.slice(0, 2).map(f).join(',')).join(' ')}" fill="#000" opacity="0.3" filter="url(#soft)"/>`;
    ground += `<polygon points="${drive.map((p) => p.slice(0, 2).map(f).join(',')).join(' ')}" style="fill:var(--paving)"/>`;
    ground += `<polygon points="${bed.map((p) => p.slice(0, 2).map(f).join(',')).join(' ')}" style="fill:var(--soil)"/>`;
    for (let k = 0; k < 6; k++) {
      const p = W(-w / 2 + 5 + rnd() * (s.garage ? w * 0.46 : w * 0.26), -3 - rnd() * 5);
      ground += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="1.8" style="fill:var(--flower-${1 + (k % 3)})"/>`;
    }
    ground += `<ellipse id="${id}-spill" class="spill" cx="${f(sp[0])}" cy="${f(sp[1])}" rx="80" ry="46" transform="rotate(${f(angDeg)} ${f(sp[0])} ${f(sp[1])})" fill="url(#spill-grad)"/>`;
    return { svg: g, ground, attach: [atx, aty], key: centre[1] - centre[0] };
  }

  // ---------- palms, poles, lamps, car ----------
  function palm(x, y, h, lean = 0) {
    const [bx, by] = iso(x, y, 0), tx = bx + lean, ty = by - h;
    const mx = bx + lean * 0.35, my = by - h * 0.55;
    let s = `<g class="palm"><ellipse cx="${f(bx + 18)}" cy="${f(by + 2)}" rx="26" ry="8" fill="#000" opacity="0.2" filter="url(#blur-sm)"/>`;
    s += `<path d="M${f(bx - 3.5)},${f(by)} Q${f(mx - 2.5)},${f(my)} ${f(tx - 1.6)},${f(ty)} L${f(tx + 1.6)},${f(ty)} Q${f(mx + 2.5)},${f(my)} ${f(bx + 3.5)},${f(by)}Z" style="fill:var(--palm-trunk)"/>`;
    for (let k = 1; k < 9; k++) {
      const tt = k / 9, px = (1 - tt) * (1 - tt) * bx + 2 * (1 - tt) * tt * mx + tt * tt * tx, py = (1 - tt) * (1 - tt) * by + 2 * (1 - tt) * tt * my + tt * tt * ty;
      s += `<line x1="${f(px - 3)}" y1="${f(py)}" x2="${f(px + 3)}" y2="${f(py + 0.8)}" style="stroke:var(--palm-ring)" stroke-width="0.8"/>`;
    }
    // fronds: long drooping leaves fanning out from the crown
    const fr = [[-150, 44, 18], [-120, 40, 10], [-70, 36, 4], [-30, 40, 12], [10, 44, 20], [45, 38, 24], [-95, 30, -4], [150, 34, 20], [-175, 34, 24]];
    fr.forEach(([ang, len, droop], k) => {
      const ex = tx + Math.cos(rad(ang)) * len, ey = ty + Math.sin(rad(ang)) * len * 0.45 + droop;
      const cx = tx + Math.cos(rad(ang)) * len * 0.5, cy = ty + Math.sin(rad(ang)) * len * 0.3 - 8;
      s += `<path d="M${f(tx)},${f(ty)} Q${f(cx)},${f(cy - 3)} ${f(ex)},${f(ey)} Q${f(cx)},${f(cy + 4)} ${f(tx)},${f(ty)}Z" style="fill:var(--palm-${k % 2 ? 1 : 2})"/>`;
    });
    return s + `<circle cx="${f(tx)}" cy="${f(ty + 1)}" r="3.2" style="fill:var(--palm-trunk)"/></g>`;
  }

  function pole(p) {
    const [bx, by] = iso(p[0], p[1], 0), [, ty] = iso(p[0], p[1], WIRE_Z + 6);
    const a1 = iso(p[0] - 9, p[1] + 9, WIRE_Z - 2), a2 = iso(p[0] + 9, p[1] - 9, WIRE_Z - 2), tp = topOf(p);
    return `<g class="pole">
      <ellipse cx="${f(bx + 4)}" cy="${f(by + 1)}" rx="9" ry="3" fill="#000" opacity="0.25"/>
      <rect x="${f(bx - 2.6)}" y="${f(ty)}" width="2.6" height="${f(by - ty)}" style="fill:var(--pole-light)"/>
      <rect x="${f(bx)}" y="${f(ty)}" width="2.6" height="${f(by - ty)}" style="fill:var(--pole-dark)"/>
      <line x1="${f(a1[0])}" y1="${f(a1[1])}" x2="${f(a2[0])}" y2="${f(a2[1])}" style="stroke:var(--pole-dark)" stroke-width="3"/>
      <circle cx="${f(tp[0])}" cy="${f(tp[1])}" r="2" style="fill:var(--bushing)"/></g>`;
  }

  function lamp(j, L) {
    const [x, y] = L.p, hx0 = x + L.dir[0] * 12, hy0 = y + L.dir[1] * 12;
    const [bx, by] = iso(x, y, 0), [tx, ty] = iso(x, y, 82), [hx, hy] = iso(hx0, hy0, 80);
    return `<g id="lamp-${j}" class="lamp" data-x="${f(x)}" data-y="${f(y)}">
      <rect x="${f(bx - 1.6)}" y="${f(ty)}" width="3.2" height="${f(by - ty)}" style="fill:var(--pole-dark)"/>
      <path class="lamp-arm" d="M${f(tx)},${f(ty)} Q${f((tx + hx) / 2)},${f(Math.min(ty, hy) - 6)} ${f(hx)},${f(hy)}"/>
      <circle class="lamp-glow" cx="${f(hx)}" cy="${f(hy + 3)}" r="26" fill="url(#lamp-grad)"/>
      <ellipse class="lamp-bulb" cx="${f(hx)}" cy="${f(hy + 1)}" rx="4" ry="2" style="fill:var(--lamp-light)"/>
      <path d="M${f(hx - 5)},${f(hy)} L${f(hx + 5)},${f(hy)} L${f(hx + 3)},${f(hy - 3.5)} L${f(hx - 3)},${f(hy - 3.5)}Z" style="fill:var(--lamp-head)"/></g>`;
  }

  function transformer() {
    const Y = WIRE_Y;
    const T = { top: v('tx-top'), left: v('tx-left'), front: v('tx-front') };
    const BR = { top: v('pole-dark'), left: v('pole-dark'), front: v('pole-dark') };
    let s = `<g id="transformer" data-x="${f(TX)}" data-y="${f(Y)}">`;
    s += box(TX - 4, TX + 4, Y, Y + 5, 102, 106, BR) + box(TX - 4, TX + 4, Y, Y + 5, 118, 122, BR);
    s += box(TX - 13, TX + 13, Y + 4, Y + 22, 96, 128, T);
    s += `<g transform="${FRONT(Y + 22)}">`;
    for (let u = TX - 11; u <= TX + 10; u += 3.2) s += `<rect x="${f(u)}" y="100" width="1.4" height="24" style="fill:var(--tx-fin)"/>`;
    s += '</g>';
    const tops = [];
    [TX - 8, TX, TX + 8].forEach((bx) => {
      const [x, y] = iso(bx, Y + 13, 128);
      tops.push([x, y - 10]);
      s += `<rect x="${f(x - 1.8)}" y="${f(y - 10)}" width="3.6" height="10" style="fill:var(--bushing)"/>`;
      s += `<ellipse cx="${f(x)}" cy="${f(y - 3)}" rx="3" ry="1.1" style="fill:var(--bushing)"/><ellipse cx="${f(x)}" cy="${f(y - 7)}" rx="3" ry="1.1" style="fill:var(--bushing)"/>`;
    });
    const [sx, sy] = iso(TX, Y + 13, 140);
    s += `<g id="transformer-spark"><circle class="flash" cx="${f(sx)}" cy="${f(sy)}" r="48" fill="url(#flash-grad)"/>`;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.3, r1 = 5, r2 = 14 + (k % 3) * 5;
      s += `<line class="spark-line" x1="${f(sx + Math.cos(a) * r1)}" y1="${f(sy + Math.sin(a) * r1)}" x2="${f(sx + Math.cos(a) * r2)}" y2="${f(sy + Math.sin(a) * r2)}" stroke="#fff6d0" stroke-width="1.4" stroke-linecap="round"/>`;
    }
    s += '</g>';
    // power-on "energise" effect: soft cyan glow, crackling arcs between the bushing tops and
    // down to the tank, and an expanding ring. Hidden until main.js plays it on restore.
    const zigzag = (a, b, n = 5, amp = 3.2) => {
      let d = `M${f(a[0])},${f(a[1])}`;
      for (let k = 1; k < n; k++) {
        const tt = k / n, j = (k % 2 ? 1 : -1) * amp * (0.6 + rnd() * 0.6);
        d += ` L${f(a[0] + (b[0] - a[0]) * tt)},${f(a[1] + (b[1] - a[1]) * tt + j)}`;
      }
      return d + ` L${f(b[0])},${f(b[1])}`;
    };
    const [tankX, tankY] = iso(TX, Y + 22, 110);
    s += `<g id="transformer-energize">
      <circle class="energize-glow" cx="${f(sx)}" cy="${f(sy + 14)}" r="54" fill="url(#energize-grad)"/>
      <circle class="energize-ring" cx="${f(sx)}" cy="${f(sy + 14)}" r="30" fill="none" stroke="#bfe6ff" stroke-width="1.6"/>
      <g class="energize-arcs" fill="none" stroke="#e8f6ff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)">
        <path d="${zigzag(tops[0], tops[1])}"/><path d="${zigzag(tops[1], tops[2])}"/>
        <path d="${zigzag(tops[0], [tankX - 12, tankY], 6, 4)}"/><path d="${zigzag(tops[2], [tankX + 12, tankY + 4], 6, 4)}"/>
      </g></g>`;
    return s + '</g>';
  }

  // ---------- street layer ----------
  function streetLayer() {
    const built = HOUSES.map((h, i) => house(i, h));

    // ground: lawn, entry road with double yellow line, sidewalks, turnaround, lot pieces, pools
    let s = `<g transform="${GROUND}">
      <rect x="-2600" y="${LAWN_Y0}" width="${LAWN_X1 + 2600}" height="3200" style="fill:var(--lawn)"/>
      <rect x="-2600" y="${C[1] + ROAD_HW + WALK + 20}" width="${LAWN_X1 + 2600}" height="2000" fill="url(#mow)" opacity="0.45"/>
      <rect x="-2600" y="${C[1] - ROAD_HW - WALK}" width="${C[0] + 2600}" height="${2 * (ROAD_HW + WALK)}" style="fill:var(--paving)"/>
      <circle cx="${C[0]}" cy="${C[1]}" r="${R + WALK}" style="fill:var(--paving)"/>
      <circle cx="${C[0]}" cy="${C[1]}" r="${R + 2}" style="fill:var(--kerb)"/>
      <rect x="-2600" y="${C[1] - ROAD_HW - 2}" width="${C[0] + 2600}" height="${2 * ROAD_HW + 4}" style="fill:var(--kerb)"/>
      <rect x="-2600" y="${C[1] - ROAD_HW}" width="${C[0] + 2600}" height="${2 * ROAD_HW}" style="fill:var(--road)"/>
      <circle cx="${C[0]}" cy="${C[1]}" r="${R}" style="fill:var(--road)"/>
      <circle cx="${C[0]}" cy="${C[1]}" r="${R * 0.55}" style="fill:var(--road-patch)" opacity="0.5"/>
      <rect x="-2600" y="${C[1] - 2.4}" width="${C[0] - R - 20 + 2600}" height="1.6" style="fill:var(--road-yellow)"/>
      <rect x="-2600" y="${C[1] + 0.8}" width="${C[0] - R - 20 + 2600}" height="1.6" style="fill:var(--road-yellow)"/>`;
    built.forEach((b) => (s += b.ground));
    LAMPS.forEach((L, j) => (s += `<ellipse id="lamp-${j}-pool" class="lamp-pool" data-lamp="${j}" cx="${f(L.p[0] + L.dir[0] * 20)}" cy="${f(L.p[1] + L.dir[1] * 20)}" rx="40" ry="34" fill="url(#pool-grad)"/>`));
    s += '</g>';

    // depth-sorted solids: houses, palms, hedges, the car (smaller y - x is farther away)
    const items = built.map((b) => ({ key: b.key, s: b.svg }));
    const palms = [
      [-140, 300, 190, 8], [-104, 312, 175, -6], [-68, 300, 200, 6], [-32, 310, 180, -8], [4, 300, 195, 5], [40, 290, 170, -4], [-160, 250, 150, 6],
    ];
    palms.forEach(([a, r, h, lean]) => { const p = ring(a, r); items.push({ key: p[1] - p[0], s: palm(p[0], p[1], h, lean) }); });
    [[180, C[1] + ROAD_HW + WALK + 40, 185, -8], [-240, C[1] - ROAD_HW - WALK - 30, 170, 4]]
      .forEach(([x, y, h, lean]) => items.push({ key: y - x, s: palm(x, y, h, lean) }));
    [-104, -68, -32, 4].forEach((a) => {
      const p = ring(a, RF + 6);
      items.push({ key: p[1] - p[0], s: box(p[0] - 8, p[0] + 8, p[1] - 8, p[1] + 8, 0, 10, HEDGE) });
    });
    items.sort((a, b) => a.key - b.key).forEach((it) => (s += it.s));

    // chain-link fence along the near side of the road
    const fy = C[1] + ROAD_HW + WALK + 8;
    s += `<g transform="${FRONT(fy)}"><rect x="-2600" y="0" width="${C[0] - 180 + 2600}" height="18" fill="url(#chain)"/><rect x="-2600" y="17" width="${C[0] - 180 + 2600}" height="1.2" style="fill:var(--chain)"/>`;
    for (let x = -1200; x < C[0] - 180; x += 60) s += `<rect x="${x}" y="0" width="1.4" height="19" style="fill:var(--chain)"/>`;
    s += '</g>';

    // poles, lamps and the transformer, farther first
    const street = POLES.map((p) => ({ key: p[1] - p[0], s: pole(p) + (p[0] === TX ? transformer() : '') }))
      .concat(LAMPS.map((L, j) => ({ key: L.p[1] - L.p[0], s: lamp(j, L) })));
    street.sort((a, b) => a.key - b.key).forEach((it) => (s += it.s));

    // main line (static wire + pulse running from the transformer back along the road)
    s += `<path id="main-line" class="wire" d="${wirePath(POLES)}"/>`;
    s += `<path id="main-line-pulse-left" class="pulse main-pulse" d="${wirePath([...POLES].reverse())}"/>`;

    // service drops: the street house from its nearest road pole, the rest fan out from the transformer
    built.forEach((b, i) => {
      const from = i === 0 ? topOf(POLES[4]) : topOf([TX, WIRE_Y]);
      const A = b.attach;
      const d = `M${from.map(f)} Q${f((from[0] + A[0]) / 2)},${f((from[1] + A[1]) / 2 + 14)} ${A.map(f)}`;
      s += `<g id="house-${i}-drop" class="drop"><path class="wire" stroke-width="0.9" d="${d}"/><path class="pulse drop-pulse" d="${d}"/></g>`;
    });

    // birds perched on the service drop to the house on the right of the turnaround
    s += '<g id="birds">';
    const perch = [topOf([TX, WIRE_Y]), built[4].attach];
    [0.5, 0.6, 0.74].forEach((tt, k) => {
      const [bx, by] = bez(perch[0], perch[1], tt, 14);
      s += `<g transform="translate(${f(bx)},${f(by - 1)})"><g id="bird-${k}" class="bird">
        <path d="M-6,-3 C-4,-7.5 2,-7.5 4,-5.5 L7.5,-6.5 L5,-3.2 C4,0 -2,0.5 -6,-3Z"/>
        <path d="M-9,-2.5 L-5.5,-3.6 L-5.5,-2Z"/>
        <path class="wing" d="M-2,-5.5 L-6,-13 L3,-6.5Z"/></g></g>`;
    });
    s += '</g>';
    return `<g id="layer-street">${s}</g>`;
  }

  svg.innerHTML = defs + skyLayer() + farLayer() + streetLayer() +
    '<rect id="scene-dim" x="-900" y="-1700" width="3800" height="2800"/>';
})();

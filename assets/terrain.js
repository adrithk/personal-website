// Homepage background: a dotted loss landscape behind the introduction.
// The terrain is drawn row by row from back to front, so nearer ridges hide what is behind them. On load the
// dots spawn in as a wave; they shift away from the cursor; a click on an empty part of the introduction drops
// a ball that rolls down the gradient and sends a ripple through the dots when it settles. While scrolling,
// the backdrop drifts up a little and fades out, so the next section arrives on the plain page.
// Progressive enhancement: without JavaScript the page is simply the page; with reduced motion the terrain is
// drawn still and no balls drop. Styles are in the "Homepage terrain" block of styles.css.
//
// Performance: the still terrain is drawn once into an offscreen cache (refreshed about once a second for the
// slow colour drift) and copied to the screen. Only the patch around the cursor is redrawn live, and the whole
// scene is redrawn every frame only during the spawn-in wave and while a ripple runs. Dots that nearer ridges
// always hide are found once, when the grid is built, and never drawn. The frame loop sleeps when nothing moves.
(() => {
  const canvas = document.querySelector('.terrain-canvas');
  if (!canvas || !canvas.getContext) return;
  // The backdrop's placement is also set here, so the page layout never depends on a stylesheet the browser
  // may still have cached from before the canvas existed.
  Object.assign(canvas.style, { position:'fixed', top:'0', left:'0', width:'100%', height:'100vh', zIndex:'-1', pointerEvents:'none', display:'block' });
  const ctx = canvas.getContext('2d');
  const cache = document.createElement('canvas');
  const cctx = cache.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PAPER = '#101010';
  let W = 0, H = 0, VH = innerHeight, DPR = 1;

  const clamp01 = v => Math.min(1, Math.max(0, v));
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

  // ---- Ground: ridged noise with softened creases (so slopes, and the ball, change smoothly) ----
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const ridged = (x, y) => {
    let s = 0, amp = .55, fr = 1, w = 1;
    for (let o = 0; o < 3; o++) {
      const q = vnoise(x * fr, y * fr) * 2 - 1;
      let n = 1 - Math.sqrt(q * q + .012);
      n *= n; n *= w; w = Math.min(1, n * 2.2);
      s += n * amp; fr *= 2.05; amp *= .5;
    }
    return s;
  };
  // Mountains across the whole width, tallest on the left (rising behind the text) and at mid-distance;
  // the near ground never drops away completely, so the bottom of the window is always covered.
  const ground = (x, z) => .1 + (ridged(x * 1.15 + 4.2, z * 1.35 + 9.1) * 1.05 - .1)
    * (.62 + .38 * smooth(1.2, -1.3, x)) * (.45 + .55 * Math.exp(-((z + .55) ** 2) * 1.6)) * 2.8;
  const slope = (x, z, h = .01) => [(ground(x + h, z) - ground(x - h, z)) / (2 * h), (ground(x, z + h) - ground(x, z - h)) / (2 * h)];

  // ---- Camera: low, looking across the range ----
  let f = 1000, cx = 0, cy = 0;
  const CAM = { y:1.4, z:2.6, pitch:.32 };
  const cp = Math.cos(CAM.pitch), sp = Math.sin(CAM.pitch);
  const tmp = [0, 0, 0];
  const project = (x, y, z, out) => {
    const Y = y - CAM.y, Z = z - CAM.z;
    const Y2 = Y * cp - Z * sp, Z2 = Y * sp + Z * cp;
    const d = -Z2;
    out[0] = cx + x / d * f; out[1] = cy - Y2 / d * f; out[2] = d;
    return out;
  };

  // ---- Cursor and ripple tuning (also bounds how far a dot can move, for the occlusion test below) ----
  const R = 130, R2 = R * R;    // cursor radius of influence, px
  const PUSH = 16, LIFT_PX = 7; // the largest sideways push and extra lift a dot gets from the cursor
  const SETTLE = 10;            // how far above its place a dot starts during the spawn-in
  const MAX_SIZE = 8;           // largest dot sprite, px

  // ---- A grid of dots: even spacing across and into the scene, tightening toward the camera so the
  //      foreground stays filled instead of opening into black gaps ----
  let SP = .024;
  const ZFAR = -1.8, ZNEAR = 1.3;
  let rows = 0, rowZ, rowStart, rowLen, rowSize, rowFog, visStart, visIdx;
  let px, py, wx, hts, baseA, glowA, appear, spawnEnd = 0;
  const Lx = -.42, Ly = .66, Lz = .62;
  const build = () => {
    const zs = [], steps = [];
    for (let z = ZFAR; z <= ZNEAR; ) {
      project(0, 0, z, tmp);
      const step = SP * Math.min(1, Math.max(.45, tmp[2] / 2.9)) * (1 - .22 * smooth(3.4, 4.6, tmp[2]));
      zs.push(z); steps.push(step); z += step;
    }
    rows = zs.length;
    rowZ = Float32Array.from(zs); rowStart = new Int32Array(rows); rowLen = new Int32Array(rows);
    rowSize = new Float32Array(rows); rowFog = new Float32Array(rows);
    let total = 0;
    const halves = [];
    for (let j = 0; j < rows; j++) {
      project(0, 0, rowZ[j], tmp);
      const n = Math.ceil(((W / 2 + 50) / f * tmp[2]) / steps[j]);
      halves.push(n); rowStart[j] = total; rowLen[j] = 2 * n + 1; total += 2 * n + 1;
    }
    px = new Float32Array(total); py = new Float32Array(total);
    wx = new Float32Array(total); hts = new Float32Array(total);
    baseA = new Float32Array(total); glowA = new Float32Array(total); appear = new Float32Array(total);
    // Behind the copy and the diagram the dots dim a little (never disappear), with a soft edge.
    const boxes = [...document.querySelectorAll('.hero .hero-copy > *, .hero .hero-art, .terrain-hint')].map(el => {
      const r = el.getBoundingClientRect(), top = r.top + scrollY; return { l:r.left - 24, r:r.right + 24, t:top - 18, b:top + r.height + 18 };
    });
    // The spawn-in spreads from a point on the ground in the middle distance, right of the copy.
    const ox = .6, oz = -.6;
    let lastAppear = 0;
    for (let j = 0; j < rows; j++) {
      const z = rowZ[j], a0 = rowStart[j];
      for (let i = 0; i < rowLen[j]; i++) {
        const k = a0 + i, x = (i - halves[j]) * steps[j];
        const h = ground(x, z), [sx, sz] = slope(x, z);
        wx[k] = x; hts[k] = h;
        const lit = Math.max(0, (-sx * Lx + Ly - sz * Lz) / Math.hypot(sx, 1, sz));
        project(x, h, z, tmp);
        px[k] = tmp[0]; py[k] = tmp[1];
        let near = 1e9;
        for (const b of boxes) near = Math.min(near, Math.hypot(Math.max(b.l - tmp[0], 0, tmp[0] - b.r), Math.max(b.t - tmp[1], 0, tmp[1] - b.b)));
        const textFade = .5 + .5 * smooth(0, 90, near);
        // every dot keeps some light, shadow sides just dimmer; kept quiet overall and faded behind the text
        baseA[k] = (.24 + .47 * Math.pow(lit, 1.1)) * textFade;
        glowA[k] = .35 * textFade;
        appear[k] = Math.hypot(x - ox, (z - oz) * 1.3) * .3 + hash(i * 1.7, j * 3.1) * .12;
        if (appear[k] > lastAppear) lastAppear = appear[k];
      }
      const d = depthAt(a0 + (rowLen[j] >> 1), j);
      rowFog[j] = clamp01(2.7 - d * .3);
      rowSize[j] = Math.min(MAX_SIZE, Math.max(3, 12 / d));   // sprite size; the bright core is about a third
    }
    spawnEnd = lastAppear + .4;
    cull(total);
  };
  // Depth of one grid point, recomputed from its world position (only needed per row, at build time).
  const depthAt = (k, j) => project(wx[k], hts[k], rowZ[j], tmp)[2];

  // Every row paints the ground in front of it from its ridge line down, hiding the farther rows. A dot whose
  // sprite (moved as far as the cursor or the spawn-in can ever move it) lies wholly under the ridges of nearer
  // rows can never be seen, so it is left out of the drawing lists. `occ[c]` is the highest y below which
  // screen column c (the strip c..c+1) is already covered by some nearer row.
  const cull = total => {
    const MX = PUSH + 1, MUP = PUSH + LIFT_PX + SETTLE + 2;
    const occ = new Float32Array(W + 1).fill(Infinity), colMax = new Float32Array(W + 1);
    const keep = new Uint8Array(total);
    for (let j = rows - 1; j >= 0; j--) {
      const a0 = rowStart[j], n = rowLen[j], half = rowSize[j] / 2;
      for (let k = a0; k < a0 + n; k++) {
        const c0 = Math.max(0, Math.floor(px[k] - half - MX)), c1 = Math.min(W, Math.floor(px[k] + half + MX));
        const top = py[k] - half - MUP;
        let lowest = -Infinity;
        for (let c = c0; c <= c1 && lowest < top; c++) if (occ[c] > lowest) lowest = occ[c];
        keep[k] = c0 > c1 || !(lowest < top) ? 1 : 0;
      }
      // Add this row's ridge (the top edge of its fill) to the covered area.
      colMax.fill(-Infinity);
      for (let k = a0; k < a0 + n - 1; k++) {
        let xa = px[k], ya = py[k] + 1.5, xb = px[k + 1], yb = py[k + 1] + 1.5;
        if (xb < xa) { let s = xa; xa = xb; xb = s; s = ya; ya = yb; yb = s; }
        const span = xb - xa || 1, ca = Math.max(0, Math.floor(xa)), cb = Math.min(W, Math.floor(xb));
        for (let c = ca; c <= cb; c++) {
          const l = Math.max(xa, c), r = Math.min(xb, c + 1);
          const y = Math.max(ya + (yb - ya) * (l - xa) / span, ya + (yb - ya) * (r - xa) / span);
          if (y > colMax[c]) colMax[c] = y;
        }
      }
      for (let c = Math.max(0, Math.ceil(px[a0])), e = Math.min(W, Math.floor(px[a0 + n - 1]) - 1); c <= e; c++) {
        if (colMax[c] < occ[c]) occ[c] = colMax[c];
      }
    }
    let count = 0;
    for (let k = 0; k < total; k++) count += keep[k];
    visIdx = new Int32Array(count); visStart = new Int32Array(rows + 1);
    let v = 0;
    for (let j = 0; j < rows; j++) {
      visStart[j] = v;
      for (let k = rowStart[j], e = k + rowLen[j]; k < e; k++) if (keep[k]) visIdx[v++] = k;
    }
    visStart[rows] = v;
  };

  // ---- Round, softly glowing dot sprites in a few shades from pale pink to hot pink ----
  const SHADES = 10;
  const STOPS = [[136, 40, 222], [196, 52, 212], [230, 63, 192], [248, 64, 150], [255, 112, 176]];
  const ROSE = [226, 160, 184];   // the 'adrithk' wordmark colour (#c9a1ad), lifted a little for dots
  const TINTS = 4;
  let sprites = [];               // sprites[tint][shade]
  const makeSprites = () => {
    sprites = [];
    for (let tIdx = 0; tIdx < TINTS; tIdx++) {
      const row = [], mix = tIdx / (TINTS - 1) * .55;
      for (let sIdx = 0; sIdx < SHADES; sIdx++) {
        const fpos = sIdx / (SHADES - 1) * (STOPS.length - 1), k = Math.min(STOPS.length - 2, Math.floor(fpos)), u = fpos - k;
        const base = STOPS[k].map((c, n) => c + (STOPS[k + 1][n] - c) * u);
        const [r, g, b] = base.map((c, n) => Math.round(c + (ROSE[n] - c) * mix));
        const c = document.createElement('canvas'), Rs = 8 * DPR;
        c.width = c.height = Rs * 2;
        const o = c.getContext('2d');
        const grad = o.createRadialGradient(Rs, Rs, 0, Rs, Rs, Rs);
        // a slightly lighter core keeps the colour readable on black
        grad.addColorStop(0, `rgba(${Math.min(255, r + 60)},${Math.min(255, g + 50)},${Math.min(255, b + 30)},1)`);
        grad.addColorStop(.3, `rgba(${r},${g},${b},.95)`);
        grad.addColorStop(.55, `rgba(${r},${g},${b},.25)`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        o.fillStyle = grad; o.fillRect(0, 0, Rs * 2, Rs * 2);
        row.push(c);
      }
      sprites.push(row);
    }
  };

  // ---- Drawing the terrain ----
  // Draws the scene into `c`, limited to the box x0..x1, y0..y1 (the caller clips to it). `tc` is the clock for
  // the slow colour drift, `since` the time since the spawn-in began, and `live` adds the cursor and ripples.
  const drawTerrain = (c, x0, y0, x1, y1, tc, since, live) => {
    c.globalAlpha = 1; c.fillStyle = PAPER; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    const partial = x0 > 0 || x1 < W;
    const reach = PUSH + LIFT_PX + SETTLE + MAX_SIZE;   // how far a dot can be drawn from its place
    const cursor = live && mouse.on > .01, mOn = mouse.on, msx = mouse.sx, msy = mouse.sy;
    const spawning = since < spawnEnd;
    let lowest = -1e9;                                   // bottom edge of the lowest dot drawn so far
    for (let j = 0; j < rows; j++) {
      const a0 = rowStart[j], n = rowLen[j];
      // Hide what this row's ridge covers. Nothing has been drawn below `lowest`, so the fill stops there.
      let i0 = 0, i1 = n - 1;
      if (partial) {
        while (i0 < n - 1 && px[a0 + i0 + 1] < x0) i0++;
        while (i1 > 0 && px[a0 + i1 - 1] > x1) i1--;
      }
      let top = 1e9, bottom = -1e9;
      for (let i = i0; i <= i1; i++) { const y = py[a0 + i]; if (y < top) top = y; if (y > bottom) bottom = y; }
      if (lowest > top + 1.5 && top < y1) {
        const floor = Math.min(y1 + 20, Math.max(lowest + 2, bottom + 3));
        c.globalAlpha = 1; c.fillStyle = PAPER; c.beginPath(); c.moveTo(px[a0 + i0], floor);
        for (let i = i0; i <= i1; i++) c.lineTo(px[a0 + i], py[a0 + i] + 1.5);
        c.lineTo(px[a0 + i1], floor); c.closePath(); c.fill();
      }

      const fog = rowFog[j], size = rowSize[j], half = size / 2, zj = rowZ[j];
      for (let v = visStart[j], ve = visStart[j + 1]; v < ve; v++) {
        const k = visIdx[v];
        let x = px[k], y = py[k];
        if (x < x0 - reach || x > x1 + reach || y < y0 - reach || y > y1 + reach) continue;
        if (x < -6 || x > W + 6 || y < -6 || y > H + 6) continue;
        // spawn-in: each dot fades in and settles a few pixels as the wave reaches it, with a brief flash
        let e = 1;
        if (spawning) { e = clamp01((since - appear[k]) / .35); if (e <= 0) continue; }
        const settle = 1 - e;
        y -= settle * settle * SETTLE;
        let a = fog * baseA[k] * e + settle * e * glowA[k];
        if (cursor) {
          const dx = x - msx, dy = y - msy, dd = dx * dx + dy * dy;
          if (dd < R2) {
            const dist = Math.sqrt(dd) || 1, g = 1 - dist / R, push = g * g * PUSH * mOn;
            x += dx / dist * push; y += dy / dist * push - g * g * LIFT_PX * mOn;
            a += g * .3 * mOn;
          }
        }
        if (live) for (const rp of ripples) {
          const age = t - rp.t0, dist = Math.hypot(wx[k] - rp.x, zj - rp.z);
          a += Math.exp(-((dist - age * .45) ** 2) * 90) * Math.max(0, 1 - age / 3) * .5;
        }
        if (a < .03) continue;
        const u = clamp01(hts[k] / 1.9 - .05 + .12 * Math.sin(tc * .15 + wx[k] * .35));
        c.globalAlpha = Math.min(.95, a);
        const tint = Math.round(smooth(VH * .6, VH * 1.05, y) * (TINTS - 1));
        c.drawImage(sprites[tint][Math.round(u * (SHADES - 1))], x - half, y - half, size, size);
        if (y + half > lowest) lowest = y + half;
      }
    }
    c.globalAlpha = 1;
  };

  // ---- Interaction ----
  const mouse = { x:-1e4, y:-1e4, sx:-1e4, sy:-1e4, on:0 };
  addEventListener('pointermove', e => {
    if (mouse.sx < -1e3) { mouse.sx = e.clientX; mouse.sy = e.clientY; }
    mouse.x = e.clientX; mouse.y = e.clientY;
    wake();
  }, { passive:true });
  document.documentElement.addEventListener('mouseleave', () => { mouse.x = mouse.y = -1e4; wake(); });
  // Touch has no 'leave': when the finger lifts, the dots settle back.
  const lift = e => { if (e.pointerType !== 'mouse') { mouse.x = mouse.y = -1e4; wake(); } };
  addEventListener('pointerup', lift);
  addEventListener('pointercancel', lift);
  const balls = [], ripples = [];
  const LIFT = .03;        // the ball sits this far above the ground
  const TRAIL_LIFE = 2.2;  // seconds before a piece of trail has faded away
  // The ground point on row j that projects to screen x = sx (a few fixed-point steps, since depth
  // depends on height).
  const onRow = (j, sx) => {
    const z = rowZ[j];
    let x = (sx - cx) / f * 3;
    for (let n = 0; n < 4; n++) { project(x, ground(x, z) + LIFT, z, tmp); x = (sx - cx) * tmp[2] / f; }
    project(x, ground(x, z) + LIFT, z, tmp);
    return { x, z, y:tmp[1] };
  };
  // Straight below the cursor: the front-most row whose surface passes above it, or, when the cursor is
  // above the whole range, the highest surface in that column.
  const below = (sx, sy) => {
    let top = null;
    for (let j = rows - 1; j >= 0; j--) {
      const p = onRow(j, sx);
      if (p.y <= sy) return p;
      if (!top || p.y < top.y) top = p;
    }
    return top;
  };
  // The canvas is behind the page, so clicks come from the window; links and buttons keep their own clicks.
  addEventListener('click', e => {
    if (reduce || !built || e.target.closest('a, button, input, label, summary, select, textarea') || fadeOut < .4) return;
    const cy_ = e.clientY + scrollY * DRIFT;   // the canvas has drifted up by this much
    const p = below(e.clientX, cy_);
    if (!p) return;
    if (balls.length > 6) balls.shift();
    balls.push({ x:p.x, z:p.z, vx:0, vz:0, sx:e.clientX, sy:cy_, landY:p.y, vy:0, falling:p.y > cy_ + 1, trail:[], still:0, done:false });
    wake();
  });

  // Balls: they fall from the cursor, then roll slowly, following a smoothed slope. A ball that has come to
  // rest and whose trail has faded is left where it is and no longer simulated.
  const resting = b => b.done && !b.trail.length;
  const stepBalls = dt => {
    for (const b of balls) {
      if (resting(b)) continue;
      if (b.falling) {
        b.vy += 1800 * dt; b.sy += b.vy * dt;
        if (b.sy >= b.landY) b.falling = false;
        continue;
      }
      const steps = 4, kk = dt * 60 / steps;
      for (let s = 0; s < steps; s++) {
        const [gx, gz] = slope(b.x, b.z, .05);
        b.vx = b.vx * Math.pow(.993, kk) - .000028 * gx * kk;
        b.vz = b.vz * Math.pow(.993, kk) - .000028 * gz * kk;
        const v = Math.hypot(b.vx, b.vz), cap = .0016;
        if (v > cap) { b.vx *= cap / v; b.vz *= cap / v; }
        b.x += b.vx * kk; b.z = Math.min(ZNEAR, Math.max(ZFAR, b.z + b.vz * kk));
      }
      const prev = b.trail[b.trail.length - 1];
      if (!b.done && (!prev || Math.hypot(prev[0] - b.x, prev[1] - b.z) > .006)) b.trail.push([b.x, b.z, t]);
      while (b.trail.length && t - b.trail[0][2] > TRAIL_LIFE) b.trail.shift();
      b.still = Math.hypot(b.vx, b.vz) < .00012 ? b.still + dt : 0;
      if (b.still > .7 && !b.done) { b.done = true; ripples.push({ x:b.x, z:b.z, t0:t }); }
    }
    for (let i = ripples.length - 1; i >= 0; i--) if (t - ripples[i].t0 > 3.2) ripples.splice(i, 1);
  };

  // A purple ball with a soft glow and a fading trail along the ground.
  const drawBall = b => {
    if (b.trail.length > 1) {
      ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#a77bff';
      let prevX = 0, prevY = 0;
      b.trail.forEach(([x, z, born], i) => {
        project(x, ground(x, z) + .02, z, tmp);
        const age = Math.min(1, (t - born) / TRAIL_LIFE);
        if (i) { ctx.globalAlpha = .55 * (1 - age) * (1 - age); ctx.beginPath(); ctx.moveTo(prevX, prevY); ctx.lineTo(tmp[0], tmp[1]); ctx.stroke(); }
        prevX = tmp[0]; prevY = tmp[1];
      });
    }
    project(b.x, ground(b.x, b.z) + LIFT, b.z, tmp);
    const d = tmp[2], r = Math.max(3.4, 13 / d);
    const x = b.falling ? b.sx : tmp[0], y = b.falling ? Math.min(b.sy, b.landY) : tmp[1];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
    g.addColorStop(0, 'rgba(150,100,255,.6)'); g.addColorStop(.45, 'rgba(124,72,240,.2)'); g.addColorStop(1, 'rgba(124,72,240,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 6, 0, Math.PI * 2); ctx.fill();
    const core = ctx.createRadialGradient(x - r * .3, y - r * .3, 0, x, y, r);
    core.addColorStop(0, '#f1e9ff'); core.addColorStop(.6, '#b08bff'); core.addColorStop(1, '#7c4ef0');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  };

  // A small hint in the introduction telling visitors they can drop a ball. It is added here, so it only
  // exists when the terrain does; it fades in once the terrain has loaded, then fades out with the backdrop on scroll.
  const hero = document.querySelector('.hero .hero-copy');
  let hint = null, hintDone = reduce || !hero;
  if (!hintDone) {
    hint = document.createElement('p');
    hint.className = 'terrain-hint';
    hint.setAttribute('aria-hidden', 'true');
    const verb = matchMedia('(hover: none)').matches ? 'tap' : 'click';
    hint.innerHTML = `<span class="terrain-hint-dot"></span>${verb} anywhere to descend the gradient`;
    hero.append(hint);
  }
  const showHint = () => {
    if (hintDone || !built || t - born <= 1.1) return;
    hintDone = true; hint.classList.add('on');
    setTimeout(() => hint.classList.add('settled'), 800); // after the fade-in, track the scroll fade closely
  };

  // ---- Frame loop ----
  const DRIFT = .3;   // the backdrop moves up at 30% of the scroll speed while it fades
  const CACHE_EVERY = 1;  // seconds between redraws of the still terrain (for the slow colour drift)
  let t = 0, last = 0, born = 0, fadeOut = 1, built = false;
  let cacheT = -1;        // the drift clock the cache was drawn at; -1 when it must be redrawn
  let overlay = false;    // whether the screen shows anything on top of the cache (cursor patch, balls, full frame)
  let lastOn = 0, lastSx = 0, lastSy = 0, lastOpacity = '', lastShift = '';
  let raf = 0, timer = 0;
  const wake = () => { if (!raf && built) { clearTimeout(timer); timer = 0; raf = requestAnimationFrame(frame); } };

  const frame = now => {
    raf = 0;
    const elapsed = last ? Math.min(1, Math.max(0, (now - last) / 1000)) : 0;
    last = now;
    const dt = reduce ? 0 : Math.min(.05, elapsed);
    if (!reduce) t += elapsed;
    const present = mouse.x > -1e3;
    mouse.on += ((present ? 1 : 0) - mouse.on) * Math.min(1, dt * 5);
    if (mouse.on < .005 && !present) mouse.on = 0;
    if (present) { mouse.sx += (mouse.x - mouse.sx) * Math.min(1, dt * 9); mouse.sy += (mouse.y + scrollY * DRIFT - mouse.sy) * Math.min(1, dt * 9); }
    showHint();

    // Scroll: drift up and fade out. Styles are written only when they change.
    fadeOut = 1 - smooth(0, VH * .6, scrollY);
    const opacity = fadeOut.toFixed(3), shift = `translate3d(0,${(-scrollY * DRIFT).toFixed(1)}px,0)`;
    if (opacity !== lastOpacity) {
      lastOpacity = opacity; canvas.style.opacity = opacity;
      if (hint) hint.style.setProperty('--fade', opacity);
    }
    if (shift !== lastShift) { lastShift = shift; canvas.style.transform = shift; }
    if (fadeOut <= 0) return;   // out of sight: sleep until a scroll brings it back

    const since = reduce ? 99 : t - born;
    const spawning = since < spawnEnd;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (spawning || ripples.length) {
      // The whole scene changes: draw everything, live.
      drawTerrain(ctx, 0, 0, W, H, t, since, true);
      overlay = true;
    } else {
      let fresh = false;
      if (cacheT < 0 || t - cacheT >= CACHE_EVERY) {
        cctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        drawTerrain(cctx, 0, 0, W, H, t, 99, false);
        cacheT = t; fresh = true;
      }
      const cursor = mouse.on > .01;
      const moved = cursor && (Math.abs(mouse.sx - lastSx) > .05 || Math.abs(mouse.sy - lastSy) > .05 || Math.abs(mouse.on - lastOn) > .002);
      const live = balls.some(b => !resting(b));
      if (fresh || moved || live || overlay) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(cache, 0, 0);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        overlay = false;
        if (cursor) {
          // Redraw the patch around the cursor with the dots pushed aside, on top of the cached scene.
          const m = R + PUSH + LIFT_PX + MAX_SIZE;
          const x0 = Math.max(0, Math.floor(mouse.sx - m)), y0 = Math.max(0, Math.floor(mouse.sy - m));
          const x1 = Math.min(W, Math.ceil(mouse.sx + m)), y1 = Math.min(H, Math.ceil(mouse.sy + m));
          if (x1 > x0 && y1 > y0) {
            ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
            drawTerrain(ctx, x0, y0, x1, y1, cacheT, 99, true);
            ctx.restore();
            overlay = true;
          }
          lastSx = mouse.sx; lastSy = mouse.sy; lastOn = mouse.on;
        }
        if (balls.length) { for (const b of balls) drawBall(b); overlay = true; }
      }
    }
    stepBalls(dt);
    if (spawning || ripples.length) for (const b of balls) drawBall(b);
    ctx.globalAlpha = 1;

    // Keep animating while anything moves; otherwise sleep until an event, or the next colour-drift redraw.
    const settling = present ? Math.abs(mouse.x - mouse.sx) + Math.abs(mouse.y + scrollY * DRIFT - mouse.sy) > .1 || mouse.on < .99 : mouse.on > 0;
    const busy = !reduce && (spawning || ripples.length || balls.some(b => !resting(b)) || settling || !hintDone);
    if (busy) raf = requestAnimationFrame(frame);
    else { if (!reduce) timer = setTimeout(wake, Math.max(16, (CACHE_EVERY - (t - cacheT)) * 1000)); }
  };

  const resize = () => {
    DPR = Math.min(devicePixelRatio || 1, document.documentElement.clientWidth < 700 ? 1.5 : 2);
    W = document.documentElement.clientWidth; VH = innerHeight; H = canvas.clientHeight || VH;
    if (!W || !VH) return;  // not laid out yet (e.g. a hidden tab); the next resize builds it
    SP = W < 700 ? .032 : .024;
    canvas.width = cache.width = Math.round(W * DPR); canvas.height = cache.height = Math.round(H * DPR);
    f = Math.max(W * .7, VH * 1.05);
    cx = W * .5; cy = VH * .66;
    build(); makeSprites();
    cacheT = -1; overlay = true;
    if (!built) { built = true; born = t; }
    wake();
  };

  let lastWidth = 0;
  addEventListener('resize', () => {
    const w = document.documentElement.clientWidth;
    if (built && w === lastWidth) return;
    lastWidth = w;
    resize();
  });
  addEventListener('scroll', wake, { passive:true });
  const start = () => { lastWidth = document.documentElement.clientWidth; resize(); };
  document.fonts?.ready ? document.fonts.ready.then(start) : start();
})();

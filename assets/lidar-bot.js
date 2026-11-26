// Homepage, below the introduction: the ordinary cursor sweeps the page with a faint lidar.
// Each ray stops at the first line of text, image or link it meets and leaves a dot there, so the layout is traced
// out as a fading point cloud around the pointer. Hovering a link locks brackets onto it. A click anywhere deploys a
// tiny autonomous vehicle that drives around the page on its own, steering around content blocks with its own
// short-range lidar and leaving faint tyre tracks; the oldest one parks and fades once there are more than MAX_ROVERS.
// A small fixed hint in the bottom-right corner says so while the lidar is on. It steps aside (fades out) whenever
// text, an image or a divider line scrolls underneath it, and the vehicles steer around it. Above the fold nothing changes, so the
// terrain's click-to-drop-a-ball still works there.
// Mouse and trackpad only: touch screens and reduced motion keep the ordinary page. Styles are in the
// "Lidar cursor" block of styles.css.
(() => {
  const hero = document.querySelector('.hero');
  if (!hero || !window.matchMedia) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // ---- Tuning ----
  const RANGE = 150;          // cursor lidar range, px
  const SPIN = 1.25;          // cursor lidar revolutions per second
  const RAYS_PER_FRAME = 7;
  const DOT_LIFE = 1100;      // ms a cursor lidar dot stays visible
  const ROVER_DOT_LIFE = 1500;
  const MAX_ROVERS = 6;
  const TRACK_LIFE = 3800;    // ms a tyre track stays visible
  const ACTIVATE_AT = .5;     // the robot takes over once the introduction's bottom edge is above this share of the window

  const root = document.documentElement;
  const tok = (name, fallback) => getComputedStyle(root).getPropertyValue(name).trim() || fallback;
  const C = {
    ink: tok('--ink', '#ded5c6'), paper: tok('--paper', '#101010'), accent: tok('--accent', '#b59cc3'),
    warm: tok('--accent-warm', '#c18d97'), edge: tok('--burgundy-edge', '#8b4354'),
  };

  const canvas = document.createElement('canvas');
  canvas.className = 'lidar-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position:'fixed', top:'0', left:'0', width:'100%', height:'100%', pointerEvents:'none', zIndex:'40', display:'block' });
  document.body.appendChild(canvas);
  // The permanent hint, shown whenever the lidar is on (the terrain has its own hint on the introduction). It is
  // kept faint in a corner, and recedes further once a vehicle has been deployed.
  const hintEl = document.createElement('p');
  hintEl.className = 'lidar-hint';
  hintEl.setAttribute('aria-hidden', 'true');
  hintEl.innerHTML = 'click anywhere to deploy<br>an autonomous vehicle'; // two short lines, so it fits beside the page column
  document.body.appendChild(hintEl);
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

  // ---- What the lidar can see, in document coordinates ----
  // `lines`: one box per line of text plus images and icons, for the point cloud.
  // `blocks`: one box per element, for the rovers to drive around (they would get stuck between lines of text).
  const TEXT = 'main h2, main h3, main p, main .tags, main figcaption, main .section-heading span, main .project-number, main .all-projects-link, main .contact > a, .site-footer > span';
  const BOX = 'main img, main .project-thumb svg, .footer-socials a';
  let lines = [], blocks = [], rules = [], heroBottom = 0, docH = 0, docW = 0;
  const range = document.createRange();
  // Elements with a visible top or bottom border. Borders only change with the layout, so this list is rebuilt
  // on resize rather than read from every element's computed style each time the page is measured.
  let bordered = null;
  const findBordered = () => {
    bordered = [];
    for (const el of document.querySelectorAll('.site-header, .site-footer, main *')) {
      const cs = getComputedStyle(el);
      const top = parseFloat(cs.borderTopWidth) > 0, bottom = parseFloat(cs.borderBottomWidth) > 0;
      if (top || bottom) bordered.push({ el, top, bottom });
    }
  };
  const collect = () => {
    const sx = scrollX, sy = scrollY, L = [], B = [];
    const push = (arr, l, t, r, b) => { if (r - l > 1.5 && b - t > 1.5) arr.push({ l:l + sx, t:t + sy, r:r + sx, b:b + sy }); };
    for (const el of document.querySelectorAll(TEXT)) {
      if (el.closest('.hero')) continue;
      const box = el.getBoundingClientRect();
      push(B, box.left, box.top, box.right, box.bottom);
      range.selectNodeContents(el);
      let cur = null;
      for (const q of range.getClientRects()) {
        if (q.width < 2 || q.height < 2) continue;
        if (cur && Math.abs(cur[1] - q.top) < 5 && q.left - cur[2] < 14) {
          cur[0] = Math.min(cur[0], q.left); cur[2] = Math.max(cur[2], q.right); cur[3] = Math.max(cur[3], q.bottom);
        } else { if (cur) push(L, ...cur); cur = [q.left, q.top, q.right, q.bottom]; }
      }
      if (cur) push(L, ...cur);
    }
    for (const el of document.querySelectorAll(BOX)) {
      const q = el.getBoundingClientRect();
      push(L, q.left, q.top, q.right, q.bottom); push(B, q.left, q.top, q.right, q.bottom);
    }
    // Divider lines (any visible top or bottom border), so the hint can keep clear of them too.
    if (!bordered) findBordered();
    const R = [];
    for (const { el, top, bottom } of bordered) {
      const q = el.getBoundingClientRect();
      if (q.width < 2) continue;
      if (top) push(R, q.left, q.top - 1, q.right, q.top + 2);
      if (bottom) push(R, q.left, q.bottom - 2, q.right, q.bottom + 1);
    }
    lines = L; blocks = B; rules = R;
    hintBox = hintEl.getBoundingClientRect();
    heroBottom = hero.getBoundingClientRect().bottom + sy;
    docH = root.scrollHeight; docW = root.clientWidth;
  };

  // Distance along a ray to the nearest box, ignoring boxes the origin is inside. Slab test per box.
  const cast = (boxes, ox, oy, dx, dy, max) => {
    let best = max;
    for (let i = 0; i < boxes.length; i++) {
      const r = boxes[i];
      if (r.r < ox - best || r.l > ox + best || r.b < oy - best || r.t > oy + best) continue;
      if (ox > r.l && ox < r.r && oy > r.t && oy < r.b) continue;
      let t0 = 0, t1 = best;
      if (Math.abs(dx) < 1e-9) { if (ox < r.l || ox > r.r) continue; }
      else { let a = (r.l - ox) / dx, b = (r.r - ox) / dx; if (a > b) { const s = a; a = b; b = s; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
      if (Math.abs(dy) < 1e-9) { if (oy < r.t || oy > r.b) continue; }
      else { let a = (r.t - oy) / dy, b = (r.b - oy) / dy; if (a > b) { const s = a; a = b; b = s; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
      if (t0 <= t1 && t0 < best) best = t0;
    }
    return best;
  };

  // ---- Point cloud: a ring buffer of hits in document coordinates ----
  const N = 2400;
  const PX = new Float32Array(N), PY = new Float32Array(N), PT = new Float64Array(N), PK = new Uint8Array(N);
  PT.fill(-1e9);
  let head = 0, lastHit = -1e9;
  const addPoint = (x, y, kind, t) => {
    PX[head] = x + (Math.random() - .5) * 1.2; PY[head] = y + (Math.random() - .5) * 1.2;
    PT[head] = t; PK[head] = kind; head = (head + 1) % N; lastHit = t;
  };

  // ---- Pointer ----
  const m = { x:0, y:0, px:0, py:0, seen:false, inside:false };
  let active = false, mix = 0, sweep = 0, hoverEl = null, hoverMix = 0, hoverBox = null;
  // The hint shows while the lidar is on, unless something on the page is passing underneath it.
  let hintBox = null, hintClear = true;
  const overlaps = (boxes, sx, sy, pad) => {
    const l = hintBox.left - pad + sx, r = hintBox.right + pad + sx, t = hintBox.top - pad + sy, b = hintBox.bottom + pad + sy;
    for (let i = 0; i < boxes.length; i++) { const q = boxes[i]; if (q.l < r && q.r > l && q.t < b && q.b > t) return true; }
    return false;
  };
  const syncHint = () => {
    if (active && hintBox) hintClear = !overlaps(lines, scrollX, scrollY, 8) && !overlaps(rules, scrollX, scrollY, 8);
    hintEl.classList.toggle('on', active);
    hintEl.classList.toggle('blocked', !hintClear);
  };
  const check = () => {
    const next = hero.getBoundingClientRect().bottom < innerHeight * ACTIVATE_AT;
    if (next !== active) { active = next; syncHint(); wake(); }
  };

  addEventListener('pointermove', e => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    m.x = e.clientX; m.y = e.clientY;
    if (!m.seen) { m.px = m.x; m.py = m.y; }
    m.seen = m.inside = true; check(); wake();
  }, { passive:true });
  root.addEventListener('mouseleave', () => { m.inside = false; syncHint(); });
  addEventListener('blur', () => { m.inside = false; syncHint(); });
  document.addEventListener('pointerover', e => {
    hoverEl = e.target.closest ? e.target.closest('a, button, summary, label, [role="button"]') : null;
  });
  addEventListener('scroll', () => { check(); syncHint(); wake(); }, { passive:true });

  // ---- Rovers ----
  const rovers = [], rings = [];
  let obstacles = [];
  let now = performance.now();
  const spawn = (x, y) => {
    const alive = rovers.filter(r => !r.dying);
    if (alive.length >= MAX_ROVERS) alive[0].dying = now;
    rovers.push({ x, y, h:Math.random() * TAU, turn:0, v:30 + Math.random() * 16, born:now, dying:0,
      sweep:Math.random() * TAU, tracks:[], tx:x, ty:y });
    rings.push({ x, y, t:now });
    hintEl.classList.add('used');
    wake();
  };
  document.addEventListener('click', e => {
    if (!active || e.button !== 0) return;
    spawn(e.clientX + scrollX, e.clientY + scrollY);
  });

  const updateRover = (r, dt) => {
    const look = 44, spread = .55;
    const dl = cast(obstacles, r.x, r.y, Math.cos(r.h - spread), Math.sin(r.h - spread), look);
    const df = cast(obstacles, r.x, r.y, Math.cos(r.h), Math.sin(r.h), look);
    const dr = cast(obstacles, r.x, r.y, Math.cos(r.h + spread), Math.sin(r.h + spread), look);
    r.turn = (r.turn + (Math.random() - .5) * 7 * dt) * Math.pow(.35, dt);
    let steer = r.turn;
    const near = Math.min(df, dl * 1.3, dr * 1.3);
    if (near < look) steer += (dr > dl ? 1 : -1) * 5 * (1 - near / look);
    // Stay on the page below the introduction, and keep a little distance from the cursor robot.
    const minX = 12, maxX = docW - 12, minY = heroBottom + 16, maxY = docH - 12, edge = 34;
    let ix = 0, iy = 0;
    if (r.x < minX + edge) ix += 1; else if (r.x > maxX - edge) ix -= 1;
    if (r.y < minY + edge) iy += 1; else if (r.y > maxY - edge) iy -= 1;
    if (active && m.inside) {
      const dx = r.x - (m.x + scrollX), dy = r.y - (m.y + scrollY), d = Math.hypot(dx, dy);
      if (d > 0 && d < 64) { ix += dx / d * 1.4; iy += dy / d * 1.4; }
    }
    if (ix || iy) steer += angDiff(Math.atan2(iy, ix), r.h) * 3.2;
    r.h += clamp(steer, -6, 6) * dt;
    const grow = clamp((now - r.born) / 500, 0, 1);
    const speed = r.v * (df < 16 ? .4 : 1) * grow * (r.dying ? .3 : 1);
    r.x = clamp(r.x + Math.cos(r.h) * speed * dt, minX, maxX);
    r.y = Math.min(r.y + Math.sin(r.h) * speed * dt, maxY);
    // Tyre tracks every few pixels.
    if (Math.hypot(r.x - r.tx, r.y - r.ty) > 5) { r.tracks.push(r.x, r.y, r.h, now); r.tx = r.x; r.ty = r.y; }
    while (r.tracks.length && now - r.tracks[3] > TRACK_LIFE) r.tracks.splice(0, 4);
    // Its own little lidar, sweeping fast over the lines of text nearby.
    for (let k = 0; k < 2; k++) {
      r.sweep += 7.5 * dt;
      const a = r.sweep, d = cast(lines, r.x, r.y, Math.cos(a), Math.sin(a), 72);
      if (d < 72) addPoint(r.x + Math.cos(a) * d, r.y + Math.sin(a) * d, 1, now);
    }
  };

  // ---- Drawing ----
  const rrect = (x, y, w, h, rad) => {
    ctx.beginPath();
    ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
  };

  // Top-down autonomous vehicle pointing along +x: four wheels, a rose body, headlights and a lidar puck on the roof.
  const drawRover = (x, y, h, s, alpha) => {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(h); ctx.scale(s, s);
    ctx.globalAlpha = alpha * .6; ctx.fillStyle = C.ink;
    for (const [wx, wy] of [[-4, -4.6], [2, -4.6], [-4, 3.2], [2, 3.2]]) { rrect(wx, wy, 3, 1.4, .5); ctx.fill(); }
    ctx.globalAlpha = alpha;
    rrect(-5, -3.4, 10, 6.8, 2); ctx.fillStyle = C.edge; ctx.fill();
    ctx.lineWidth = .9; ctx.strokeStyle = C.warm; ctx.stroke();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(-.5, 0, 1.3, 0, TAU); ctx.fill();
    ctx.globalAlpha = alpha * .85; ctx.fillRect(4.1, -2.6, 1, 1.3); ctx.fillRect(4.1, 1.3, 1, 1.3);
    ctx.restore();
  };

  const brackets = (b, pad, len, alpha) => {
    const l = b.left - pad, t = b.top - pad, r = b.right + pad, btm = b.bottom + pad;
    ctx.globalAlpha = alpha; ctx.strokeStyle = C.accent; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(l, t + len); ctx.lineTo(l, t); ctx.lineTo(l + len, t);
    ctx.moveTo(r - len, t); ctx.lineTo(r, t); ctx.lineTo(r, t + len);
    ctx.moveTo(r, btm - len); ctx.lineTo(r, btm); ctx.lineTo(r - len, btm);
    ctx.moveTo(l + len, btm); ctx.lineTo(l, btm); ctx.lineTo(l, btm - len);
    ctx.stroke();
  };

  // ---- Frame loop: runs only while something is moving or fading ----
  let raf = 0, last = 0, lastCollect = 0;
  const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const frame = t => {
    raf = 0;
    const dt = Math.min(.05, (t - last) / 1000); last = t; now = t;
    if (active && t - lastCollect > 1500) { collect(); lastCollect = t; }
    const sx = scrollX, sy = scrollY;
    const on = active && m.inside;
    mix += ((on ? 1 : 0) - mix) * Math.min(1, dt * 9);

    // Cursor lidar: spin and record hits.
    const prev = sweep;
    sweep += TAU * SPIN * dt;
    if (on) {
      const ox = m.x + sx, oy = m.y + sy;
      for (let k = 1; k <= RAYS_PER_FRAME; k++) {
        if (Math.random() < .12) continue; // a few dropped returns, like a real scanner
        const a = prev + (sweep - prev) * k / RAYS_PER_FRAME;
        const d = cast(lines, ox, oy, Math.cos(a), Math.sin(a), RANGE);
        if (d < RANGE) addPoint(ox + Math.cos(a) * d, oy + Math.sin(a) * d, 0, t);
      }
    }

    // The vehicles treat the hint, where it currently sits on the page, as one more block to drive around.
    obstacles = active && hintClear && hintBox
      ? blocks.concat({ l:hintBox.left - 6 + sx, t:hintBox.top - 6 + sy, r:hintBox.right + 6 + sx, b:hintBox.bottom + 6 + sy })
      : blocks;
    for (const r of rovers) updateRover(r, dt);
    for (let i = rovers.length - 1; i >= 0; i--) if (rovers[i].dying && t - rovers[i].dying > 700) rovers.splice(i, 1);
    for (let i = rings.length - 1; i >= 0; i--) if (t - rings[i].t > 700) rings.splice(i, 1);

    // ---- Draw ----
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Tyre tracks.
    ctx.fillStyle = C.warm;
    for (const r of rovers) {
      const tr = r.tracks, fade = r.dying ? 1 - (t - r.dying) / 700 : 1;
      for (let i = 0; i < tr.length; i += 4) {
        const x = tr[i] - sx, y = tr[i + 1] - sy;
        if (y < -10 || y > H + 10) continue;
        ctx.globalAlpha = .2 * (1 - (t - tr[i + 3]) / TRACK_LIFE) * fade;
        const nx = -Math.sin(tr[i + 2]) * 3, ny = Math.cos(tr[i + 2]) * 3;
        ctx.fillRect(x + nx - .5, y + ny - .5, 1, 1); ctx.fillRect(x - nx - .5, y - ny - .5, 1, 1);
      }
    }

    // Point cloud.
    for (let i = 0; i < N; i++) {
      const age = t - PT[i], life = PK[i] ? ROVER_DOT_LIFE : DOT_LIFE;
      if (age > life) continue;
      const x = PX[i] - sx, y = PY[i] - sy;
      if (x < -4 || y < -4 || x > W + 4 || y > H + 4) continue;
      const f = 1 - age / life;
      ctx.fillStyle = PK[i] ? C.warm : C.accent;
      ctx.globalAlpha = f * f * (PK[i] ? .45 : .8);
      const s = age < 90 ? 2.2 : 1.4;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }

    // Spawn rings.
    ctx.lineWidth = 1; ctx.strokeStyle = C.warm;
    for (const g of rings) {
      const p = (t - g.t) / 700;
      ctx.globalAlpha = .5 * (1 - p);
      ctx.beginPath(); ctx.arc(g.x - sx, g.y - sy, 4 + p * 18, 0, TAU); ctx.stroke();
    }

    // Rovers.
    for (const r of rovers) {
      const x = r.x - sx, y = r.y - sy;
      if (y < -20 || y > H + 20) continue;
      const p = clamp((t - r.born) / 420, 0, 1);
      const pop = 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2); // ease-out with a small overshoot
      const fade = r.dying ? 1 - (t - r.dying) / 700 : 1;
      drawRover(x, y, r.h, 1.15 * pop, .92 * fade * Math.min(1, p * 3));
    }

    // Lock-on brackets around a hovered link.
    if (hoverEl && on) hoverBox = hoverEl.getBoundingClientRect();
    hoverMix += ((hoverEl && on ? 1 : 0) - hoverMix) * Math.min(1, dt * 14);
    if (hoverBox && hoverMix > .01) brackets(hoverBox, 5 + (1 - hoverMix) * 10, 6, .45 * hoverMix);

    // The current beam, fading out from the pointer.
    if (mix > .01) {
      const a = sweep, d = cast(lines, m.x + sx, m.y + sy, Math.cos(a), Math.sin(a), RANGE);
      const ex = m.x + Math.cos(a) * d, ey = m.y + Math.sin(a) * d;
      const g = ctx.createLinearGradient(m.x, m.y, ex, ey);
      g.addColorStop(0, C.accent); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = .16 * mix; ctx.strokeStyle = g; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(ex, ey); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const busy = on || mix > .01 || hoverMix > .01 || rovers.length || rings.length || t - lastHit < ROVER_DOT_LIFE;
    if (busy) raf = requestAnimationFrame(frame);
  };

  const resize = () => {
    DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; bordered = null;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    collect(); check(); wake();
  };
  addEventListener('resize', resize);
  addEventListener('load', () => { collect(); check(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(collect);
  resize();
})();

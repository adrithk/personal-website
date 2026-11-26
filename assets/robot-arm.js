// Homepage hero art: a robot arm on a table, picking up blocks one at a time and dropping them into a bin, on a
// loop. Drawn on the canvas inside .hero-art, in the site's thin-line style. Two-link inverse kinematics place
// the wrist, with the fingertips kept pointing straight down.
// Progressive enhancement: with reduced motion the arm is drawn still; without JavaScript the figure is empty
// (it is decorative). Styles are in the "Robot arm" block of styles.css.
(() => {
  const canvas = document.querySelector('.hero-art .arm-canvas');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C = { accent:'#b59cc3', warm:'#c18d97', burgundy:'#8b4354', plum:'#79608b', paper:'#101010' };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const joint = (x, y, r) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = C.paper; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = C.accent; ctx.stroke();
  };

  const arm = (() => {
    const BASE = [128, 196], L1 = 76, L2 = 64, L3 = 24;        // shoulder→elbow, elbow→wrist, wrist→fingertips
    const FLOOR = 206, HOVER = 112, SIZE = 13;
    const BIN = { x:52, w:44, h:30 };                          // centre and size of the open bin, on the floor
    const SPOTS = [168, 190, 212];                             // where the blocks wait on the table
    const SLOTS = [[BIN.x - 10, FLOOR - SIZE], [BIN.x + 9, FLOOR - SIZE], [BIN.x, FLOOR - 2 * SIZE]];
    const KINDS = ['cube', 'ball', 'cube'];
    const PER = 3.6;                                           // seconds per block
    let ang = [-2, 1.4, .6];

    // Two-link inverse kinematics for the wrist (elbow up), with the fingertips kept pointing straight down.
    const solve = (tx, ty) => {
      const wx = tx, wy = ty - L3;
      let dx = wx - BASE[0], dy = wy - BASE[1], d = Math.hypot(dx, dy);
      const max = L1 + L2 - .5;
      if (d > max) { dx *= max / d; dy *= max / d; d = max; }
      const cos2 = clamp((d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
      const a2 = -Math.acos(cos2);                            // negative = elbow up
      const a1 = Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin(a2), L1 + L2 * Math.cos(a2));
      return [a1, a2, Math.PI / 2 - a1 - a2];
    };
    const fk = a => {
      const pts = [BASE.slice()]; let s = 0;
      [L1, L2, L3].forEach((L, i) => { s += a[i]; const [x, y] = pts[i]; pts.push([x + L * Math.cos(s), y + L * Math.sin(s)]); });
      return pts;
    };
    const drawBlock = (ctx, kind, x, y, alpha = 1) => {
      ctx.save(); ctx.globalAlpha *= alpha; ctx.lineWidth = 1.2;
      if (kind === 'ball') {
        ctx.beginPath(); ctx.arc(x, y + SIZE / 2, SIZE / 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(193,141,151,.18)'; ctx.fill(); ctx.strokeStyle = C.warm; ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(181,156,195,.14)'; ctx.fillRect(x - SIZE / 2, y, SIZE, SIZE);
        ctx.strokeStyle = C.accent; ctx.strokeRect(x - SIZE / 2, y, SIZE, SIZE);
      }
      ctx.restore();
    };

    return {
      caption:'',
      draw(ctx, t) {
        t = Math.max(0, t);
        // Each round moves all three blocks; the bin then empties and the blocks reappear on the table.
        const round = SPOTS.length * PER + 1.4, rt = t % round;
        const item = Math.min(SPOTS.length - 1, Math.floor(rt / PER)), u = rt < SPOTS.length * PER ? (rt % PER) / PER : 1;
        const resetting = rt >= SPOTS.length * PER;
        const sx = SPOTS[item], grabY = FLOOR - SIZE / 2 + 1, dropY = FLOOR - BIN.h - 4;
        // waypoints for the fingertips: [x, y] at each phase boundary
        const home = [BIN.x, HOVER];
        const WP = [
          [0, home], [.18, [sx, HOVER]], [.32, [sx, grabY]], [.4, [sx, grabY]], [.54, [sx, HOVER]],
          [.74, [BIN.x, HOVER - 6]], [.84, [BIN.x, dropY]], [.9, [BIN.x, dropY]], [1, home],
        ];
        let target = home, phase = 'idle';
        if (!resetting) {
          for (let k = 1; k < WP.length; k++) {
            if (u <= WP[k][0]) {
              const [u0, p0] = WP[k - 1], [u1, p1] = WP[k], f = ease(clamp((u - u0) / (u1 - u0 || 1), 0, 1));
              target = [lerp(p0[0], p1[0], f), lerp(p0[1], p1[1], f)];
              phase = ['reach', 'descend', 'grasp', 'lift', 'carry', 'lower', 'release', 'return'][k - 1];
              break;
            }
          }
        }
        const goal = solve(target[0], target[1]);
        ang = ang.map((a, i) => a + wrap(goal[i] - a) * .35);
        if (!ang.every(Number.isFinite)) ang = goal.every(Number.isFinite) ? goal.slice() : [-2, 1.4, .6];
        const pts = fk(ang);
        const grip = phase === 'grasp' ? clamp((u - .32) / .08, 0, 1) : ['lift', 'carry', 'lower'].includes(phase) ? 1
          : phase === 'release' ? 1 - clamp((u - .84) / .06, 0, 1) : 0;
        const carrying = !resetting && u > .36 && u < .87;

        // table and bin
        ctx.strokeStyle = C.accent; ctx.globalAlpha = .55; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(18, FLOOR); ctx.lineTo(232, FLOOR); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.strokeStyle = C.plum; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(BIN.x - BIN.w / 2, FLOOR - BIN.h); ctx.lineTo(BIN.x - BIN.w / 2, FLOOR);
        ctx.lineTo(BIN.x + BIN.w / 2, FLOOR); ctx.lineTo(BIN.x + BIN.w / 2, FLOOR - BIN.h); ctx.stroke();
        // blocks already in the bin, and those still waiting on the table
        const placed = resetting ? SPOTS.length : item + (u > .87 ? 1 : 0);
        const fadeBin = resetting ? clamp(1 - (rt - SPOTS.length * PER) / .9, 0, 1) : 1;
        for (let k = 0; k < placed; k++) {
          // the block just released drops into its slot
          let [x, y] = SLOTS[k];
          if (!resetting && k === item) { const f = clamp((u - .87) / .06, 0, 1); y = lerp(dropY - SIZE + 2, y, f * f); }
          drawBlock(ctx, KINDS[k], x, y, fadeBin);
        }
        const respawn = resetting ? clamp((rt - SPOTS.length * PER - .6) / .8, 0, 1) : 1;
        for (let k = 0; k < SPOTS.length; k++) {
          const onTable = resetting ? true : k > item || (k === item && u < .36);
          if (onTable) drawBlock(ctx, KINDS[k], SPOTS[k], FLOOR - SIZE, resetting ? respawn : 1);
        }
        // base
        ctx.strokeStyle = C.accent; ctx.lineWidth = 1.2; ctx.globalAlpha = .85;
        ctx.strokeRect(BASE[0] - 12, BASE[1] + 1, 24, FLOOR - BASE[1] - 1); ctx.globalAlpha = 1;
        // links
        [C.burgundy, C.plum, C.warm].forEach((col, i) => {
          ctx.strokeStyle = col; ctx.lineWidth = i === 0 ? 2.6 : i === 1 ? 2.2 : 1.6;
          ctx.beginPath(); ctx.moveTo(...pts[i]); ctx.lineTo(...pts[i + 1]); ctx.stroke();
        });
        // fingers, closing around the block
        const [tx, ty] = pts[3], half = lerp(10, SIZE / 2 + 1, grip);
        ctx.strokeStyle = C.warm; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tx - half, ty - 3); ctx.lineTo(tx + half, ty - 3);
        ctx.moveTo(tx - half, ty - 3); ctx.lineTo(tx - half, ty + 6);
        ctx.moveTo(tx + half, ty - 3); ctx.lineTo(tx + half, ty + 6);
        ctx.stroke();
        if (carrying) drawBlock(ctx, KINDS[item], tx, ty - SIZE / 2 + 1);
        pts.slice(0, 3).forEach(([x, y], i) => joint(x, y, i ? 3.6 : 4.4));
      },
    };
  })();

  // The loop runs only while the arm is on screen. Its size is tracked with a ResizeObserver, so a frame never
  // has to ask the browser for layout. With reduced motion the arm is drawn once, settled into its first pose.
  let t = 0, last = 0, raf = 0, visible = false, size = 0;
  const draw = () => {
    const k = size / 250;
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, 250, 250); ctx.globalAlpha = 1;
    arm.draw(ctx, t);
  };
  const frame = now => {
    raf = 0;
    if (!visible || !size) return;
    const dt = last ? Math.min(.05, Math.max(0, (now - last) / 1000)) : 0;
    last = now; t += dt;
    draw();
    raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (!visible || !size) return;
    if (reduce) { for (let i = 0; i < 40; i++) draw(); return; }  // let the joints ease into place
    if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
  };
  const measure = () => {
    const next = Math.round(canvas.clientWidth * Math.min(devicePixelRatio || 1, 2));
    if (next !== size) { size = next; canvas.width = canvas.height = size; if (reduce) start(); }
  };
  new ResizeObserver(() => { measure(); start(); }).observe(canvas);
  addEventListener('resize', measure);   // a device-pixel-ratio change (browser zoom) without a size change
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
  }).observe(canvas);
})();

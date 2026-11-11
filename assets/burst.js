// Homepage opening: the first screen is dark with just the name. On the first scroll a cloud of violet
// and pink smoke bursts from behind the name, settles into a purple afterglow, and faint purple remnants
// drift behind the rest of the page.
// Progressive enhancement: without JavaScript, without WebGL, or with reduced motion requested, the
// homepage is simply the ordinary page with everything visible.
(() => {
  // ---- Tuning ----
  const REACH = 1.3;     // how far the blast travels, in half screen-diagonals
  const AFTERGLOW = .5;  // brightness of the glow that lingers behind the introduction
  const FLASH = .88;     // brightness of the burst itself (1 = full)
  const REMNANTS = .25;  // brightness of the purple clouds further down the page (0 = none)
  const REMNANTS_NARROW = .5; // multiplier for REMNANTS at phone widths, where the clouds span the whole page
  const DURATION = 2.4;  // seconds from first scroll to settled afterglow
  const HOLD_UNTIL = .9;  // the page cannot scroll past the introduction until the burst is this far along (0 = no hold)
  // The burst: indigo → violet → magenta → hot pink. No reds, oranges or creams.
  const FLASH_COLORS = ['#2b1470', '#6a24c8', '#c838c8', '#f8408a'];
  // What lingers: violet → purple → magenta. These hues stay vivid when dimmed.
  const GLOW_COLORS = ['#4a16d0', '#9426e0', '#e63fc0'];
  const PAPER = '#101010'; // must match --paper in styles.css

  const root = document.documentElement;
  const canvas = document.querySelector('.burst-canvas');
  const stage = document.querySelector('.burst-stage');
  const hero = stage?.querySelector('.hero');
  const title = hero?.querySelector('h1');
  if (!canvas || !hero || !title) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gl = reduceMotion.matches ? null
    : canvas.getContext('webgl', { antialias:false, alpha:false, powerPreference:'high-performance' });
  if (!gl) { canvas.remove(); return; }

  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const FRAG = `
precision highp float;
uniform vec2 u_origin, u_res;
uniform float u_scale, u_time, u_p, u_reach, u_glow, u_gain, u_fade, u_amb, u_scroll, u_end;
uniform vec3 u_c0, u_c1, u_c2, u_c3, u_g0, u_g1, u_g2, u_paper;

float hash(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.02+vec3(1.7,9.2,3.1); a*=.5; } return s; }
vec3 flash(float t){
  t=clamp(t,0.,1.)*3.;
  return t<1. ? mix(u_c0,u_c1,t) : t<2. ? mix(u_c1,u_c2,t-1.) : mix(u_c2,u_c3,t-2.);
}
vec3 glow(float t){
  t=clamp(t,0.,1.)*2.;
  return t<1. ? mix(u_g0,u_g1,t) : mix(u_g1,u_g2,t-1.);
}

void main(){
  vec3 col=vec3(0.);

  if(u_fade>.002){
    vec2 q=(gl_FragCoord.xy-u_origin)/u_scale;
    float r=length(q);
    vec2 d=q/max(r,1e-4);
    float p=u_p;
    float e=1.-pow(1.-p,2.5);                      // fast out, slow settle
    float settle=smoothstep(.4,1.,p);              // 0 = flash, 1 = afterglow
    float live=smoothstep(0.,.03,p);

    float ang=fbm(vec3(d*1.6,4.+u_time*.05));      // slow wobble around the circle
    float R=e*u_reach*(1.+.3*(ang-.5)*2.);         // the travelling front

    // The afterglow's cloud texture: warped noise drifting outward.
    vec3 fp=vec3(q*2.-d*e*1.5,u_time*.05);
    float warp=fbm(fp*1.3+7.);
    float n=fbm(fp+vec3(warp*1.2));
    // The flash uses its own cloud, which swells smoothly instead of streaming from the centre.
    float m=fbm(vec3(q*2.4/(1.+e*.7)+(warp-.5)*.5,u_time*.07+e*.8));
    float wisp=smoothstep(.28,.72,m);

    // The opening: a filled, billowing cloud of smoke with a soft lumpy edge.
    float edge=r+(fbm(vec3(q*2.2,u_time*.08+e))-.5)*.9*e;
    float fill=1.-smoothstep(R-.25,R,edge);
    float F=fill*(.14+1.15*wisp)*(1.-.4*smoothstep(.15,.6,p));   // how much flash
    float t=m*1.5-.36+.4*(1.-smoothstep(0.,.4,R-edge));          // palette position: 0 indigo → 1 hot pink
    vec3 hot=flash(t)*F*1.3*u_gain;              // intensity scales the flash only, never the afterglow

    // The afterglow: a smaller, soft-edged cloud. Dim edges lean violet and only
    // the bright core reaches magenta, so nothing turns muddy as it fades.
    float Ra=u_reach*.72*(1.+.3*(ang-.5)*1.4);
    float env=pow(1.-smoothstep(Ra*.12,Ra,r),1.4);
    float passed=1.-smoothstep(R-.35,R,r);
    vec3 calm=glow((n*1.7-.38)*mix(.3,1.,env))*(.8+1.1*n)*u_glow*env*passed;

    // The glow grows in behind the front while the flash is still fading, so there is never a dark gap.
    col=(hot*(1.-settle)+calm*smoothstep(.12,.6,p))*live;

    // A slightly darker pocket around the copy, and a faint violet ember behind the name before the burst.
    vec2 pq=q*vec2(.8,1.5);
    col*=1.-.3*exp(-dot(pq,pq)*4.)*smoothstep(.2,.8,p);
    col+=u_c1*exp(-r*r*16.)*(.2+.06*sin(u_time*1.6))*(1.-smoothstep(0.,.1,p));

    // Dimmer is fine; greyer is not.
    float l=dot(col,vec3(.3,.5,.2));
    col=max(mix(vec3(l),col,1.+.35*settle),0.);
    col*=u_fade;
  }

  if(u_amb>.002){
    // Remnants: soft purple clouds pinned to the page (with a little parallax). Each stretch of page has a
    // larger cloud on one side and a smaller, fainter companion at roughly the same height on the other,
    // swapping sides as you go — so both edges carry colour in every view without mirroring each other.
    vec2 uv=gl_FragCoord.xy/u_res; uv.y=1.-uv.y;
    float asp=u_res.x/u_res.y;
    float py=uv.y+u_scroll*.75;
    float period=1.15;
    float cell=floor(py/period);
    vec3 a=vec3(0.);
    for(int k=-1;k<=1;k++){
      float c=cell+float(k);
      float side=mod(c,2.);
      float h1=hash(vec3(c,1.,2.)), h2=hash(vec3(c,5.,3.)), h3=hash(vec3(c,8.,6.));
      // main cloud
      float cx=mix(.05,.95,side)+(h1-.5)*.14;
      float cy=(c+.5+(h2-.5)*.3)*period;
      vec2 dv=vec2((uv.x-cx)*asp,py-cy);
      float nn=fbm(vec3(dv*2.2+c*3.1,u_time*.04));
      a+=glow(nn*1.6-.32)*exp(-dot(dv,dv)/(.075+.17*nn))*(.3+1.2*nn)*.84*step(1.,cy);
      // companion on the opposite side: smaller and fainter, a little above or below the main cloud
      float bx=mix(.97,.03,side)+(h3-.5)*.1;
      float by=cy+(h1-.42)*.42*period;
      vec2 ev=vec2((uv.x-bx)*asp,py-by);
      float mm=fbm(vec3(ev*2.8+c*5.7+11.,u_time*.04));
      a+=glow(mm*1.3-.3)*exp(-dot(ev,ev)/(.045+.09*mm))*(.2+.75*mm)*(.6+.25*h2)*step(1.,by);
    }
    // Ease off a little towards the foot of the page so the last screen ends quietly.
    float toEnd=u_end+1.-uv.y;                     // viewport-heights above the page bottom
    col+=a*u_amb*mix(.86,1.,smoothstep(0.,1.1,toEnd));
  }

  col=col/(1.+col*.3);
  col+=u_paper+(hash(vec3(gl_FragCoord.xy,u_time))-.5)/160.; // grain hides banding
  gl_FragColor=vec4(col,1.);
}`;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  let uniform;
  try {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(program, 'a');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    const cache = {};
    uniform = name => cache[name] ??= gl.getUniformLocation(program, 'u_' + name);
  } catch (error) {
    // A failure should never leave the portfolio unreadable.
    console.warn('Opening burst disabled:', error);
    canvas.remove();
    return;
  }

  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  FLASH_COLORS.forEach((hex, i) => gl.uniform3fv(uniform('c' + i), rgb(hex)));
  GLOW_COLORS.forEach((hex, i) => gl.uniform3fv(uniform('g' + i), rgb(hex)));
  gl.uniform3fv(uniform('paper'), rgb(PAPER));
  gl.uniform1f(uniform('gain'), FLASH);
  gl.uniform1f(uniform('reach'), REACH);
  gl.uniform1f(uniform('glow'), AFTERGLOW);

  // ---- Sizing ----
  let width = 0, height = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = Math.round(canvas.clientWidth * dpr);
    height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  };

  // ---- Progress ----
  let p = 0;            // 0 = dark, 1 = settled afterglow
  let last = 0;
  let running = false;
  let stopped = false;
  let tick = 0;
  const nameRange = document.createRange();
  nameRange.selectNodeContents(title);

  // How far the pinned introduction holds before it scrolls away.
  const travel = () => Math.max(1, stage.offsetHeight - hero.offsetHeight);

  const frame = now => {
    if (stopped) return;
    const dt = Math.min(.05, (now - last) / 1000 || 0);
    last = now;
    // Fires once past the first few pixels of scroll; reverses quickly when back at the very top.
    const goal = window.scrollY > 6 ? 1 : 0;
    p = goal > p ? Math.min(goal, p + dt / DURATION) : Math.max(goal, p - dt / .8);
    if (holding && p >= HOLD_UNTIL) release();

    // As the introduction scrolls away the burst fades and the remnants take over.
    const past = Math.min(1, Math.max(0, (window.scrollY - travel()) / (window.innerHeight * .8)));
    const fade = 1 - past;
    const amb = past * REMNANTS * (window.innerWidth < 700 ? REMNANTS_NARROW : 1);

    hero.style.setProperty('--p', p.toFixed(4));
    // The sticky top bar has no backdrop while the introduction is still pinned beneath it.
    root.classList.toggle('header-clear', window.scrollY <= travel() + 40);

    const visible = fade > .002 || amb > .002;
    // With only the slow remnants on screen, drawing every other frame is plenty.
    const skip = fade <= .002 && p === goal && (tick++ & 1);
    if (visible && !skip) {
      resize();
      const box = nameRange.getBoundingClientRect();
      gl.uniform2f(uniform('origin'), (box.left + box.width / 2) * dpr, height - (box.top + box.height / 2) * dpr);
      gl.uniform2f(uniform('res'), width, height);
      gl.uniform1f(uniform('scale'), Math.hypot(width, height) / 2);
      gl.uniform1f(uniform('time'), now / 1000);
      gl.uniform1f(uniform('p'), p);
      gl.uniform1f(uniform('fade'), fade);
      gl.uniform1f(uniform('amb'), amb);
      gl.uniform1f(uniform('scroll'), window.scrollY / window.innerHeight);
      gl.uniform1f(uniform('end'), Math.max(0, root.scrollHeight - window.innerHeight - window.scrollY) / window.innerHeight);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    canvas.style.visibility = visible ? 'visible' : 'hidden';

    // Keep animating while colour is on screen; otherwise sleep until the next scroll.
    if (!document.hidden && (visible || p !== goal)) requestAnimationFrame(frame);
    else running = false;
  };
  const wake = () => {
    if (running || stopped) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  };

  // ---- Scroll hold ----
  // The first time the burst plays, a hard flick cannot carry the page past the introduction: scrolling
  // down is held at the pinned introduction until the colour has settled, then released. Links that jump
  // down the page, and arriving already scrolled, skip the hold.
  let holding = false;
  let held = HOLD_UNTIL <= 0;  // true once the hold has been used (or skipped) for this visit
  let lastY = window.scrollY;
  const release = () => { holding = false; held = true; };
  const DOWN_KEYS = new Set([' ', 'PageDown', 'End', 'ArrowDown']);
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (!held && !holding && y > 6) {
      // One jump from the top to beyond the introduction is a restored position or an in-page link.
      if (lastY <= 6 && y > travel() + 1) release();
      else holding = true;
    }
    if (holding && y <= 6) holding = false;  // back at the top: the burst rewinds, and the hold re-arms
    if (holding && y > travel()) window.scrollTo({ top:travel(), behavior:'instant' });
    lastY = y;
  }, { passive:true });
  window.addEventListener('wheel', event => {
    if (holding && event.deltaY > 0 && event.cancelable) event.preventDefault();
  }, { passive:false });
  window.addEventListener('touchmove', event => {
    if (holding && event.cancelable && window.scrollY >= travel() - 1) event.preventDefault();
  }, { passive:false });
  window.addEventListener('keydown', event => {
    if (!holding || !DOWN_KEYS.has(event.key) || (event.key === ' ' && event.shiftKey)) return;
    if (event.target.closest?.('a,button,input,textarea,select,video') && event.key === ' ') return;
    event.preventDefault();
  });
  document.addEventListener('click', event => {
    if (!held && event.target.closest?.('a[href*="#"]')) release();
  }, true);
  window.addEventListener('hashchange', release);

  // Reduced motion switched on mid-visit: back to the ordinary page.
  reduceMotion.addEventListener('change', event => {
    if (!event.matches || stopped) return;
    stopped = true;
    release();
    root.classList.remove('burst-on', 'header-clear');
    canvas.remove();
  });

  resize();
  root.classList.add('burst-on');
  window.addEventListener('scroll', wake, { passive:true });
  window.addEventListener('resize', wake);
  document.addEventListener('visibilitychange', wake);
  wake();
})();

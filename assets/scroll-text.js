// Homepage "Selected work": each project's text fills in word by word, tied to scroll position.
// Scrolling back up reverses it. Progressive enhancement: without JavaScript or with reduced motion
// the rows are simply visible. Styles are in the "Scroll-linked project text" block of styles.css.
(() => {
  const START = .92;  // a row begins to appear when its top reaches this fraction of the window height
  const END = .45;    // ...and is fully visible by this fraction
  const SPREAD = 7;   // how many words are mid-fade at once (higher = softer edge)
  const FLOOR = .08;  // opacity of words that have not appeared yet

  const root = document.documentElement;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Wrap every word of the title, description and tags in a span.
  const rows = [...document.querySelectorAll('.project-row')].map(row => {
    row.querySelectorAll('h3 a, h2 a, p, .tags').forEach(element => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node => {
        const fragment = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { fragment.append(part); return; }
          const span = document.createElement('span');
          span.className = 'sw';
          span.textContent = part;
          fragment.append(span);
        });
        node.replaceWith(fragment);
      });
    });
    return { row, words:[...row.querySelectorAll('.sw')], last:-1 };
  });

  const clamp = value => Math.min(1, Math.max(0, value));
  let queued = false;
  const update = () => {
    queued = false;
    const height = window.innerHeight;
    rows.forEach(item => {
      const top = item.row.getBoundingClientRect().top;
      const t = clamp((height * START - top) / (height * (START - END)));
      if (t === item.last) return;
      item.last = t;
      const lead = t * (item.words.length + SPREAD);
      item.words.forEach((word, i) => {
        word.style.setProperty('--o', (FLOOR + (1 - FLOOR) * clamp((lead - i) / SPREAD)).toFixed(3));
      });
      item.row.style.setProperty('--sp', clamp(t * 1.6).toFixed(3));
    });
  };
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', request, { passive:true });
  window.addEventListener('resize', request);

  root.classList.add('scrolltext-on');
  update();
})();

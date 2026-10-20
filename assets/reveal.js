// Progressive enhancement: the HTML is fully visible if this script cannot run.
(() => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || !('IntersectionObserver' in window)) return;

  const elements = document.querySelectorAll([
    '.hero .intro', '.hero .hero-note', '.hero .socials', '.hero-art',
    '.section-heading', '.project-row', '.projects-action', '.background-note', '.experience',
    '.personal h3', '.personal p', '.coffee-gallery', '.contact > *',
    '.project-header > *', '.project-body > *', '.project-next',
  ].join(','));

  let observer;
  let resetObserver;
  const showEverything = () => {
    observer?.disconnect();
    resetObserver?.disconnect();
    elements.forEach(element => element.classList.remove('reveal'));
  };

  try {
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.16) {
          entry.target.classList.add('is-visible');
        }
      });
    }, { threshold: [0, 0.16] });

    resetObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        // A buffer keeps the entrance's own movement from retriggering the reset.
        if (!entry.isIntersecting) entry.target.classList.remove('is-visible');
      });
    }, { rootMargin: '48px 0px 48px 0px', threshold: 0 });

    elements.forEach(element => {
      // Stagger the introduction slightly. Content farther down has no delay.
      if (element.matches('.hero .intro')) element.style.setProperty('--reveal-delay', '80ms');
      if (element.matches('.hero .hero-note')) element.style.setProperty('--reveal-delay', '160ms');
      if (element.matches('.hero .socials')) element.style.setProperty('--reveal-delay', '240ms');
      element.classList.add('reveal');
      observer.observe(element);
      resetObserver.observe(element);
    });

    motion.addEventListener('change', event => {
      if (event.matches) showEverything();
    });
    window.addEventListener('beforeprint', showEverything);
  } catch {
    // A failure should never leave the portfolio unreadable.
    showEverything();
  }
})();

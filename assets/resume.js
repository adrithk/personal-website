// Keep a normal homepage link when this page is opened directly or without JS.
const backLink = document.querySelector('[data-resume-back]');
if (backLink && document.referrer) {
  const previous = new URL(document.referrer);
  if (previous.origin === location.origin && previous.pathname !== location.pathname) {
    backLink.href = previous.href;
    backLink.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (history.length > 1) {
        event.preventDefault();
        history.back();
      }
    });
  }
}

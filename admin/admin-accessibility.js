/**
 * Shared accessibility enhancements for the admin portal.
 * - Turns empty anchor links (href="#") into keyboard-accessible buttons.
 * - Adds role="button", tabindex="0", and Enter/Space handling.
 */
(function () {
  'use strict';

  function enhanceLinks(root) {
    (root || document).querySelectorAll('a[href="#"]').forEach(el => {
      if (el.getAttribute('role')) return;
      el.setAttribute('role', 'button');
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      el.addEventListener('keydown', onKeyDown);
    });
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.currentTarget.click();
    }
  }

  function init() {
    enhanceLinks();
    const observer = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) enhanceLinks(node);
        });
      });
    });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

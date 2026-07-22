/*
  Admin sidebar UX cleanup:
  - Replace emoji icons with inline SVGs.
  - Turn empty fragment anchors (#) into semantic no-op links.
  Included by admin module pages and admin/dashboard.html.
*/
(function () {
  'use strict';

  const ICONS = {
    '📊': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>',
    '💰': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M14.5 9a2.5 2.5 0 0 0-2.5-2.5H9v5h3a2.5 2.5 0 0 0 2.5-2.5z"/><path d="M9 11.5V17h3.5a2.5 2.5 0 0 0 0-5H9z"/></svg>',
    '📁': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    '🧠': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v0A2.5 2.5 0 0 1 9.5 7h-1A2.5 2.5 0 0 1 6 4.5v0A2.5 2.5 0 0 1 8.5 2h1z"/><path d="M14.5 2A2.5 2.5 0 0 1 17 4.5v0A2.5 2.5 0 0 1 14.5 7h-1A2.5 2.5 0 0 1 11 4.5v0A2.5 2.5 0 0 1 13.5 2h1z"/><path d="M6 10a2.5 2.5 0 0 1 2.5-2.5h1A2.5 2.5 0 0 1 12 10v0a2.5 2.5 0 0 1-2.5 2.5h-1A2.5 2.5 0 0 1 6 10v0z"/><path d="M12 10a2.5 2.5 0 0 1 2.5-2.5h1A2.5 2.5 0 0 1 18 10v0a2.5 2.5 0 0 1-2.5 2.5h-1A2.5 2.5 0 0 1 12 10v0z"/><path d="M9 17a2.5 2.5 0 0 1 2.5-2.5h1A2.5 2.5 0 0 1 15 17v0a2.5 2.5 0 0 1-2.5 2.5h-1A2.5 2.5 0 0 1 9 17v0z"/></svg>',
    '🎯': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    '⚠️': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    '🏦': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M8 10h8"/><path d="M8 14h8"/><path d="M8 18h8"/></svg>',
    '🔄': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2 11.5a10 10 0 0 1 18.3-4.3L21.5 8"/><path d="M22 12.5a10 10 0 0 1-18.3 4.3L2.5 16"/></svg>',
    '📄': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    '🤖': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 11V7a4 4 0 0 1 4-4h0"/><path d="M8 15h.01"/><path d="M16 15h.01"/><path d="M12 15h.01"/></svg>',
    '⬅️': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>',
    '➕': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    '⭐': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    '✉️': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    '🔐': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1"/></svg>',
    '🛡️': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    '📋': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/></svg>',
    '⚙️': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    '📈': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
    '▶️': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    '↻': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M2 11.5a10 10 0 0 1 18.3-4.3L21.5 8"/><path d="M22 12.5a10 10 0 0 1-18.3 4.3L2.5 16"/></svg>'
  };

  const EMOJI_RE = new RegExp('^(' + Object.keys(ICONS).map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + '\\s*)');

  function replaceEmoji(node) {
    if (!node) return;
    const text = node.textContent || '';
    const match = text.match(EMOJI_RE);
    if (!match) return;
    const emoji = match[1].trim();
    const svg = ICONS[emoji];
    if (!svg) return;
    const wrapper = document.createElement('span');
    wrapper.innerHTML = svg;
    const svgEl = wrapper.firstElementChild;
    svgEl.setAttribute('aria-hidden', 'true');
    svgEl.style.pointerEvents = 'none';
    node.textContent = text.slice(match[0].length);
    node.parentNode.insertBefore(svgEl, node);
  }

  function fixNavAnchors() {
    const navLinks = document.querySelectorAll('.ai-nav a, .ex-nav a, .fa-nav a, .ii-nav a, .owner-perms-submenu .sidebar-link, .sidebar-link');
    navLinks.forEach(a => {
      if (a.getAttribute('href') === '#') {
        a.setAttribute('href', 'javascript:void(0)');
        a.setAttribute('role', 'button');
      }
      // Replace leading emoji in first text node
      const firstText = Array.from(a.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
      replaceEmoji(firstText);
      // Also replace emoji in any direct text node child (some have spans)
      Array.from(a.childNodes).forEach(n => {
        if (n.nodeType === Node.TEXT_NODE) replaceEmoji(n);
      });
    });

    // Back-link / footer links (may contain emoji + text)
    document.querySelectorAll('.ai-sidebar-footer a, .ex-sidebar-footer a, .fa-nav-sep a, .fa-user a, .sidebar-footer a').forEach(a => {
      const firstText = Array.from(a.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
      replaceEmoji(firstText);
    });

    // H1 headings with emoji
    document.querySelectorAll('.ii-sidebar h1, .ii-sidebar h2').forEach(h => {
      const firstText = Array.from(h.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
      replaceEmoji(firstText);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixNavAnchors);
  } else {
    fixNavAnchors();
  }
})();

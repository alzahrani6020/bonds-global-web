/**
 * Runtime emoji-to-SVG renderer.
 * Replaces any remaining emoji characters in visible DOM text nodes with inline SVG spans.
 * Requires components/emoji-icons.js to be loaded first (provides window.EmojiIcons).
 */
(function () {
  'use strict';

  const EMOJI_RE = /(?:[\u{1F1E6}-\u{1F1FF}]{2}|[#*0-9][\uFE0E\uFE0F]?\u20E3|(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})[\uFE0E\uFE0F]?[\u{1F3FB}-\u{1F3FF}]?(?:\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})[\uFE0E\uFE0F]?[\u{1F3FB}-\u{1F3FF}]?)*)/gu;

  const INLINE_SVG_STYLE = 'display:block;width:1em;height:1em;max-width:1em;max-height:1em;min-width:0;min-height:0;position:static;inset:auto;transform:none;flex:0 0 1em;';

  function findEmojiSequences(text) {
    EMOJI_RE.lastIndex = 0;
    return String(text || '').match(EMOJI_RE) || [];
  }

  function getInlineSvgStyle() {
    return INLINE_SVG_STYLE;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { findEmojiSequences, getInlineSvgStyle };
  }

  if (typeof window === 'undefined' || !window.EmojiIcons) return;

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TITLE', 'TEXTAREA', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED']);

  function replaceNode(node) {
    const text = node.textContent;
    if (!EMOJI_RE.test(text)) return false;
    EMOJI_RE.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    let changed = false;
    text.replace(EMOJI_RE, function (emoji, offset) {
      const svg = window.EmojiIcons.get(emoji);
      if (!svg) return;
      changed = true;
      if (offset > last) {
        frag.appendChild(document.createTextNode(text.slice(last, offset)));
      }
      const span = document.createElement('span');
      span.className = 'emoji-icon';
      span.setAttribute('aria-hidden', 'true');
      span.style.cssText = 'display:inline-flex;width:1em;height:1em;max-width:1em;max-height:1em;overflow:hidden;vertical-align:-0.15em;flex:0 0 1em;position:relative;';
      span.innerHTML = svg;
      const svgEl = span.querySelector('svg');
      if (svgEl) {
        svgEl.style.cssText = getInlineSvgStyle();
        svgEl.setAttribute('width', '1em');
        svgEl.setAttribute('height', '1em');
      }
      frag.appendChild(span);
      last = offset + emoji.length;
    });
    if (!changed) return false;
    if (last < text.length) {
      frag.appendChild(document.createTextNode(text.slice(last)));
    }
    node.parentNode.replaceChild(frag, node);
    return true;
  }

  function walk(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(replaceNode);
  }

  function shouldSkip(el) {
    return SKIP_TAGS.has(el.nodeName);
  }

  function processRoot(root) {
    if (root.nodeType === Node.ELEMENT_NODE && shouldSkip(root)) return;
    walk(root);
  }

  function init() {
    processRoot(document.body);

    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              processRoot(node);
            } else if (node.nodeType === Node.TEXT_NODE) {
              replaceNode(node);
            }
          });
        });
      });
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      } else {
        document.addEventListener('DOMContentLoaded', function () {
          observer.observe(document.body, { childList: true, subtree: true });
        });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

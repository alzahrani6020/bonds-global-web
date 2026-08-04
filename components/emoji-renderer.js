/**
 * Runtime emoji-to-SVG renderer.
 * Replaces any remaining emoji characters in visible DOM text nodes with inline SVG spans.
 * Requires components/emoji-icons.js to be loaded first (provides window.EmojiIcons).
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.EmojiIcons) return;

  const EMOJI_RE = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+/gu;

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
      span.style.cssText = 'display:inline-flex;width:1em;height:1em;vertical-align:-0.15em;';
      span.innerHTML = svg;
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

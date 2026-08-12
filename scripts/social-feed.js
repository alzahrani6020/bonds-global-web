/**
 * Bonds Social Feed Widget
 * Fetches latest posts from /api/social-feed and renders them into #social-feed-grid.
 */
(function () {
  'use strict';

  const ICONS = {
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  };

  const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function formatDate(iso, locale) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
    } catch (e) {
      return iso.slice(0, 10);
    }
  }

  function renderFallback(container, locale) {
    const isAr = locale.startsWith('ar');
    const env = window.__ENV || {};
    const urls = {
      instagram: env.SOCIAL_INSTAGRAM_URL || 'https://instagram.com/bonds.global',
      youtube: env.SOCIAL_YOUTUBE_URL || 'https://www.youtube.com/@bondsglobal',
      x: env.SOCIAL_X_URL || 'https://x.com/bonds_global',
    };
    container.innerHTML = `
      <div class="social-feed__empty">
        <p>${isAr ? 'تابع بوندز على منصات التواصل الاجتماعي' : 'Follow Bonds on social media'}</p>
        <div class="social-feed__links">
          <a class="social-feed__link" href="${urls.instagram}" target="_blank" rel="noopener" aria-label="Instagram">${ICONS.instagram} Instagram</a>
          <a class="social-feed__link" href="${urls.youtube}" target="_blank" rel="noopener" aria-label="YouTube">${ICONS.youtube} YouTube</a>
          <a class="social-feed__link" href="${urls.x}" target="_blank" rel="noopener" aria-label="X">${ICONS.x} X</a>
        </div>
      </div>
    `;
  }

  function renderMetrics(metrics, locale) {
    if (!metrics) return '';
    const isAr = locale.startsWith('ar');
    const parts = [];
    if (metrics.likes != null) parts.push(`${metrics.likes.toLocaleString(locale)} ${isAr ? 'إعجاب' : 'likes'}`);
    if (metrics.views != null) parts.push(`${metrics.views.toLocaleString(locale)} ${isAr ? 'مشاهدة' : 'views'}`);
    if (metrics.retweets != null) parts.push(`${metrics.retweets.toLocaleString(locale)} ${isAr ? 'إعادة تغريد' : 'retweets'}`);
    if (metrics.replies != null) parts.push(`${metrics.replies.toLocaleString(locale)} ${isAr ? 'رد' : 'replies'}`);
    if (metrics.comments != null) parts.push(`${metrics.comments.toLocaleString(locale)} ${isAr ? 'تعليق' : 'comments'}`);
    return parts.length ? `<div class="social-card__metrics">${parts.map(p => `<span>${escapeHtml(p)}</span>`).join('')}</div>` : '';
  }

  function renderCard(post, locale) {
    const platformLabel = post.platform === 'x' ? 'X' : post.platform.charAt(0).toUpperCase() + post.platform.slice(1);
    const media = post.mediaUrl
      ? `<div class="social-card__media"><img src="${escapeHtml(post.mediaUrl)}" alt="" loading="lazy" />${post.type === 'video' ? `<div class="social-card__play">${PLAY_ICON}</div>` : ''}</div>`
      : '';
    return `
      <a class="social-card" href="${escapeHtml(post.permalink)}" target="_blank" rel="noopener" aria-label="${escapeHtml(platformLabel)}: ${escapeHtml(post.title)}">
        ${media}
        <div class="social-card__body">
          <div class="social-card__meta">
            <span class="social-card__platform">${ICONS[post.platform] || ''} ${escapeHtml(platformLabel)}</span>
            <span class="social-card__date">${escapeHtml(formatDate(post.publishedAt, locale))}</span>
          </div>
          <div class="social-card__title">${escapeHtml(post.title)}</div>
          <div class="social-card__excerpt">${escapeHtml(post.excerpt)}</div>
          ${renderMetrics(post.metrics, locale)}
        </div>
      </a>
    `;
  }

  async function init() {
    const section = document.getElementById('social-feed');
    if (!section) return;
    const grid = section.querySelector('.social-feed__grid');
    if (!grid) return;

    const html = document.documentElement;
    const locale = html.lang || 'ar';
    const isAr = locale.startsWith('ar');

    grid.innerHTML = `<div class="social-feed__loading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>`;

    try {
      const res = await fetch('/api/social-feed?limit=6&platforms=all', {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error('Feed request failed');
      const json = await res.json();
      const posts = Array.isArray(json.posts) ? json.posts : [];
      if (posts.length === 0) {
        renderFallback(grid, locale);
        return;
      }
      grid.innerHTML = posts.map(p => renderCard(p, locale)).join('');
    } catch (err) {
      console.warn('[SocialFeed] failed to load:', err.message);
      renderFallback(grid, locale);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

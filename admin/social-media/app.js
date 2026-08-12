/**
 * Social Media Admin App
 */
(function () {
  'use strict';

  const ICONS = {
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  };

  const LABELS = {
    instagram: 'Instagram',
    youtube: 'YouTube',
    x: 'X',
  };

  function escapeHtml(str) {
    return BondsAdminCommon.escapeHtml(str);
  }

  function setContent(html) {
    const el = document.getElementById('sm-content');
    if (el) el.innerHTML = html;
  }

  function showLoading() {
    setContent('<div class="sm-empty"><div class="sm-spinner"></div><p>جارِ التحميل...</p></div>');
  }

  function showError(msg) {
    setContent('<div class="sm-empty sm-empty--error">❌ ' + escapeHtml(msg) + '</div>');
  }

  function formatLocalDateTime(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch (e) {
      return iso;
    }
  }

  async function loadAccountsView() {
    showLoading();
    try {
      const data = await SocialMediaService.getAccounts();
      const accounts = data.accounts || [];
      const rows = accounts.map(a => `
        <tr>
          <td><span class="sm-platform">${ICONS[a.platform] || ''} ${escapeHtml(LABELS[a.platform] || a.platform)}</span></td>
          <td>${a.readConfigured ? '✅' : '⏳'}</td>
          <td>${a.publishConfigured ? '✅' : '⏳'}</td>
          <td><button class="sm-btn sm-btn--secondary" data-test="${escapeHtml(a.platform)}">اختبار الاتصال</button></td>
        </tr>
      `).join('');
      setContent(`
        <div class="sm-panel">
          <h2 class="sm-panel__title">حالة حسابات التواصل الاجتماعي</h2>
          <p class="sm-panel__subtitle">المفاتيح تُقرأ من متغيرات البيئة في Vercel. اضغط "اختبار الاتصال" للتحقق من صلاحية التوكن.</p>
          <table class="sm-table">
            <thead><tr><th>المنصة</th><th>قراءة</th><th>نشر</th><th>إجراء</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div id="sm-test-result" class="sm-status" style="display:none"></div>
        </div>
      `);
      document.querySelectorAll('[data-test]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const platform = btn.getAttribute('data-test');
          btn.disabled = true;
          btn.textContent = 'جارِ الاختبار...';
          try {
            const res = await SocialMediaService.testPlatform(platform);
            const ok = res.success && res.result?.ok;
            BondsAdminCommon.showAdminStatus('sm-test-result', ok ? 'الاتصال ناجح' : ('فشل: ' + (res.result?.error || 'خطأ غير معروف')), !ok);
          } catch (e) {
            BondsAdminCommon.showAdminStatus('sm-test-result', 'فشل الاختبار: ' + e.message, true);
          } finally {
            btn.disabled = false;
            btn.textContent = 'اختبار الاتصال';
          }
        });
      });
    } catch (e) {
      showError(e.message);
    }
  }

  async function loadFeedView() {
    showLoading();
    try {
      const data = await SocialMediaService.getFeed(6);
      const posts = data.posts || [];
      if (posts.length === 0) {
        setContent('<div class="sm-empty">لا توجد منشورات متاحة حالياً. تأكد من تفعيل SOCIAL_FEED_ENABLED وإضافة التوكنات.</div>');
        return;
      }
      const cards = posts.map(p => `
        <a class="sm-card" href="${escapeHtml(p.permalink)}" target="_blank" rel="noopener">
          ${p.mediaUrl ? `<div class="sm-card__media"><img src="${escapeHtml(p.mediaUrl)}" alt="" loading="lazy"/></div>` : ''}
          <div class="sm-card__body">
            <div class="sm-card__meta">
              <span class="sm-card__platform">${ICONS[p.platform] || ''} ${escapeHtml(LABELS[p.platform] || p.platform)}</span>
              <span class="sm-card__date">${escapeHtml(p.publishedAt ? p.publishedAt.slice(0, 10) : '')}</span>
            </div>
            <div class="sm-card__title">${escapeHtml(p.title)}</div>
            <div class="sm-card__excerpt">${escapeHtml(p.excerpt)}</div>
          </div>
        </a>
      `).join('');
      setContent(`
        <div class="sm-panel">
          <h2 class="sm-panel__title">معاينة الـ Feed</h2>
          <div class="sm-grid">${cards}</div>
        </div>
      `);
    } catch (e) {
      showError(e.message);
    }
  }

  async function loadScheduledView() {
    showLoading();
    try {
      const data = await SocialMediaService.getScheduledPosts();
      const posts = data.posts || [];
      if (posts.length === 0) {
        setContent('<div class="sm-empty">لا توجد منشورات مجدولة.</div>');
        return;
      }
      const rows = posts.map(p => `
        <tr>
          <td>${escapeHtml((p.platforms || []).map(pl => LABELS[pl] || pl).join(', '))}</td>
          <td>${escapeHtml(p.content.slice(0, 80))}${p.content.length > 80 ? '…' : ''}</td>
          <td>${escapeHtml(formatLocalDateTime(p.scheduled_at))}</td>
          <td><span class="sm-badge sm-badge--${p.status}">${escapeHtml(p.status)}</span></td>
          <td>
            ${p.status === 'pending' ? `<button class="sm-btn sm-btn--secondary" data-cancel="${escapeHtml(p.id)}">إلغاء</button>` : ''}
          </td>
        </tr>
      `).join('');
      setContent(`
        <div class="sm-panel">
          <h2 class="sm-panel__title">المنشورات المجدولة</h2>
          <table class="sm-table">
            <thead><tr><th>المنصات</th><th>المحتوى</th><th>الموعد</th><th>الحالة</th><th>إجراء</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div id="sm-schedule-result" class="sm-status" style="display:none"></div>
        </div>
      `);
      document.querySelectorAll('[data-cancel]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-cancel');
          btn.disabled = true;
          try {
            await SocialMediaService.cancelScheduledPost(id);
            BondsAdminCommon.showAdminStatus('sm-schedule-result', 'تم إلغاء المنشور', false);
            loadScheduledView();
          } catch (e) {
            BondsAdminCommon.showAdminStatus('sm-schedule-result', 'فشل الإلغاء: ' + e.message, true);
            btn.disabled = false;
          }
        });
      });
    } catch (e) {
      showError(e.message);
    }
  }

  function loadComposeView() {
    const minDate = new Date();
    minDate.setMinutes(minDate.getMinutes() - minDate.getTimezoneOffset() + 1);
    const minIso = minDate.toISOString().slice(0, 16);

    setContent(`
      <div class="sm-panel">
        <h2 class="sm-panel__title">إنشاء منشور</h2>
        <p class="sm-panel__subtitle">اكتب المنشور، ارفق ميديا (اختياري)، واختر النشر الفوري أو الجدولة.</p>
        <form id="sm-compose-form" class="sm-form">
          <div class="sm-field">
            <label>المنصات</label>
            <div class="sm-checks">
              <label class="sm-check"><input type="checkbox" name="platforms" value="instagram"> ${ICONS.instagram} Instagram</label>
              <label class="sm-check"><input type="checkbox" name="platforms" value="x"> ${ICONS.x} X</label>
              <label class="sm-check"><input type="checkbox" name="platforms" value="youtube"> ${ICONS.youtube} YouTube</label>
            </div>
          </div>
          <div class="sm-field">
            <label for="sm-text">النص</label>
            <textarea id="sm-text" name="text" rows="4" maxlength="2000" required></textarea>
          </div>
          <div class="sm-field">
            <label for="sm-media-file">ملف الصورة/الفيديو (اختياري)</label>
            <input type="file" id="sm-media-file" name="mediaFile" accept="image/*,video/mp4,video/quicktime" />
            <input type="hidden" id="sm-media-url" name="mediaUrl" />
            <div id="sm-upload-status" style="margin-top:0.4rem;font-size:0.8rem;color:var(--text-secondary);"></div>
          </div>
          <div class="sm-field">
            <label for="sm-media-type">نوع الميديا</label>
            <select id="sm-media-type" name="mediaType">
              <option value="image">صورة</option>
              <option value="video">فيديو</option>
            </select>
          </div>
          <div class="sm-field">
            <label for="sm-scheduled-at">الجدولة (اتركها فارغة للنشر الفوري)</label>
            <input type="datetime-local" id="sm-scheduled-at" name="scheduledAt" min="${minIso}" />
          </div>
          <div class="sm-actions">
            <button type="submit" class="sm-btn sm-btn--primary" data-action="publish">نشر الآن</button>
            <button type="submit" class="sm-btn sm-btn--secondary" data-action="schedule">جدولة</button>
          </div>
        </form>
        <div id="sm-publish-result" class="sm-status" style="display:none"></div>
      </div>
    `);

    const form = document.getElementById('sm-compose-form');
    const fileInput = document.getElementById('sm-media-file');
    const mediaUrlInput = document.getElementById('sm-media-url');
    const uploadStatus = document.getElementById('sm-upload-status');

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      uploadStatus.textContent = 'جارِ رفع الملف...';
      try {
        const res = await SocialMediaService.uploadMedia(file);
        mediaUrlInput.value = res.url;
        uploadStatus.innerHTML = '✅ تم الرفع: <a href="' + escapeHtml(res.url) + '" target="_blank" rel="noopener">عرض</a>';
        document.getElementById('sm-media-type').value = file.type.startsWith('video/') ? 'video' : 'image';
      } catch (e) {
        uploadStatus.textContent = '❌ فشل الرفع: ' + e.message;
        mediaUrlInput.value = '';
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitter = e.submitter || document.activeElement;
      const action = submitter?.dataset?.action || 'publish';

      const platforms = Array.from(form.querySelectorAll('input[name="platforms"]:checked')).map(i => i.value);
      if (platforms.length === 0) {
        BondsAdminCommon.showAdminStatus('sm-publish-result', 'اختر منصة واحدة على الأقل', true);
        return;
      }
      const text = form.querySelector('[name="text"]').value.trim();
      if (!text) {
        BondsAdminCommon.showAdminStatus('sm-publish-result', 'النص مطلوب', true);
        return;
      }
      const mediaUrl = form.querySelector('[name="mediaUrl"]').value.trim() || undefined;
      const mediaType = form.querySelector('[name="mediaType"]').value;
      const scheduledAt = form.querySelector('[name="scheduledAt"]').value || undefined;

      if (action === 'schedule') {
        if (!scheduledAt) {
          BondsAdminCommon.showAdminStatus('sm-publish-result', 'اختر موعد الجدولة', true);
          return;
        }
        try {
          await SocialMediaService.schedulePost({ platforms, content: text, mediaUrl, mediaType, scheduledAt });
          BondsAdminCommon.showAdminStatus('sm-publish-result', 'تمت الجدولة بنجاح', false);
          form.reset();
          uploadStatus.textContent = '';
        } catch (err) {
          BondsAdminCommon.showAdminStatus('sm-publish-result', 'فشل الجدولة: ' + err.message, true);
        }
        return;
      }

      const btn = submitter;
      btn.disabled = true;
      btn.textContent = 'جارِ النشر...';
      try {
        const res = await SocialMediaService.publish(platforms, { text, mediaUrl, mediaType });
        const failed = res.results.filter(r => !r.success).map(r => `${LABELS[r.platform] || r.platform}: ${r.error}`).join(' / ');
        const ok = res.results.filter(r => r.success).length;
        if (failed) {
          BondsAdminCommon.showAdminStatus('sm-publish-result', `تم النشر على ${ok} / ${res.results.length} — أخطاء: ${failed}`, true);
        } else {
          BondsAdminCommon.showAdminStatus('sm-publish-result', 'تم النشر على جميع المنصات بنجاح', false);
          form.reset();
          uploadStatus.textContent = '';
        }
      } catch (err) {
        BondsAdminCommon.showAdminStatus('sm-publish-result', 'فشل النشر: ' + err.message, true);
      } finally {
        btn.disabled = false;
        btn.textContent = 'نشر الآن';
      }
    });
  }

  function setActiveTab(view) {
    document.querySelectorAll('.sm-nav a').forEach(a => {
      a.classList.toggle('active', a.dataset.view === view);
    });
  }

  function initTabs() {
    document.querySelectorAll('.sm-nav a').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const view = a.dataset.view;
        setActiveTab(view);
        if (view === 'accounts') loadAccountsView();
        if (view === 'feed') loadFeedView();
        if (view === 'compose') loadComposeView();
        if (view === 'scheduled') loadScheduledView();
      });
    });
  }

  async function init() {
    initTabs();
    loadAccountsView();
  }

  root.SocialMediaApp = { init };
})(window);

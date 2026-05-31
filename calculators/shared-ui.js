/**
 * Bonds Shared UI Kit
 * Provides: Validation, Auto-save, Progress Tracking, Onboarding, Notifications
 * Usage: Include after shared-utils.js in any calculator
 */

(function() {
  'use strict';

  // ===== 1. TOAST NOTIFICATIONS =====
  window.BondsUI = window.BondsUI || {};

  function ensureToastContainer() {
    let container = document.getElementById('bonds-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'bonds-toast-container';
      container.style.cssText = 'position:fixed;top:1rem;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none;';
      document.body.appendChild(container);
    }
    return container;
  }

  BondsUI.toast = function(message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    const colors = {
      success: 'background:#22c55e;color:#fff;',
      error:   'background:#ef4444;color:#fff;',
      warning: 'background:#f59e0b;color:#0a0f1a;',
      info:    'background:var(--gold);color:#0a0f1a;'
    };
    toast.style.cssText = colors[type] + 'padding:0.75rem 1.25rem;border-radius:8px;font-weight:700;font-size:0.9rem;pointer-events:auto;box-shadow:0 4px 12px rgba(0,0,0,0.3);opacity:0;transform:translateY(-10px);transition:all 0.3s;min-width:280px;text-align:center;';
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
    setTimeout(() => {
      toast.style.opacity = '0'; toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  // ===== 2. VALIDATION ENGINE =====
  BondsUI.validate = function(value, rules) {
    rules = rules || {};
    const errors = [];
    const v = (typeof value === 'string') ? value.trim() : value;

    if (rules.required && (v === '' || v === null || v === undefined)) {
      errors.push(rules.label ? `${rules.label}: الحقل مطلوب` : 'الحقل مطلوب');
    }
    if (rules.minLength && String(v).length < rules.minLength) {
      errors.push(`${rules.label || ''} يجب أن يكون ${rules.minLength} أحرف على الأقل`);
    }
    if (rules.maxLength && String(v).length > rules.maxLength) {
      errors.push(`${rules.label || ''} يجب أن لا يتجاوز ${rules.maxLength} حرف`);
    }
    if (rules.min !== undefined && Number(v) < rules.min) {
      errors.push(`${rules.label || ''} يجب أن يكون ${rules.min} على الأقل`);
    }
    if (rules.max !== undefined && Number(v) > rules.max) {
      errors.push(`${rules.label || ''} يجب أن لا يتجاوز ${rules.max}`);
    }
    if (rules.type === 'number' && v !== '' && isNaN(Number(v))) {
      errors.push(`${rules.label || ''} يجب أن يكون رقماً صالحاً`);
    }
    if (rules.type === 'email' && v !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      errors.push(`${rules.label || ''} يجب أن يكون بريداً إلكترونياً صالحاً`);
    }
    if (rules.pattern && v !== '' && !rules.pattern.test(v)) {
      errors.push(rules.patternMessage || `${rules.label || ''} قيمة غير صالحة`);
    }
    if (rules.custom && typeof rules.custom === 'function') {
      const customError = rules.custom(v);
      if (customError) errors.push(customError);
    }
    return { valid: errors.length === 0, errors };
  };

  BondsUI.validateField = function(inputId, rules) {
    const el = document.getElementById(inputId);
    if (!el) return { valid: false, errors: ['العنصر غير موجود'] };
    const result = BondsUI.validate(el.value, rules);
    // Visual feedback
    if (!result.valid) {
      el.style.borderColor = '#ef4444';
      el.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.15)';
    } else {
      el.style.borderColor = 'var(--border)';
      el.style.boxShadow = 'none';
    }
    return result;
  };

  BondsUI.clearValidation = function(inputId) {
    const el = document.getElementById(inputId);
    if (el) { el.style.borderColor = 'var(--border)'; el.style.boxShadow = 'none'; }
  };

  // ===== 3. AUTO-SAVE SYSTEM =====
  BondsUI.AutoSave = function(config) {
    this.key = config.key || 'bonds_autosave_' + location.pathname;
    this.interval = config.interval || 5000;
    this.getData = config.getData;
    this.onRestore = config.onRestore;
    this.timer = null;
    this.enabled = true;
  };

  BondsUI.AutoSave.prototype.start = function() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.save(), this.interval);
    // Save on page hide
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
    window.addEventListener('beforeunload', () => this.save());
  };

  BondsUI.AutoSave.prototype.save = function() {
    if (!this.enabled || !this.getData) return;
    try {
      const data = this.getData();
      localStorage.setItem(this.key, JSON.stringify({ t: Date.now(), d: data }));
    } catch(e) { /* quota exceeded */ }
  };

  BondsUI.AutoSave.prototype.restore = function() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (this.onRestore) this.onRestore(parsed.d);
      return true;
    } catch(e) { return false; }
  };

  BondsUI.AutoSave.prototype.clear = function() {
    localStorage.removeItem(this.key);
  };

  // ===== 4. PROGRESS TRACKER =====
  BondsUI.ProgressTracker = function(containerId, steps) {
    this.container = document.getElementById(containerId);
    this.steps = steps || [];
    this.current = 0;
    this.render();
  };

  BondsUI.ProgressTracker.prototype.render = function() {
    if (!this.container) return;
    const pct = Math.round((this.current / this.steps.length) * 100);
    let html = `<div class="bonds-progress-wrap" style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1.5rem;">`;
    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">`;
    html += `<span style="font-weight:700;color:var(--gold);font-size:0.9rem;">📊 اكتمال الإعداد: ${pct}%</span>`;
    html += `<span style="font-size:0.8rem;color:var(--muted);">${this.current}/${this.steps.length} خطوة</span>`;
    html += `</div>`;
    html += `<div style="background:rgba(255,255,255,0.05);border-radius:999px;height:8px;overflow:hidden;">`;
    html += `<div style="background:linear-gradient(90deg,var(--gold),#f0c96a);height:100%;width:${pct}%;border-radius:999px;transition:width 0.5s;"></div>`;
    html += `</div>`;
    html += `<div style="display:flex;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap;">`;
    this.steps.forEach((s, i) => {
      const done = i < this.current;
      const current = i === this.current;
      const color = done ? '#22c55e' : current ? 'var(--gold)' : 'var(--muted)';
      const bg = done ? 'rgba(34,197,94,0.1)' : current ? 'rgba(212,168,83,0.1)' : 'transparent';
      html += `<span style="font-size:0.75rem;padding:0.25rem 0.6rem;border-radius:6px;background:${bg};color:${color};border:1px solid ${color};font-weight:600;white-space:nowrap;">${done ? '✓ ' : current ? '▶ ' : '○ '}${s}</span>`;
    });
    html += `</div></div>`;
    this.container.innerHTML = html;
  };

  BondsUI.ProgressTracker.prototype.advance = function() {
    if (this.current < this.steps.length) {
      this.current++;
      this.render();
    }
  };

  BondsUI.ProgressTracker.prototype.set = function(n) {
    this.current = Math.max(0, Math.min(n, this.steps.length));
    this.render();
  };

  // ===== 5. ONBOARDING WIZARD =====
  BondsUI.Onboarding = function(steps) {
    this.steps = steps;
    this.current = 0;
    this.overlay = null;
  };

  BondsUI.Onboarding.prototype.start = function() {
    if (!this.steps || !this.steps.length) return;
    // Check if user already seen it
    const key = 'bonds_onboard_' + location.pathname;
    if (localStorage.getItem(key)) return;
    this.showStep(0);
  };

  BondsUI.Onboarding.prototype.showStep = function(idx) {
    this.current = idx;
    const step = this.steps[idx];
    if (!step) { this.finish(); return; }

    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';
      document.body.appendChild(this.overlay);
    }

    const isLast = idx === this.steps.length - 1;
    const nextLabel = isLast ? 'ابدأ الآن 🚀' : 'التالي →';

    this.overlay.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:2rem;max-width:420px;width:90%;text-align:center;animation:fadeIn 0.3s;">
        <div style="font-size:2.5rem;margin-bottom:1rem;">${step.icon || '💡'}</div>
        <h3 style="color:var(--gold);font-size:1.25rem;margin-bottom:0.5rem;font-weight:800;">${step.title}</h3>
        <p style="color:var(--text-secondary);font-size:0.95rem;line-height:1.6;margin-bottom:1.5rem;">${step.desc}</p>
        <div style="display:flex;gap:0.5rem;justify-content:center;margin-bottom:1rem;">
          ${this.steps.map((_, i) => `<div style="width:8px;height:8px;border-radius:50%;background:${i === idx ? 'var(--gold)' : 'rgba(255,255,255,0.2)'};transition:background 0.3s;"></div>`).join('')}
        </div>
        <div style="display:flex;gap:0.75rem;justify-content:center;">
          ${idx > 0 ? `<button onclick="window.__bondsOnboard.prev()" style="background:transparent;color:var(--text);border:1px solid var(--border);padding:0.6rem 1.2rem;border-radius:8px;font-weight:700;cursor:pointer;">← السابق</button>` : ''}
          <button onclick="window.__bondsOnboard.next()" style="background:var(--gold);color:#0a0f1a;border:none;padding:0.6rem 1.5rem;border-radius:8px;font-weight:800;cursor:pointer;font-size:1rem;">${nextLabel}</button>
        </div>
      </div>
    `;
    window.__bondsOnboard = this;
  };

  BondsUI.Onboarding.prototype.next = function() { this.showStep(this.current + 1); };
  BondsUI.Onboarding.prototype.prev = function() { this.showStep(this.current - 1); };
  BondsUI.Onboarding.prototype.finish = function() {
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
    localStorage.setItem('bonds_onboard_' + location.pathname, '1');
    BondsUI.toast('🎉 جاهز! ابدأ بإدخال بياناتك', 'success');
  };

  // ===== 6. DEMO DATA LOADER =====
  BondsUI.loadDemoData = function(config) {
    if (!confirm(config.confirmMsg || 'هل تريد تحميل بيانات تجريبية لترى كيف يعمل؟')) return false;
    if (config.data && typeof config.apply === 'function') {
      config.apply(config.data);
      BondsUI.toast(config.successMsg || '✅ تم تحميل البيانات التجريبية', 'success');
      return true;
    }
    return false;
  };

  // ===== 7. HELPER: EMPTY STATE =====
  BondsUI.emptyState = function(containerId, opts) {
    const container = document.getElementById(containerId);
    if (!container) return;
    opts = opts || {};
    container.innerHTML = `
      <div style="text-align:center;padding:2rem;color:var(--text-muted);">
        <div style="font-size:3rem;margin-bottom:1rem;opacity:0.5;">${opts.icon || '📭'}</div>
        <p style="font-size:1rem;font-weight:600;margin-bottom:0.5rem;">${opts.title || 'لا توجد بيانات بعد'}</p>
        <p style="font-size:0.85rem;margin-bottom:1rem;">${opts.desc || 'ابدأ بإضافة البيانات لترى النتائج هنا'}</p>
        ${opts.action ? `<button onclick="${opts.action}" style="background:var(--gold);color:#0a0f1a;border:none;padding:0.5rem 1rem;border-radius:8px;font-weight:700;cursor:pointer;">${opts.actionLabel || 'ابدأ الآن'}</button>` : ''}
      </div>
    `;
  };

  // ===== 8. SMART INPUT HINTS =====
  BondsUI.addHint = function(inputId, hint) {
    const el = document.getElementById(inputId);
    if (!el || el.dataset.hintAdded) return;
    const hintEl = document.createElement('div');
    hintEl.className = 'bonds-input-hint';
    hintEl.textContent = hint;
    hintEl.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-top:0.25rem;';
    el.parentNode.appendChild(hintEl);
    el.dataset.hintAdded = '1';
  };

  console.log('✅ BondsUI loaded: toast, validate, auto-save, progress, onboarding, demo-data');
})();

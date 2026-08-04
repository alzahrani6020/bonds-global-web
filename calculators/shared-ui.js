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
      warning: 'background:#f59e0b;color:#1a1a1a;',
      info:    'background:var(--gold);color:#1a1a1a;'
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
    html += `<span style="font-weight:700;color:var(--gold);font-size:0.9rem;"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#CCD6DD" d="M31 2H5C3.343 2 2 3.343 2 5v26c0 1.657 1.343 3 3 3h26c1.657 0 3-1.343 3-3V5c0-1.657-1.343-3-3-3z"/><path fill="#E1E8ED" d="M31 1H5C2.791 1 1 2.791 1 5v26c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V5c0-2.209-1.791-4-4-4zm0 2c1.103 0 2 .897 2 2v4h-6V3h4zm-4 16h6v6h-6v-6zm0-2v-6h6v6h-6zM25 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM17 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM3 5c0-1.103.897-2 2-2h4v6H3V5zm0 6h6v6H3v-6zm0 8h6v6H3v-6zm2 14c-1.103 0-2-.897-2-2v-4h6v6H5zm6 0v-6h6v6h-6zm8 0v-6h6v6h-6zm12 0h-4v-6h6v4c0 1.103-.897 2-2 2z"/><path fill="#5C913B" d="M13 33H7V16c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v17z"/><path fill="#3B94D9" d="M29 33h-6V9c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v24z"/><path fill="#DD2E44" d="M21 33h-6V23c0-1.104.896-2 2-2h2c1.104 0 2 .896 2 2v10z"/></svg> اكتمال الإعداد: ${pct}%</span>`;
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
      html += `<span style="font-size:0.75rem;padding:0.25rem 0.6rem;border-radius:6px;background:${bg};color:${color};border:1px solid ${color};font-weight:600;white-space:nowrap;">${done ? "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" aria-hidden=\"true\"><path d=\"M4 12l6 6 10-14\"/></svg> " : current ? "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M8 5v14l11-7z\"/></svg> " : "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/></svg> "}${s}</span>`;
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
    const nextLabel = isLast ? "ابدأ الآن <svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#A0041E\" d=\"M1 17l8-7 16 1 1 16-7 8s.001-5.999-6-12-12-6-12-6z\"/><path fill=\"#FFAC33\" d=\"M.973 35s-.036-7.979 2.985-11S15 21.187 15 21.187 14.999 29 11.999 32c-3 3-11.026 3-11.026 3z\"/><circle fill=\"#FFCC4D\" cx=\"8.999\" cy=\"27\" r=\"4\"/><path fill=\"#55ACEE\" d=\"M35.999 0s-10 0-22 10c-6 5-6 14-4 16s11 2 16-4c10-12 10-22 10-22z\"/><path d=\"M26.999 5c-1.623 0-3.013.971-3.641 2.36.502-.227 1.055-.36 1.641-.36 2.209 0 4 1.791 4 4 0 .586-.133 1.139-.359 1.64 1.389-.627 2.359-2.017 2.359-3.64 0-2.209-1.791-4-4-4z\"/><path fill=\"#A0041E\" d=\"M8 28s0-4 1-5 13.001-10.999 14-10-9.001 13-10.001 14S8 28 8 28z\"/></svg>" : 'التالي →';

    this.overlay.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:2rem;max-width:420px;width:90%;text-align:center;animation:fadeIn 0.3s;">
        <div style="font-size:2.5rem;margin-bottom:1rem;">${step.icon || "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#FFD983\" d=\"M29 11.06c0 6.439-5 7.439-5 13.44 0 3.098-3.123 3.359-5.5 3.359-2.053 0-6.586-.779-6.586-3.361C11.914 18.5 7 17.5 7 11.06 7 5.029 12.285.14 18.083.14 23.883.14 29 5.029 29 11.06z\"/><path fill=\"#CCD6DD\" d=\"M22.167 32.5c0 .828-2.234 2.5-4.167 2.5-1.933 0-4.167-1.672-4.167-2.5 0-.828 2.233-.5 4.167-.5 1.933 0 4.167-.328 4.167.5z\"/><path fill=\"#FFCC4D\" d=\"M22.707 10.293c-.391-.391-1.023-.391-1.414 0L18 13.586l-3.293-3.293c-.391-.391-1.023-.391-1.414 0s-.391 1.023 0 1.414L17 15.414V26c0 .553.448 1 1 1s1-.447 1-1V15.414l3.707-3.707c.391-.391.391-1.023 0-1.414z\"/><path fill=\"#99AAB5\" d=\"M24 31c0 1.104-.896 2-2 2h-8c-1.104 0-2-.896-2-2v-6h12v6z\"/><path fill=\"#CCD6DD\" d=\"M11.999 32c-.48 0-.904-.347-.985-.836-.091-.544.277-1.06.822-1.15l12-2c.544-.098 1.06.277 1.15.822.091.544-.277 1.06-.822 1.15l-12 2c-.055.01-.111.014-.165.014zm0-4c-.48 0-.904-.347-.985-.836-.091-.544.277-1.06.822-1.15l12-2c.544-.097 1.06.277 1.15.822.091.544-.277 1.06-.822 1.15l-12 2c-.055.01-.111.014-.165.014z\"/></svg>"}</div>
        <h3 style="color:var(--gold);font-size:1.25rem;margin-bottom:0.5rem;font-weight:800;">${step.title}</h3>
        <p style="color:var(--text-secondary);font-size:0.95rem;line-height:1.6;margin-bottom:1.5rem;">${step.desc}</p>
        <div style="display:flex;gap:0.5rem;justify-content:center;margin-bottom:1rem;">
          ${this.steps.map((_, i) => `<div style="width:8px;height:8px;border-radius:50%;background:${i === idx ? 'var(--gold)' : 'rgba(255,255,255,0.2)'};transition:background 0.3s;"></div>`).join('')}
        </div>
        <div style="display:flex;gap:0.75rem;justify-content:center;">
          ${idx > 0 ? `<button onclick="window.__bondsOnboard.prev()" style="background:transparent;color:var(--text);border:1px solid var(--border);padding:0.6rem 1.2rem;border-radius:8px;font-weight:700;cursor:pointer;">← السابق</button>` : ''}
          <button onclick="window.__bondsOnboard.next()" style="background:var(--gold);color:#1a1a1a;border:none;padding:0.6rem 1.5rem;border-radius:8px;font-weight:800;cursor:pointer;font-size:1rem;">${nextLabel}</button>
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
    BondsUI.toast("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#DD2E44\" d=\"M11.626 7.488c-.112.112-.197.247-.268.395l-.008-.008L.134 33.141l.011.011c-.208.403.14 1.223.853 1.937.713.713 1.533 1.061 1.936.853l.01.01L28.21 24.735l-.008-.009c.147-.07.282-.155.395-.269 1.562-1.562-.971-6.627-5.656-11.313-4.687-4.686-9.752-7.218-11.315-5.656z\"/><path fill=\"#EA596E\" d=\"M13 12L.416 32.506l-.282.635.011.011c-.208.403.14 1.223.853 1.937.232.232.473.408.709.557L17 17l-4-5z\"/><path fill=\"#A0041E\" d=\"M23.012 13.066c4.67 4.672 7.263 9.652 5.789 11.124-1.473 1.474-6.453-1.118-11.126-5.788-4.671-4.672-7.263-9.654-5.79-11.127 1.474-1.473 6.454 1.119 11.127 5.791z\"/><path fill=\"#AA8DD8\" d=\"M18.59 13.609c-.199.161-.459.245-.734.215-.868-.094-1.598-.396-2.109-.873-.541-.505-.808-1.183-.735-1.862.128-1.192 1.324-2.286 3.363-2.066.793.085 1.147-.17 1.159-.292.014-.121-.277-.446-1.07-.532-.868-.094-1.598-.396-2.11-.873-.541-.505-.809-1.183-.735-1.862.13-1.192 1.325-2.286 3.362-2.065.578.062.883-.057 1.012-.134.103-.063.144-.123.148-.158.012-.121-.275-.446-1.07-.532-.549-.06-.947-.552-.886-1.102.059-.549.55-.946 1.101-.886 2.037.219 2.973 1.542 2.844 2.735-.13 1.194-1.325 2.286-3.364 2.067-.578-.063-.88.057-1.01.134-.103.062-.145.123-.149.157-.013.122.276.446 1.071.532 2.037.22 2.973 1.542 2.844 2.735-.129 1.192-1.324 2.286-3.362 2.065-.578-.062-.882.058-1.012.134-.104.064-.144.124-.148.158-.013.121.276.446 1.07.532.548.06.947.553.886 1.102-.028.274-.167.511-.366.671z\"/><path fill=\"#77B255\" d=\"M30.661 22.857c1.973-.557 3.334.323 3.658 1.478.324 1.154-.378 2.615-2.35 3.17-.77.216-1.001.584-.97.701.034.118.425.312 1.193.095 1.972-.555 3.333.325 3.657 1.479.326 1.155-.378 2.614-2.351 3.17-.769.216-1.001.585-.967.702.033.117.423.311 1.192.095.53-.149 1.084.16 1.233.691.148.532-.161 1.084-.693 1.234-1.971.555-3.333-.323-3.659-1.479-.324-1.154.379-2.613 2.353-3.169.77-.217 1.001-.584.967-.702-.032-.117-.422-.312-1.19-.096-1.974.556-3.334-.322-3.659-1.479-.325-1.154.378-2.613 2.351-3.17.768-.215.999-.585.967-.701-.034-.118-.423-.312-1.192-.096-.532.15-1.083-.16-1.233-.691-.149-.53.161-1.082.693-1.232z\"/><path fill=\"#AA8DD8\" d=\"M23.001 20.16c-.294 0-.584-.129-.782-.375-.345-.432-.274-1.061.156-1.406.218-.175 5.418-4.259 12.767-3.208.547.078.927.584.849 1.131-.078.546-.58.93-1.132.848-6.493-.922-11.187 2.754-11.233 2.791-.186.148-.406.219-.625.219z\"/><path fill=\"#77B255\" d=\"M5.754 16c-.095 0-.192-.014-.288-.042-.529-.159-.829-.716-.67-1.245 1.133-3.773 2.16-9.794.898-11.364-.141-.178-.354-.353-.842-.316-.938.072-.849 2.051-.848 2.071.042.551-.372 1.031-.922 1.072-.559.034-1.031-.372-1.072-.923-.103-1.379.326-4.035 2.692-4.214 1.056-.08 1.933.287 2.552 1.057 2.371 2.951-.036 11.506-.542 13.192-.13.433-.528.712-.958.712z\"/><circle fill=\"#5C913B\" cx=\"25.5\" cy=\"9.5\" r=\"1.5\"/><circle fill=\"#9266CC\" cx=\"2\" cy=\"18\" r=\"2\"/><circle fill=\"#5C913B\" cx=\"32.5\" cy=\"19.5\" r=\"1.5\"/><circle fill=\"#5C913B\" cx=\"23.5\" cy=\"31.5\" r=\"1.5\"/><circle fill=\"#FFCC4D\" cx=\"28\" cy=\"4\" r=\"2\"/><circle fill=\"#FFCC4D\" cx=\"32.5\" cy=\"8.5\" r=\"1.5\"/><circle fill=\"#FFCC4D\" cx=\"29.5\" cy=\"12.5\" r=\"1.5\"/><circle fill=\"#FFCC4D\" cx=\"7.5\" cy=\"23.5\" r=\"1.5\"/></svg> جاهز! ابدأ بإدخال بياناتك", 'success');
  };

  // ===== 6. DEMO DATA LOADER =====
  BondsUI.loadDemoData = function(config) {
    if (!confirm(config.confirmMsg || 'هل تريد تحميل بيانات تجريبية لترى كيف يعمل؟')) return false;
    if (config.data && typeof config.apply === 'function') {
      config.apply(config.data);
      BondsUI.toast(config.successMsg || "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg> تم تحميل البيانات التجريبية", 'success');
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
        <div style="font-size:3rem;margin-bottom:1rem;opacity:0.5;">${opts.icon || "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#C1694F\" d=\"M22 33c0 2.209-8 2.209-8 0V23c0-2.209 1.791-4 4-4s4 1.791 4 4v10z\"/><path fill=\"#99AAB5\" d=\"M26 3H10v20h24V11c0-4.418-3.582-8-8-8z\"/><path fill=\"#292F33\" d=\"M10 3c-4.418 0-8 3.582-8 8v12h16V11c0-4.418-3.582-8-8-8z\"/><path fill=\"#DD2E44\" d=\"M34 13H22c-1.104 0-2 .896-2 2s.896 2 2 2h8v2c0 1.104.896 2 2 2h2c1.104 0 2-.896 2-2v-4c0-1.104-.896-2-2-2z\"/></svg>"}</div>
        <p style="font-size:1rem;font-weight:600;margin-bottom:0.5rem;">${opts.title || 'لا توجد بيانات بعد'}</p>
        <p style="font-size:0.85rem;margin-bottom:1rem;">${opts.desc || 'ابدأ بإضافة البيانات لترى النتائج هنا'}</p>
        ${opts.action ? `<button onclick="${opts.action}" style="background:var(--gold);color:#1a1a1a;border:none;padding:0.5rem 1rem;border-radius:8px;font-weight:700;cursor:pointer;">${opts.actionLabel || 'ابدأ الآن'}</button>` : ''}
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

  // BondsUI loaded
})();

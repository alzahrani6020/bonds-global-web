/* ===== Funding Request Form Handler — Multi-step Assessment ===== */
(function () {
  'use strict';

  const MAX_FILES = 3;
  const MAX_FILE_BYTES = 2 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
  const ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/jpg'
  ];

  const WHATSAPP_FALLBACK = '966567566616';
  const STORAGE_PREFIX = 'bonds_funding_assessment_';

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function getLang(form) {
    return form.dataset.lang || document.documentElement.lang || 'ar';
  }

  function getMessage(form, key, fallback) {
    return form.dataset[key] || fallback;
  }

  function trackFundingEvent(eventName, data) {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, data || {});
      }
      if (typeof window.dataLayer !== 'undefined' && Array.isArray(window.dataLayer)) {
        window.dataLayer.push({ event: eventName, ...(data || {}) });
      }
    } catch (e) {}
  }

  /* ---------- Prefill from funding tools ---------- */
  const PREFILL_WHITELIST = ['source', 'amount', 'country', 'financingType', 'sector', 'purposeCategory', 'purpose', 'readinessScore', 'selectedSource', 'note'];

  function getFieldByName(form, name) {
    return form.querySelector('[name="' + name.replace(/"/g, '\\"') + '"]');
  }

  function isFieldEmpty(field) {
    if (!field) return true;
    const value = String(field.value || '').trim();
    if (!value) return true;
    if (field.tagName === 'SELECT') {
      const firstOption = field.options[0];
      if (firstOption && value === firstOption.value) return true;
    }
    return false;
  }

  function optionExists(select, value) {
    if (!select || !value) return false;
    for (let i = 0; i < select.options.length; i++) {
      if (String(select.options[i].value).trim() === String(value).trim()) return true;
    }
    return false;
  }

  function setFieldIfEmpty(form, name, value) {
    const field = getFieldByName(form, name);
    if (!field || !isFieldEmpty(field)) return false;
    if (field.tagName === 'SELECT') {
      if (!optionExists(field, value)) return false;
    }
    field.value = String(value);
    return true;
  }

  function generatePrefillLetter(context, lang) {
    const isEn = lang === 'en';
    const parts = [];
    if (context.selectedSource) {
      parts.push(isEn ? 'I found the following funding source: ' + context.selectedSource + '.' : 'وجدت مصدر التمويل التالي: ' + context.selectedSource + '.');
    }
    if (context.readinessScore) {
      parts.push(isEn ? 'My funding readiness score is ' + context.readinessScore + '.' : 'درجة جاهزية التمويل الخاصة بي هي ' + context.readinessScore + '.');
    }
    if (context.sector) {
      parts.push(isEn ? 'Sector: ' + context.sector + '.' : 'القطاع: ' + context.sector + '.');
    }
    if (context.note) {
      parts.push(context.note);
    }
    if (!parts.length) return '';
    return parts.join('\n') + (isEn ? '\n\nI would like to discuss the next steps.' : '\n\nأرغب بمناقشة الخطوات التالية.');
  }

  function renderPrefillBanner(form, context, lang) {
    const isEn = lang === 'en';
    let banner = form.querySelector('.funding-request__prefill');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'funding-request__prefill';
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-live', 'polite');
      form.insertBefore(banner, form.firstChild);
    }

    let label = isEn ? 'Some details were filled in from ' : 'تم ملء بعض البيانات من ';
    if (context.source === 'readiness') label += isEn ? 'the Funding Readiness Quiz.' : 'اختبار جاهزية التمويل.';
    else if (context.source === 'sources') label += isEn ? 'the Funding Sources Directory.' : 'دليل مصادر التمويل.';
    else if (context.source === 'loan') label += isEn ? 'the Loan Calculator.' : 'حاسبة القرض.';
    else if (context.source === 'roi') label += isEn ? 'the ROI Calculator.' : 'حاسبة عائد الاستثمار.';
    else label += isEn ? 'a funding tool.' : 'أداة تمويل.';

    banner.innerHTML =
      '<span class="funding-request__prefill-text">' + label + '</span>' +
      '<button type="button" class="funding-request__prefill-clear" data-fr-prefill-clear>' +
      (isEn ? 'Clear' : 'مسح') +
      '</button>';

    banner.querySelector('[data-fr-prefill-clear]').addEventListener('click', function () {
      clearPrefillBanner(form);
      if (window.BondsFundingContext) window.BondsFundingContext.clear();
    });
  }

  function clearPrefillBanner(form) {
    const banner = form.querySelector('.funding-request__prefill');
    if (banner) banner.remove();
  }

  function getPrefillData() {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = {};
      PREFILL_WHITELIST.forEach(function (key) {
        if (params.has(key)) fromUrl[key] = params.get(key);
      });

      let fromStorage = null;
      if (window.BondsFundingContext) {
        fromStorage = window.BondsFundingContext.get();
      }

      const merged = Object.assign({}, fromStorage || {}, fromUrl);
      return Object.keys(merged).length ? merged : null;
    } catch (e) {
      return null;
    }
  }

  function applyPrefill(form, lang) {
    const context = getPrefillData();
    if (!context) return;

    const isEn = lang === 'en';

    setFieldIfEmpty(form, 'amount', context.amount);
    setFieldIfEmpty(form, 'country', context.country);
    setFieldIfEmpty(form, 'financingType', context.financingType);
    setFieldIfEmpty(form, 'purposeCategory', context.purposeCategory);
    if (context.purpose) setFieldIfEmpty(form, 'purpose', context.purpose);

    const letter = getFieldByName(form, 'letter');
    if (letter && isFieldEmpty(letter)) {
      const generated = generatePrefillLetter(context, lang);
      if (generated) letter.value = generated;
    }

    renderPrefillBanner(form, context, lang);
    saveFormState(form);
    trackFundingEvent('funding_form_prefilled', { source: context.source || 'unknown', lang });
  }

  function getWhatsAppNumber() {
    try {
      return (window.__ENV && window.__ENV.WHATSAPP_NUMBER) || WHATSAPP_FALLBACK;
    } catch (e) {
      return WHATSAPP_FALLBACK;
    }
  }

  function getWhatsAppLink(lang) {
    const number = getWhatsAppNumber();
    const text = lang === 'en'
      ? 'Hello, I would like to inquire about BONDS funding advisory services.'
      : 'السلام عليكم، أرغب في الاستفسار عن خدمة استخراج التمويل لدى BONDS.';
    return 'https://wa.me/' + number.replace(/\D/g, '') + '?text=' + encodeURIComponent(text);
  }

  function getStorageKey(form) {
    return STORAGE_PREFIX + getLang(form);
  }

  function clearFieldError(field) {
    const wrapper = field.closest('.funding-request__field');
    if (!wrapper) return;
    wrapper.classList.remove('funding-request__field--error');
    const err = wrapper.querySelector('.fr-error');
    if (err) err.remove();
  }

  function showFieldError(field, message) {
    const wrapper = field.closest('.funding-request__field');
    if (!wrapper) return;
    wrapper.classList.add('funding-request__field--error');
    let err = wrapper.querySelector('.fr-error');
    if (!err) {
      err = document.createElement('span');
      err.className = 'fr-error';
      err.setAttribute('aria-live', 'polite');
      wrapper.appendChild(err);
    }
    err.textContent = message;
  }

  function validateField(field, lang) {
    clearFieldError(field);

    if (!field.required && !field.value.trim()) return true;

    if (field.required && !field.value.trim()) {
      showFieldError(field, lang === 'en' ? 'This field is required' : 'هذا الحقل مطلوب');
      return false;
    }

    if (field.type === 'email' && field.value.trim()) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(field.value.trim())) {
        showFieldError(field, lang === 'en' ? 'Please enter a valid email' : 'يرجى إدخال بريد إلكتروني صحيح');
        return false;
      }
    }

    if (field.type === 'tel' && field.value.trim()) {
      const normalized = field.value.trim().replace(/[\s\-()]/g, '');
      const phoneRe = /^(05\d{8}|\+\d{7,25})$/;
      if (!phoneRe.test(normalized)) {
        showFieldError(field, lang === 'en' ? 'Please enter a valid phone number' : 'يرجى إدخال رقم جوال صحيح');
        return false;
      }
    }

    if (field.type === 'number' && field.value.trim()) {
      const num = Number(String(field.value).replace(/,/g, ''));
      if (!Number.isFinite(num) || num <= 0 || num > 1e12) {
        showFieldError(field, lang === 'en' ? 'Please enter a valid amount' : 'يرجى إدخال مبلغ صحيح');
        return false;
      }
    }

    return true;
  }

  function validateStep(stepEl, lang) {
    let isValid = true;
    let firstInvalid = null;
    const fields = stepEl.querySelectorAll('input, select, textarea');

    fields.forEach((field) => {
      if (field.classList.contains('funding-request__hp')) return;
      if (field.type === 'file') return;
      if (!validateField(field, lang)) {
        isValid = false;
        if (!firstInvalid) firstInvalid = field;
      }
    });

    if (firstInvalid) {
      firstInvalid.focus({ preventScroll: true });
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return isValid;
  }

  function saveFormState(form) {
    try {
      const data = {};
      form.querySelectorAll('input, select, textarea').forEach((field) => {
        if (field.type === 'file' || field.type === 'submit' || field.classList.contains('funding-request__hp')) return;
        if (field.name) data[field.name] = field.value;
      });
      sessionStorage.setItem(getStorageKey(form), JSON.stringify(data));
    } catch (e) {}
  }

  function restoreFormState(form) {
    try {
      const raw = sessionStorage.getItem(getStorageKey(form));
      if (!raw) return;
      const data = JSON.parse(raw);
      Object.keys(data).forEach((name) => {
        const field = form.querySelector('[name="' + name.replace(/"/g, '\\"') + '"]');
        if (field && field.type !== 'file') {
          field.value = data[name];
        }
      });
    } catch (e) {}
  }

  function clearFormState(form) {
    try {
      sessionStorage.removeItem(getStorageKey(form));
    } catch (e) {}
  }

  function initFileUpload(form, isEn) {
    const fileInput = form.querySelector('[data-fr-file]');
    const fileList = form.querySelector('[data-fr-file-list]');
    const fileAreaText = form.querySelector('[data-fr-file-text]');
    let selectedFiles = [];

    if (!fileInput) return { getFiles: () => selectedFiles };

    function updateFileList() {
      if (!fileList) return;
      fileList.innerHTML = '';
      selectedFiles.forEach((file, index) => {
        const chip = document.createElement('span');
        chip.className = 'funding-request__file-chip';
        chip.textContent = file.name + ' (' + formatBytes(file.size) + ')';

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'funding-request__file-remove';
        remove.setAttribute('aria-label', (isEn ? 'Remove ' : 'إزالة ') + file.name);
        remove.textContent = '×';
        remove.addEventListener('click', () => {
          selectedFiles.splice(index, 1);
          updateFileList();
        });

        chip.appendChild(remove);
        fileList.appendChild(chip);
      });

      if (fileAreaText) {
        fileAreaText.textContent = selectedFiles.length
          ? (isEn ? 'Click or drag to add more files' : 'انقر أو اسحب لإضافة ملفات أخرى')
          : (isEn ? 'Click or drag files here' : 'انقر أو اسحب الملفات هنا');
      }
    }

    fileInput.addEventListener('change', () => {
      const incoming = Array.from(fileInput.files || []);
      fileInput.value = '';

      let totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
      const errors = [];

      incoming.forEach((file) => {
        if (selectedFiles.length >= MAX_FILES) {
          errors.push(isEn ? 'Maximum ' + MAX_FILES + ' files allowed.' : 'الحد الأقصى ' + MAX_FILES + ' ملفات.');
          return;
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
          errors.push((isEn ? 'File type not allowed: ' : 'نوع الملف غير مسموح: ') + file.name);
          return;
        }
        if (file.size > MAX_FILE_BYTES) {
          errors.push((isEn ? 'File too large: ' : 'حجم الملف كبير: ') + file.name);
          return;
        }
        if (totalSize + file.size > MAX_TOTAL_BYTES) {
          errors.push(isEn ? 'Total file size exceeds limit.' : 'إجمالي حجم الملفات يتجاوز الحد.');
          return;
        }
        selectedFiles.push(file);
        totalSize += file.size;
      });

      updateFileList();
      return errors;
    });

    return {
      getFiles: () => selectedFiles,
      updateFileList,
      clearFiles: () => { selectedFiles = []; updateFileList(); }
    };
  }

  function initMultiStepForm(form) {
    const lang = getLang(form);
    const isEn = lang === 'en';
    const steps = Array.from(form.querySelectorAll('.fr-step'));
    if (!steps.length) return false;

    const totalSteps = steps.length;
    const progressFill = form.querySelector('.funding-request__progress-fill');
    const progressLabel = form.querySelector('[data-fr-progress-label]');
    const formCard = form.closest('.funding-request__card');
    const successCard = formCard ? formCard.querySelector('.funding-request__success') : null;
    const whatsappBtn = successCard ? successCard.querySelector('[data-fr-success-whatsapp]') : null;
    const status = form.querySelector('[data-fr-status]');
    const submitBtn = form.querySelector('[data-fr-submit]');

    let currentStep = 1;

    function setStatus(type, message) {
      if (!status) return;
      status.textContent = message;
      status.className = 'funding-request__status funding-request__status--' + type + ' is-visible';
    }

    function clearStatus() {
      if (!status) return;
      status.textContent = '';
      status.className = 'funding-request__status';
    }

    function updateProgress() {
      const pct = Math.round((currentStep / totalSteps) * 100);
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressLabel) {
        progressLabel.textContent = isEn
          ? 'Step ' + currentStep + ' of ' + totalSteps
          : 'الخطوة ' + currentStep + ' من ' + totalSteps;
      }
    }

    function showStep(step) {
      steps.forEach((el, idx) => {
        el.classList.toggle('is-active', idx + 1 === step);
      });
      currentStep = step;
      updateProgress();
      clearStatus();

      const activeStep = steps[step - 1];
      if (activeStep) {
        const firstInput = activeStep.querySelector('input, select, textarea');
        if (firstInput && typeof firstInput.focus === 'function') {
          setTimeout(() => firstInput.focus({ preventScroll: true }), 50);
        }
      }
    }

    function goNext() {
      const stepEl = steps[currentStep - 1];
      if (!validateStep(stepEl, lang)) return;
      if (currentStep < totalSteps) {
        trackFundingEvent('funding_step_' + currentStep + '_completed', { lang });
        showStep(currentStep + 1);
      }
    }

    function goBack() {
      if (currentStep > 1) {
        showStep(currentStep - 1);
      }
    }

    restoreFormState(form);

    form.querySelectorAll('.fr-step__next').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        goNext();
      });
    });

    form.querySelectorAll('.fr-step__back').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        goBack();
      });
    });

    form.querySelectorAll('input, select, textarea').forEach((field) => {
      if (field.type === 'file' || field.classList.contains('funding-request__hp')) return;
      field.addEventListener('input', () => {
        clearFieldError(field);
        saveFormState(form);
      });
      field.addEventListener('change', () => {
        clearFieldError(field);
        saveFormState(form);
      });
    });

    showStep(1);
    trackFundingEvent('funding_form_started', { lang });

    const fileUpload = initFileUpload(form, isEn);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearStatus();

      let isValid = true;
      let firstInvalid = null;
      steps.forEach((step) => {
        const fields = step.querySelectorAll('input, select, textarea');
        fields.forEach((field) => {
          if (field.classList.contains('funding-request__hp') || field.type === 'file') return;
          if (!validateField(field, lang)) {
            isValid = false;
            if (!firstInvalid) firstInvalid = field;
          }
        });
      });

      if (!isValid) {
        const stepIndex = firstInvalid ? steps.findIndex((s) => s.contains(firstInvalid)) + 1 : 1;
        if (stepIndex && stepIndex !== currentStep) showStep(stepIndex);
        if (firstInvalid) {
          firstInvalid.focus({ preventScroll: true });
          firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        trackFundingEvent('funding_form_error', { lang, reason: 'validation' });
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalText = submitBtn.textContent;
        submitBtn.textContent = isEn ? 'Sending...' : 'جاري الإرسال...';
      }

      try {
        const formData = new FormData(form);
        const body = {
          lang,
          name: String(formData.get('name') || '').trim(),
          company: String(formData.get('company') || '').trim(),
          email: String(formData.get('email') || '').trim(),
          phone: String(formData.get('phone') || '').trim(),
          country: String(formData.get('country') || '').trim(),
          financingType: String(formData.get('financingType') || '').trim(),
          amount: String(formData.get('amount') || '').trim(),
          purpose: (() => {
            const category = String(formData.get('purposeCategory') || '').trim();
            const details = String(formData.get('purpose') || '').trim();
            return category ? (category + (details ? ' — ' + details : '')) : details;
          })(),
          letter: String(formData.get('letter') || '').trim(),
          website: String(formData.get('website') || '').trim()
        };

        const files = [];
        for (const file of fileUpload.getFiles()) {
          const data = await readFileAsDataURL(file);
          files.push({ name: file.name, type: file.type, data });
        }
        body.files = files;

        trackFundingEvent('funding_form_submitted', { lang });

        const endpoint = form.dataset.endpoint || '/api/funding-request';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const result = await response.json().catch(() => ({}));

        if (response.ok && result.success) {
          trackFundingEvent('funding_form_success', { lang });
          clearFormState(form);
          clearPrefillBanner(form);
          if (window.BondsFundingContext) window.BondsFundingContext.clear();
          form.reset();
          if (fileUpload.clearFiles) fileUpload.clearFiles();

          if (successCard) {
            form.classList.add('is-hidden');
            successCard.classList.add('is-visible');
            if (whatsappBtn) whatsappBtn.href = getWhatsAppLink(lang);
          } else {
            setStatus('success', result.message || getMessage(form, 'success', isEn ? 'Sent successfully.' : 'تم الإرسال بنجاح.'));
          }
        } else {
          trackFundingEvent('funding_form_error', { lang, reason: 'server' });
          setStatus('error', result.error || getMessage(form, 'error', isEn ? 'Failed to send. Please try again.' : 'فشل الإرسال. يرجى المحاولة مرة أخرى.'));
        }
      } catch (err) {
        trackFundingEvent('funding_form_error', { lang, reason: 'network' });
        setStatus('error', getMessage(form, 'error', isEn ? 'Failed to send. Please try again.' : 'فشل الإرسال. يرجى المحاولة مرة أخرى.'));
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtn.dataset.originalText || (isEn ? 'Start My Funding Assessment' : 'ابدأ التقييم التمويلي');
        }
      }
    });

    return true;
  }

  function initSimpleForm(form) {
    const lang = getLang(form);
    const isEn = lang === 'en';
    const fileInput = form.querySelector('[data-fr-file]');
    const fileList = form.querySelector('[data-fr-file-list]');
    const fileAreaText = form.querySelector('[data-fr-file-text]');
    const status = form.querySelector('[data-fr-status]');
    const submitBtn = form.querySelector('[data-fr-submit]');
    let selectedFiles = [];

    function setStatus(type, message) {
      if (!status) return;
      status.textContent = message;
      status.className = 'funding-request__status funding-request__status--' + type + ' is-visible';
    }

    function clearStatus() {
      if (!status) return;
      status.textContent = '';
      status.className = 'funding-request__status';
    }

    function updateFileList() {
      if (!fileList) return;
      fileList.innerHTML = '';
      selectedFiles.forEach((file, index) => {
        const chip = document.createElement('span');
        chip.className = 'funding-request__file-chip';
        chip.textContent = file.name + ' (' + formatBytes(file.size) + ')';

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'funding-request__file-remove';
        remove.setAttribute('aria-label', (isEn ? 'Remove ' : 'إزالة ') + file.name);
        remove.textContent = '×';
        remove.addEventListener('click', () => {
          selectedFiles.splice(index, 1);
          updateFileList();
        });

        chip.appendChild(remove);
        fileList.appendChild(chip);
      });

      if (fileAreaText) {
        fileAreaText.textContent = selectedFiles.length
          ? (isEn ? 'Click or drag to add more files' : 'انقر أو اسحب لإضافة ملفات أخرى')
          : (isEn ? 'Click or drag files here' : 'انقر أو اسحب الملفات هنا');
      }
    }

    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const incoming = Array.from(fileInput.files || []);
        fileInput.value = '';

        let totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
        const errors = [];

        incoming.forEach((file) => {
          if (selectedFiles.length >= MAX_FILES) {
            errors.push(isEn ? 'Maximum ' + MAX_FILES + ' files allowed.' : 'الحد الأقصى ' + MAX_FILES + ' ملفات.');
            return;
          }
          if (!ALLOWED_TYPES.includes(file.type)) {
            errors.push((isEn ? 'File type not allowed: ' : 'نوع الملف غير مسموح: ') + file.name);
            return;
          }
          if (file.size > MAX_FILE_BYTES) {
            errors.push((isEn ? 'File too large: ' : 'حجم الملف كبير: ') + file.name);
            return;
          }
          if (totalSize + file.size > MAX_TOTAL_BYTES) {
            errors.push(isEn ? 'Total file size exceeds limit.' : 'إجمالي حجم الملفات يتجاوز الحد.');
            return;
          }
          selectedFiles.push(file);
          totalSize += file.size;
        });

        updateFileList();
        if (errors.length) {
          setStatus('error', errors[0]);
        } else {
          clearStatus();
        }
      });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearStatus();

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalText = submitBtn.textContent;
        submitBtn.textContent = isEn ? 'Sending...' : 'جاري الإرسال...';
      }

      try {
        const formData = new FormData(form);
        const body = {
          lang,
          name: String(formData.get('name') || '').trim(),
          company: String(formData.get('company') || '').trim(),
          email: String(formData.get('email') || '').trim(),
          phone: String(formData.get('phone') || '').trim(),
          country: String(formData.get('country') || '').trim(),
          financingType: String(formData.get('financingType') || '').trim(),
          amount: String(formData.get('amount') || '').trim(),
          purpose: (() => {
            const category = String(formData.get('purposeCategory') || '').trim();
            const details = String(formData.get('purpose') || '').trim();
            return category ? (category + (details ? ' — ' + details : '')) : details;
          })(),
          letter: String(formData.get('letter') || '').trim(),
          website: String(formData.get('website') || '').trim()
        };

        const files = [];
        for (const file of selectedFiles) {
          const data = await readFileAsDataURL(file);
          files.push({ name: file.name, type: file.type, data });
        }
        body.files = files;

        const endpoint = form.dataset.endpoint || '/api/funding-request';
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const result = await response.json().catch(() => ({}));

        if (response.ok && result.success) {
          setStatus('success', result.message || getMessage(form, 'success', isEn ? 'Sent successfully.' : 'تم الإرسال بنجاح.'));
          clearPrefillBanner(form);
          if (window.BondsFundingContext) window.BondsFundingContext.clear();
          form.reset();
          selectedFiles = [];
          updateFileList();
        } else {
          setStatus('error', result.error || getMessage(form, 'error', isEn ? 'Failed to send. Please try again.' : 'فشل الإرسال. يرجى المحاولة مرة أخرى.'));
        }
      } catch (err) {
        setStatus('error', getMessage(form, 'error', isEn ? 'Failed to send. Please try again.' : 'فشل الإرسال. يرجى المحاولة مرة أخرى.'));
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtn.dataset.originalText || (isEn ? 'Submit Request' : 'إرسال الطلب');
        }
      }
    });
  }

  function initForm(form) {
    if (!form || form.dataset.frInitialized === 'true') return;
    form.dataset.frInitialized = 'true';
    const lang = getLang(form);

    if (initMultiStepForm(form)) {
      applyPrefill(form, lang);
      return;
    }
    initSimpleForm(form);
    applyPrefill(form, lang);
  }

  function initAll() {
    document.querySelectorAll('[data-funding-request-form]').forEach(initForm);
  }

  function updateWhatsAppLinks() {
    const link = getWhatsAppLink(document.documentElement.lang || 'ar');
    document.querySelectorAll('[data-fr-whatsapp-cta], [data-fr-success-whatsapp]').forEach((el) => {
      if (el && el.tagName === 'A') el.href = link;
    });
  }

  function initAll() {
    document.querySelectorAll('[data-funding-request-form]').forEach(initForm);
    updateWhatsAppLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();

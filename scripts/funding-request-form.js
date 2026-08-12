/* ===== Funding Request Form Handler ===== */
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

  function initForm(form) {
    if (!form || form.dataset.frInitialized === 'true') return;
    form.dataset.frInitialized = 'true';

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
        remove.setAttribute('aria-label', isEn ? 'Remove ' + file.name : 'إزالة ' + file.name);
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

        incoming.forEach(file => {
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
          purpose: String(formData.get('purpose') || '').trim(),
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

  function initAll() {
    document.querySelectorAll('[data-funding-request-form]').forEach(initForm);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();

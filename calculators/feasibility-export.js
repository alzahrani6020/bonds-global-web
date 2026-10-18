(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.BondsFeasibilityExport = api;
    root.getCalculatorData = api.getCalculatorData;
    root.generateProfessionalPDF = api.exportProfessionalPdf;
    root.exportToExcel = api.exportToExcel;
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
  const MAX_PDF_PAGES = 100;
  const MAX_ANALYSIS_CHARS = 25000;

  function cleanText(value) {
    return String(value == null ? '' : value)
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sanitizeFilename(value, fallback) {
    const safe = cleanText(value)
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 90);
    return safe || fallback || 'bonds-feasibility-study';
  }

  function parseMaybeNumber(value) {
    if (typeof value === 'number') return value;
    const raw = cleanText(value)
      .replace(/[,%]/g, '')
      .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660))
      .replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0));
    if (!raw || !/^-?\d+(?:\.\d+)?$/.test(raw)) return value == null ? '' : value;
    const n = Number(raw);
    return Number.isFinite(n) ? n : value;
  }

  function controlValue(el) {
    if (!el) return '';
    if (el.type === 'checkbox') return el.checked ? true : false;
    if (el.type === 'radio') return el.checked ? (el.value || true) : '';
    if (el.tagName === 'SELECT') {
      if (el.multiple) return Array.from(el.selectedOptions || []).map(o => cleanText(o.textContent || o.value)).join(', ');
      return cleanText(el.selectedOptions?.[0]?.textContent || el.value);
    }
    const raw = el.value != null ? el.value : el.textContent;
    return el.type === 'number' || el.type === 'range' ? parseMaybeNumber(raw) : cleanText(raw);
  }

  function labelFor(el, index) {
    if (!el) return 'Field ' + (index + 1);
    if (el.id && typeof document !== 'undefined') {
      const explicit = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (explicit) return cleanText(explicit.textContent);
    }
    const group = el.closest?.('.field-group, .form-group, .input-group, .calc-field, td, li');
    const label = group?.querySelector?.('label');
    const labelText = cleanText(label?.textContent);
    if (labelText) return labelText;
    return cleanText(
      el.getAttribute?.('aria-label') ||
      el.getAttribute?.('data-label') ||
      el.getAttribute?.('placeholder') ||
      el.name ||
      el.id ||
      ('Field ' + (index + 1))
    );
  }

  function cellValue(cell) {
    if (!cell) return '';
    const controls = Array.from(cell.querySelectorAll('input, textarea, select'));
    if (controls.length === 1) return controlValue(controls[0]);
    if (controls.length > 1) {
      return controls.map((el, i) => {
        const label = labelFor(el, i);
        const value = controlValue(el);
        return value === '' ? '' : (label + ': ' + value);
      }).filter(Boolean).join(' | ');
    }
    return parseMaybeNumber(cleanText(cell.textContent));
  }

  function tableModel(table, index) {
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => cleanText(th.textContent));
    const rows = Array.from(table.querySelectorAll('tbody tr')).map(row =>
      Array.from(row.children).map(cellValue)
    ).filter(row => row.some(value => value !== '' && value !== false));

    let title = table.getAttribute('aria-label') || table.dataset?.title || table.id || '';
    if (!title) {
      const prev = table.previousElementSibling;
      title = cleanText(prev?.textContent);
    }
    return {
      id: table.id || ('table-' + (index + 1)),
      title: cleanText(title) || ('Table ' + (index + 1)),
      headers,
      rows
    };
  }

  function sectionTitle(page, index) {
    return cleanText(
      page.querySelector('.template-header-print .doc-title')?.textContent ||
      page.querySelector('.page-header h2')?.textContent ||
      page.querySelector('h1,h2,h3')?.textContent ||
      page.id ||
      ('Section ' + (index + 1))
    );
  }

  function collectStudy(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) throw new Error('Document is required');

    const pages = Array.from(doc.querySelectorAll('.template-page'));
    const sections = pages.map((page, sectionIndex) => {
      const controls = Array.from(page.querySelectorAll('input, textarea, select'))
        .filter(el => !el.closest('table'));
      const fields = controls.map((el, index) => ({
        id: el.id || el.name || ('field-' + (index + 1)),
        label: labelFor(el, index),
        value: controlValue(el),
        type: el.type || el.tagName.toLowerCase()
      }));

      const tables = Array.from(page.querySelectorAll('table')).map(tableModel);
      return {
        id: page.id || ('section-' + (sectionIndex + 1)),
        title: sectionTitle(page, sectionIndex),
        fields,
        tables
      };
    });

    const projectName =
      doc.getElementById('cover-business-name')?.value ||
      doc.getElementById('project-name')?.value ||
      sections[0]?.fields?.find(f => /project|مشروع/i.test(f.label))?.value ||
      '';

    return {
      schemaVersion: 1,
      lang: doc.documentElement?.lang || 'ar',
      dir: doc.documentElement?.dir || (doc.documentElement?.lang === 'ar' ? 'rtl' : 'ltr'),
      generatedAt: new Date().toISOString(),
      projectName: cleanText(projectName),
      sectionCount: sections.length,
      sections
    };
  }

  function flattenRows(model) {
    const rows = [];
    model.sections.forEach(section => {
      rows.push([section.title, '']);
      section.fields.forEach(field => rows.push([field.label, field.value]));
      section.tables.forEach(table => {
        rows.push([table.title, '']);
        if (table.headers.length) rows.push(table.headers);
        table.rows.forEach(row => rows.push(row));
      });
      rows.push([]);
    });
    return rows;
  }

  function getCalculatorData() {
    const model = collectStudy();
    return {
      model,
      csvRows: flattenRows(model)
    };
  }

  function uniqueSheetName(raw, used) {
    const base = cleanText(raw).replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Section';
    let name = base;
    let i = 2;
    while (used.has(name)) {
      const suffix = '-' + i++;
      name = base.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(name);
    return name;
  }

  function buildSectionRows(section) {
    const rows = [[section.title], []];
    if (section.fields.length) {
      rows.push(['Field', 'Value']);
      section.fields.forEach(field => rows.push([field.label, field.value]));
    }
    section.tables.forEach(table => {
      rows.push([]);
      rows.push([table.title]);
      if (table.headers.length) rows.push(table.headers);
      table.rows.forEach(row => rows.push(row));
    });
    return rows;
  }

  function exportToExcel() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    if (!window.XLSX) {
      alert(document.documentElement.lang === 'ar'
        ? 'تعذر تحميل مكتبة Excel. تحقق من الاتصال ثم أعد المحاولة.'
        : 'Excel library is unavailable. Check your connection and retry.');
      return false;
    }

    const model = collectStudy(document);
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    wb.Props = {
      Title: (model.lang === 'ar' ? 'دراسة جدوى - ' : 'Feasibility Study - ') + (model.projectName || 'Bonds'),
      Subject: 'Integrated Feasibility Study',
      Author: 'Bonds Global',
      CreatedDate: new Date()
    };

    const summary = [
      [model.lang === 'ar' ? 'دراسة الجدوى المتكاملة — بوندز' : 'Integrated Feasibility Study — Bonds'],
      [],
      [model.lang === 'ar' ? 'اسم المشروع' : 'Project', model.projectName],
      [model.lang === 'ar' ? 'تاريخ التصدير' : 'Exported at', model.generatedAt],
      [model.lang === 'ar' ? 'عدد الأقسام' : 'Sections', model.sectionCount]
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summary);
    summaryWs['!cols'] = [{ wch: 30 }, { wch: 50 }];
    summaryWs['!views'] = [{ RTL: model.dir === 'rtl' }];
    XLSX.utils.book_append_sheet(wb, summaryWs, model.lang === 'ar' ? 'ملخص' : 'Summary');

    const used = new Set([model.lang === 'ar' ? 'ملخص' : 'Summary']);
    model.sections.forEach((section, index) => {
      const rows = buildSectionRows(section);
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const maxCols = Math.max(2, ...rows.map(r => r.length));
      ws['!cols'] = Array.from({ length: maxCols }, (_, i) => ({ wch: i === 0 ? 30 : 22 }));
      ws['!views'] = [{ RTL: model.dir === 'rtl' }];
      const sheetName = uniqueSheetName((index + 1) + ' ' + section.title, used);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    const filename = sanitizeFilename(model.projectName, 'bonds-feasibility-study') + '.xlsx';
    XLSX.writeFile(wb, filename, { compression: true });
    return true;
  }

  async function waitForPrintAssets(doc) {
    if (doc.fonts?.ready) {
      try { await doc.fonts.ready; } catch (_) {}
    }
    const images = Array.from(doc.images || []);
    await Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve();
      if (img.decode) return img.decode().catch(() => {});
      return new Promise(resolve => {
        const done = () => resolve();
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        setTimeout(done, 3000);
      });
    }));
  }

  async function exportProfessionalPdf() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    const model = collectStudy(document);
    const previousTitle = document.title;
    const filename = sanitizeFilename(model.projectName, 'bonds-feasibility-study');
    const root = document.documentElement;

    root.classList.add('bonds-professional-print');
    document.title = filename;

    const cleanup = () => {
      root.classList.remove('bonds-professional-print');
      document.title = previousTitle;
    };

    try {
      await waitForPrintAssets(document);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      window.addEventListener('afterprint', cleanup, { once: true });
      window.print();
      setTimeout(cleanup, 15000);
      return true;
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  function validateImportFile(file) {
    if (!file) return { ok: false, code: 'NO_FILE' };
    if (file.size > MAX_IMPORT_BYTES) {
      return { ok: false, code: 'FILE_TOO_LARGE', maxBytes: MAX_IMPORT_BYTES };
    }
    return { ok: true };
  }

  function validatePdfPageCount(count) {
    const pages = Number(count) || 0;
    return pages > MAX_PDF_PAGES
      ? { ok: false, code: 'PDF_TOO_MANY_PAGES', maxPages: MAX_PDF_PAGES }
      : { ok: true };
  }

  function limitAnalysisText(text) {
    const raw = String(text || '').trim();
    return {
      text: raw.slice(0, MAX_ANALYSIS_CHARS),
      originalLength: raw.length,
      truncated: raw.length > MAX_ANALYSIS_CHARS,
      maxChars: MAX_ANALYSIS_CHARS
    };
  }

  async function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (typeof window === 'undefined') return headers;

    try {
      const sb = window.BondsAuth?.getSupabase?.() || window.supabaseClient || null;
      const result = await sb?.auth?.getSession?.();
      const token = result?.data?.session?.access_token;
      if (token) headers.Authorization = 'Bearer ' + token;
    } catch (_) {}
    return headers;
  }

  return {
    MAX_IMPORT_BYTES,
    MAX_PDF_PAGES,
    MAX_ANALYSIS_CHARS,
    sanitizeFilename,
    parseMaybeNumber,
    collectStudy,
    flattenRows,
    getCalculatorData,
    exportToExcel,
    exportProfessionalPdf,
    validateImportFile,
    validatePdfPageCount,
    limitAnalysisText,
    getAuthHeaders
  };
});

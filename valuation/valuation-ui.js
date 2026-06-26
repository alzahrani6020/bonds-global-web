/**
 * BONDS Valuation Intelligence Platform — Shared UI Controller
 *
 * Expects a global VALUATION_LOCALE object with:
 *   lang, texts, steps (10), fieldsByClass { slug: [[fields step0], ...] }
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'bonds_valuation_draft';

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

  function formatCurrency(n, lang) {
    const num = Number(n) || 0;
    return num.toLocaleString(lang === 'en' ? 'en-US' : 'ar-SA', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
    });
  }

  function debounce(fn, wait) {
    let t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, wait);
    };
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDueIndicator(dueStr) {
    if (!dueStr) return '';
    const due = new Date(dueStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    if (diff < 0) return ' ⚠️ متأخر';
    if (diff <= 30) return ' ⏳ قريب';
    return '';
  }

  class ValuationUI {
    constructor(locale) {
      this.locale = locale;
      this.lang = locale.lang || 'ar';
      this.currentAsset = null;
      this.currentStep = 0;
      this.inputs = {};
      this.engine = new window.ValuationEngine();
      this.model = null;

      this.cacheElements();
      this.bindEvents();
      this.renderAssetGrid();
      this.checkDraft();
    }

    cacheElements() {
      this.assetGrid = $('#assetGrid');
      this.wizard = $('#wizard');
      this.wizardTitle = $('#wizardTitle');
      this.stepIndicator = $('#stepIndicator');
      this.wizardStepTitle = $('#wizardStepTitle');
      this.wizardStepDesc = $('#wizardStepDesc');
      this.wizardFields = $('#wizardFields');
      this.btnPrev = $('#wizardPrev');
      this.btnNext = $('#wizardNext');
      this.btnSubmit = $('#wizardSubmit');
      this.results = $('#resultsDashboard');
      this.valuationCards = $('#valuationCards');
      this.restoreBanner = $('#restoreBanner');
      this.restoreText = $('#restoreText');
      this.deprecationChart = null;
      this.marketTrendChart = null;
    }

    bindEvents() {
      this.btnPrev.addEventListener('click', () => this.prevStep());
      this.btnNext.addEventListener('click', () => this.nextStep());
      this.btnSubmit.addEventListener('click', () => this.submit());
      $('#wizardClose').addEventListener('click', () => this.closeWizard());
      $('#restoreBtn').addEventListener('click', () => this.restoreDraft());
      $('#discardBtn').addEventListener('click', () => this.discardDraft());
    }

    renderAssetGrid() {
      const activeSlugs = window.AssetClass.list().filter(s => window.AssetClass.isActive(s));
      this.assetGrid.innerHTML = window.AssetClass.list().map(slug => {
        const meta = window.AssetClass._labels[slug];
        const isActive = meta.active;
        const label = window.AssetClass.getLabel(slug, this.lang);
        const badgeText = isActive
          ? (this.locale.texts.activeBadge || 'متاح')
          : (this.locale.texts.comingSoonBadge || 'قريباً');
        const icon = this.locale.icons && this.locale.icons[slug] ? this.locale.icons[slug] : '📦';
        return `
          <div class="asset-card ${isActive ? 'asset-card--active' : 'asset-card--disabled'}" data-slug="${slug}" role="${isActive ? 'button' : ''}" tabindex="${isActive ? '0' : '-1'}">
            <div class="asset-card__icon">${icon}</div>
            <div class="asset-card__name">${label}</div>
            <span class="asset-card__badge">${badgeText}</span>
          </div>
        `;
      }).join('');

      $$('.asset-card--active', this.assetGrid).forEach(card => {
        card.addEventListener('click', () => this.selectAsset(card.dataset.slug));
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.selectAsset(card.dataset.slug);
          }
        });
      });
    }

    selectAsset(slug) {
      if (!window.AssetClass.isActive(slug)) return;
      this.currentAsset = slug;
      this.currentStep = 0;
      this.inputs = { assetClass: slug };
      this.model = new window.ValuationModel(slug, this.inputs);

      // Apply field defaults
      const fields = this.locale.fieldsByClass[slug] || [];
      fields.forEach(stepFields => {
        stepFields.forEach(f => {
          if (f.default !== undefined && this.inputs[f.name] === undefined) {
            this.inputs[f.name] = f.default;
          }
        });
      });

      this.wizard.classList.add('is-open');
      this.results.classList.remove('is-open');
      this.wizardTitle.textContent = window.AssetClass.getLabel(slug, this.lang);
      this.renderStepIndicator();
      this.renderStep();
      this.saveDraft();
      this.wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    getFieldDefinitions() {
      const fields = this.locale.fieldsByClass[this.currentAsset] || [];
      const stepFields = fields[this.currentStep] || [];

      // Universal depreciation factors injected into the Depreciation step
      if (this.currentStep === 3) {
        return [
          ...stepFields,
          { name: 'environmentalExposure', label: this.locale.texts.environmentalExposure, type: 'number', min: 0, max: 1, step: 0.1, default: 0 },
          { name: 'techObsolescenceRate', label: this.locale.texts.techObsolescenceRate, type: 'number', min: 0, max: 1, step: 0.1, default: 0 },
          { name: 'functionalObsolescence', label: this.locale.texts.functionalObsolescence, type: 'number', min: 0, max: 1, step: 0.1, default: 0 },
          { name: 'maintenanceNeglect', label: this.locale.texts.maintenanceNeglect, type: 'number', min: 0, max: 1, step: 0.1, default: 0 },
          { name: 'misuseFactor', label: this.locale.texts.misuseFactor, type: 'number', min: 0, max: 1, step: 0.1, default: 0 },
          { name: 'projectionYears', label: this.locale.texts.projectionYears, type: 'number', min: 0, max: 100, step: 1, default: 5 },
          { name: 'inflationRate', label: this.locale.texts.inflationRate, type: 'number', min: -0.1, max: 0.5, step: 0.01, default: 0.03 }
        ];
      }

      return stepFields;
    }

    collectStepInputs() {
      const defs = this.getFieldDefinitions();
      defs.forEach(def => {
        const el = $(`[name="${def.name}"]`);
        if (!el) return;
        let value = el.value;
        if (def.type === 'number' || def.type === 'range') {
          value = value === '' ? (def.default !== undefined ? def.default : 0) : Number(value);
        } else if (def.type === 'select') {
          value = value;
        }
        this.inputs[def.name] = value;
      });
      if (this.model) this.model.set(this.inputs);
    }

    renderStepIndicator() {
      this.stepIndicator.innerHTML = this.locale.steps.map((step, idx) => {
        const state = idx < this.currentStep ? 'step--complete' : (idx === this.currentStep ? 'step--active' : '');
        return `
          <div class="step ${state}" data-step="${idx}" role="button" tabindex="0" aria-label="${step.title}">
            <div class="step__dot">${idx < this.currentStep ? '✓' : (idx + 1)}</div>
            <div class="step__label">${step.title}</div>
          </div>
        `;
      }).join('');

      $$('.step', this.stepIndicator).forEach(step => {
        const idx = Number(step.dataset.step);
        if (idx < this.currentStep) {
          step.addEventListener('click', () => this.goToStep(idx));
        }
      });
    }

    renderStep() {
      const step = this.locale.steps[this.currentStep];
      this.wizardStepTitle.textContent = `${this.currentStep + 1}. ${step.title}`;
      this.wizardStepDesc.textContent = step.description;

      const defs = this.getFieldDefinitions();
      this.wizardFields.innerHTML = `
        <div class="form-grid">
          ${defs.map(def => this.renderField(def)).join('')}
        </div>
      `;

      // Restore values
      defs.forEach(def => {
        const el = $(`[name="${def.name}"]`);
        if (!el) return;
        const val = this.inputs[def.name];
        if (val !== undefined) el.value = val;
      });

      if (this.currentStep === 1 && typeof BondsConditionAssessmentEngine !== 'undefined') {
        this.renderConditionAssessment();
      }

      this.attachInputListeners();
      this.updateActions();
    }

    async renderConditionAssessment() {
      const t = this.locale.texts;
      const assetClass = this.currentAsset;
      if (!assetClass) return;

      let panel = $('#conditionAssessmentPanel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'conditionAssessmentPanel';
        panel.className = 'condition-assessment-panel';
        this.wizardFields.appendChild(panel);
      }

      panel.innerHTML = `<div class="ca-loading">${this.lang === 'en' ? 'Loading condition checklist...' : 'جاري تحميل قائمة الفحص...'}</div>`;

      let standards = null;
      if (typeof BondsConditionAssessmentClient !== 'undefined') {
        try {
          const res = await BondsConditionAssessmentClient.loadStandards(assetClass);
          standards = res.success ? res.data : null;
        } catch (e) {
          console.warn('[ValuationUI] Failed to load CA standards:', e);
        }
      }
      if (!standards) {
        standards = BondsConditionAssessmentEngine.getEmbeddedStandards(assetClass);
      }

      if (!standards || !Array.isArray(standards.points) || standards.points.length === 0) {
        panel.innerHTML = '';
        return;
      }

      this._currentConditionStandards = standards;
      this.inputs.conditionAssessment = this.inputs.conditionAssessment || {};

      const categories = standards.categories || [];
      const pointsByCategory = {};
      standards.points.forEach(p => {
        pointsByCategory[p.category] = pointsByCategory[p.category] || [];
        pointsByCategory[p.category].push(p);
      });

      const isEn = this.lang === 'en';

      this.inputs.conditionAssessmentMeta = this.inputs.conditionAssessmentMeta || {};
      const meta = this.inputs.conditionAssessmentMeta;

      const statusOptions = [
        { value: 'draft', label: t.conditionDraft || 'مسودة' },
        { value: 'final', label: t.conditionFinal || 'نهائي' },
        { value: 'archived', label: t.conditionArchived || 'مؤرشف' }
      ];

      const today = new Date().toISOString().split('T')[0];

      let html = `
        <div class="ca-header">
          <h4 class="ca-title">${t.conditionAssessmentTitle || 'تقييم الحالة التفصيلي'}</h4>
          <p class="ca-desc">${t.conditionAssessmentDesc || ''}</p>
        </div>
        <div class="ca-result" id="caResult" style="display:none"></div>

        <div class="ca-maintenance" id="caMaintenance" style="display:none">
          <h5 class="ca-maintenance__title">${t.conditionMaintenanceTitle || 'خطة الصيانة المقترحة'}</h5>
          <button type="button" class="btn-outline" id="caMaintenanceBtn">${t.conditionMaintenanceGenerate || 'توليد خطة الصيانة'}</button>
          <div id="caMaintenanceList" class="ca-maintenance__list"></div>
        </div>

        <div class="ca-history" id="caHistory" style="display:none">
          <h5 class="ca-history__title">${t.conditionHistoryTitle || 'تاريخ التقييمات'}</h5>
          <div class="ca-history__chart-wrap">
            <canvas id="caHistoryChart"></canvas>
          </div>
          <p class="ca-history__empty" id="caHistoryEmpty" style="display:none">${t.conditionHistoryNoData || ''}</p>
        </div>

        <div class="ca-comparison" id="caComparison" style="display:none">
          <h5 class="ca-comparison__title">${t.conditionCompareTitle || 'مقارنة الأصول'}</h5>
          <div class="ca-comparison__select-wrap">
            <select id="caComparisonSelect" multiple></select>
          </div>
          <div class="ca-comparison__table-wrap" id="caComparisonTableWrap"></div>
          <div class="ca-comparison__chart-wrap">
            <canvas id="caComparisonChart"></canvas>
          </div>
          <button type="button" class="btn-outline" id="caComparisonExportBtn">${t.conditionCompareExport || 'تصدير المقارنة'}</button>
        </div>

        <div class="ca-meta">
          <div class="ca-meta__grid">
            <div class="ca-meta__field">
              <label>${t.conditionAssetName || 'اسم الأصل'}</label>
              <input type="text" id="caAssetName" value="${escapeHtml(meta.assetName || this.inputs.assetName || '')}" />
            </div>
            <div class="ca-meta__field">
              <label>${t.conditionAssetIdentifier || 'معرّف الأصل'}</label>
              <input type="text" id="caAssetIdentifier" value="${escapeHtml(meta.assetIdentifier || '')}" />
            </div>
            <div class="ca-meta__field">
              <label>${t.conditionAssessmentDate || 'تاريخ الفحص'}</label>
              <input type="date" id="caAssessmentDate" value="${meta.assessmentDate || today}" />
            </div>
            <div class="ca-meta__field">
              <label>${t.conditionStatus || 'حالة الفحص'}</label>
              <select id="caStatus">
                ${statusOptions.map(o => `<option value="${o.value}" ${(meta.status || 'draft') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="ca-meta__field ca-meta__field--full">
            <label>${t.conditionNotes || 'ملاحظات'}</label>
            <textarea id="caNotes" rows="2">${escapeHtml(meta.notes || '')}</textarea>
          </div>
          <div class="ca-meta__field ca-meta__field--full" id="caPreviousWrap" style="display:none">
            <label>${t.conditionLoadPrevious || 'تحميل تقييم سابق'}</label>
            <select id="caPreviousSelect"><option value="">—</option></select>
          </div>
          <div class="ca-actions" style="margin-top:1rem">
            <button type="button" class="btn-primary" id="caSaveBtn">${t.conditionSaveAssessment || 'حفظ التقييم'}</button>
            <button type="button" class="btn-outline" id="caLoadBtn">${t.conditionLoadPrevious || 'تحميل تقييم سابق'}</button>
          </div>
          <div id="caSaveStatus" class="ca-save-status"></div>
        </div>
      `;

      categories.forEach(cat => {
        const catPoints = pointsByCategory[cat.id];
        if (!catPoints || catPoints.length === 0) return;
        const catLabel = isEn ? cat.labelEn : cat.labelAr;
        html += `<div class="ca-category"><h5 class="ca-category__title">${catLabel}</h5><div class="ca-grid">`;
        catPoints.forEach(p => {
          const label = isEn ? p.labelEn : p.labelAr;
          const current = this.inputs.conditionAssessment[p.id];
          const valAttr = current !== undefined ? `value="${current}"` : '';
          let input = '';
          if (p.type === 'yes/no') {
            const yesSel = current === 'yes' ? 'selected' : '';
            const noSel = current === 'no' ? 'selected' : '';
            input = `<select data-point-id="${p.id}" class="ca-input ca-select"><option value="">—</option><option value="yes" ${yesSel}>${t.yes}</option><option value="no" ${noSel}>${t.no}</option></select>`;
          } else if (p.type === 'pass/fail') {
            const passSel = current === 'pass' ? 'selected' : '';
            const failSel = current === 'fail' ? 'selected' : '';
            input = `<select data-point-id="${p.id}" class="ca-input ca-select"><option value="">—</option><option value="pass" ${passSel}>${t.pass}</option><option value="fail" ${failSel}>${t.fail}</option></select>`;
          } else if (p.type === '0-10') {
            input = `<input type="number" data-point-id="${p.id}" class="ca-input" min="0" max="10" step="1" ${valAttr} placeholder="0-10" />`;
          } else {
            input = `<input type="number" data-point-id="${p.id}" class="ca-input" min="0" max="5" step="1" ${valAttr} placeholder="0-5" />`;
          }
          const criticalBadge = p.critical ? `<span class="ca-critical" title="${isEn ? 'Critical' : 'حرج'}">*</span>` : '';
          html += `
            <div class="ca-point ${p.critical ? 'ca-point--critical' : ''}">
              <label class="ca-point__label">${label} ${criticalBadge}</label>
              ${input}
            </div>
          `;
        });
        html += '</div></div>';
      });

      html += `
        <div class="ca-actions">
          <button type="button" class="btn-primary" id="caCalculateBtn">${t.conditionAssessmentCalculate}</button>
          <button type="button" class="btn-outline" id="caResetBtn">${t.conditionAssessmentReset}</button>
          <button type="button" class="btn-outline" id="caExportPdfBtn">${t.conditionExportPdf || 'PDF'}</button>
        </div>
      `;

      panel.innerHTML = html;

      const updateResult = () => {
        const result = BondsConditionAssessmentEngine.calculate(assetClass, this.inputs.conditionAssessment, { standards });
        this.inputs.conditionAssessmentResult = result;
        Object.assign(this.inputs, result.valuationInputs);

        // Update visible static fields if present
        ['conditionScore', 'maintenanceLevel', 'inspectionScore', 'environmentalExposure', 'techObsolescenceRate', 'functionalObsolescence', 'maintenanceNeglect', 'misuseFactor'].forEach(key => {
          const el = $(`[name="${key}"]`);
          if (el && result.valuationInputs[key] !== undefined) el.value = result.valuationInputs[key];
        });

        const resultEl = $('#caResult');
        if (resultEl) {
          resultEl.style.display = 'block';
          const gradeLabel = BondsConditionAssessmentEngine.getGradeLabel(result.grade, this.lang);
          resultEl.innerHTML = `
            <div class="ca-result__grid">
              <div class="ca-result__item"><span>${t.conditionScoreResult}</span><strong>${result.score}</strong></div>
              <div class="ca-result__item"><span>${t.conditionGradeResult}</span><strong>${result.grade} — ${gradeLabel}</strong></div>
              <div class="ca-result__item"><span>${t.conditionConfidenceResult}</span><strong>${result.confidenceScore}%</strong></div>
            </div>
            ${result.capped ? `<div class="ca-critical-warning">⚠ ${t.conditionCriticalWarning}</div>` : ''}
          `;
        }
        this.saveDraft();
      };

      $$('.ca-input', panel).forEach(el => {
        el.addEventListener('change', () => {
          const id = el.dataset.pointId;
          const raw = el.value;
          if (raw === '') {
            delete this.inputs.conditionAssessment[id];
          } else {
            this.inputs.conditionAssessment[id] = raw;
          }
          updateResult();
        });
      });

      $('#caCalculateBtn', panel).addEventListener('click', updateResult);
      $('#caResetBtn', panel).addEventListener('click', () => {
        this.inputs.conditionAssessment = {};
        this.inputs.conditionAssessmentMeta = {};
        this.renderConditionAssessment();
        updateResult();
      });
      $('#caExportPdfBtn', panel).addEventListener('click', () => this.exportConditionAssessmentPDF(panel));

      const maintenanceBtn = $('#caMaintenanceBtn', panel);
      if (maintenanceBtn) {
        maintenanceBtn.addEventListener('click', () => this.renderMaintenancePlan());
      }

      const comparisonSelect = $('#caComparisonSelect', panel);
      if (comparisonSelect) {
        comparisonSelect.addEventListener('change', () => this.renderComparison());
      }

      const comparisonExportBtn = $('#caComparisonExportBtn', panel);
      if (comparisonExportBtn) {
        comparisonExportBtn.addEventListener('click', () => this.exportComparisonTable());
      }

      const saveStatusEl = $('#caSaveStatus', panel);
      const showSaveStatus = (msg, isError) => {
        if (!saveStatusEl) return;
        saveStatusEl.textContent = msg;
        saveStatusEl.className = 'ca-save-status ' + (isError ? 'error' : 'success');
        setTimeout(() => { saveStatusEl.textContent = ''; saveStatusEl.className = 'ca-save-status'; }, 5000);
      };

      const readMeta = () => {
        return {
          assetName: $('#caAssetName', panel)?.value?.trim() || '',
          assetIdentifier: $('#caAssetIdentifier', panel)?.value?.trim() || '',
          assessmentDate: $('#caAssessmentDate', panel)?.value || new Date().toISOString().split('T')[0],
          status: $('#caStatus', panel)?.value || 'draft',
          notes: $('#caNotes', panel)?.value?.trim() || ''
        };
      };

      $('#caSaveBtn', panel).addEventListener('click', async () => {
        if (typeof BondsConditionAssessmentClient === 'undefined') {
          showSaveStatus('Client not available', true);
          return;
        }
        const meta = readMeta();
        this.inputs.conditionAssessmentMeta = meta;
        const result = this.inputs.conditionAssessmentResult;
        if (!result || Object.keys(this.inputs.conditionAssessment).length === 0) {
          showSaveStatus('احتسب الدرجة أولاً / Calculate score first', true);
          return;
        }
        const payload = {
          assetClass,
          assetName: meta.assetName,
          assetIdentifier: meta.assetIdentifier,
          assessmentDate: meta.assessmentDate,
          status: meta.status,
          notes: meta.notes,
          answers: this.inputs.conditionAssessment,
          score: result.score,
          grade: result.grade,
          confidenceScore: result.confidenceScore,
          categoryScores: result.categoryScores,
          criticalFailures: result.criticalFailures,
          valuationInputs: result.valuationInputs
        };
        const res = await BondsConditionAssessmentClient.saveAssessment(payload);
        if (res.success) {
          this.inputs.conditionAssessmentMeta.id = res.data?.id;
          showSaveStatus(t.conditionSavedSuccess || 'تم الحفظ', false);
          loadPreviousAssessments();
          this.renderHistoryChart(this._currentConditionStandards);
        } else {
          showSaveStatus((t.conditionSaveError || 'فشل الحفظ: ') + res.error, true);
        }
      });

      const loadPreviousAssessments = async () => {
        if (typeof BondsConditionAssessmentClient === 'undefined') return;
        const wrap = $('#caPreviousWrap', panel);
        const select = $('#caPreviousSelect', panel);
        if (!wrap || !select) return;
        const res = await BondsConditionAssessmentClient.loadAssessments({ assetClass, limit: 50 });
        if (!res.success || !res.data || res.data.length === 0) {
          wrap.style.display = 'none';
          this._conditionAssessmentsList = [];
          this.populateComparisonSelect();
          return;
        }
        this._conditionAssessmentsList = res.data;
        wrap.style.display = 'block';
        const currentId = this.inputs.conditionAssessmentMeta?.id;
        select.innerHTML = `<option value="">${t.conditionNoAssessments || '—'}</option>` +
          res.data.map(a => {
            const dueIndicator = formatDueIndicator(a.next_assessment_due);
            const label = `${a.assessment_date} — ${a.asset_name || a.asset_identifier || a.id} — ${a.grade || ''}${dueIndicator}`;
            return `<option value="${a.id}" ${a.id === currentId ? 'selected' : ''}>${escapeHtml(label)}</option>`;
          }).join('');

        this.populateComparisonSelect();
        const comparisonEl = $('#caComparison', panel);
        if (comparisonEl) comparisonEl.style.display = res.data.length >= 2 ? 'block' : 'none';

        select.addEventListener('change', async () => {
          const id = select.value;
          if (!id) return;
          const detail = await BondsConditionAssessmentClient.loadAssessment(id);
          if (!detail.success) return;
          const a = detail.data;
          this.inputs.conditionAssessment = a.answers || {};
          this.inputs.conditionAssessmentMeta = {
            id: a.id,
            assetName: a.asset_name || '',
            assetIdentifier: a.asset_identifier || '',
            assessmentDate: a.assessment_date,
            status: a.status,
            notes: a.notes || ''
          };
          this.renderConditionAssessment();
        }, { once: true });
      };

      $('#caLoadBtn', panel).addEventListener('click', () => {
        const wrap = $('#caPreviousWrap', panel);
        if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
        loadPreviousAssessments();
      });

      // Meta change handlers
      ['caAssetName', 'caAssetIdentifier', 'caAssessmentDate', 'caStatus', 'caNotes'].forEach(id => {
        const el = $('#' + id, panel);
        if (el) el.addEventListener('change', () => {
          this.inputs.conditionAssessmentMeta = readMeta();
          this.saveDraft();
          this.renderHistoryChart(this._currentConditionStandards);
        });
      });

      loadPreviousAssessments();

      this.renderHistoryChart(standards);

      // If answers already exist, show result
      if (Object.keys(this.inputs.conditionAssessment).length > 0) {
        updateResult();
      }
    }

    async renderHistoryChart(standards) {
      if (typeof BondsConditionAssessmentClient === 'undefined' || typeof Chart === 'undefined') return;
      const t = this.locale.texts;
      const assetClass = this.currentAsset;
      const meta = this.inputs.conditionAssessmentMeta || {};
      const identifier = meta.assetIdentifier || '';

      const historyEl = $('#caHistory');
      const emptyEl = $('#caHistoryEmpty');
      const canvas = $('#caHistoryChart');
      if (!historyEl || !canvas) return;

      const res = await BondsConditionAssessmentClient.loadAssessments({ assetClass, limit: 100 });
      if (!res.success || !res.data || res.data.length === 0) {
        historyEl.style.display = 'none';
        return;
      }

      let rows = res.data.filter(a => a.status !== 'archived');
      if (identifier) {
        rows = rows.filter(a => (a.asset_identifier || '').toLowerCase() === identifier.toLowerCase());
      }
      if (rows.length < 2) {
        historyEl.style.display = 'none';
        return;
      }

      rows.sort((a, b) => new Date(a.assessment_date) - new Date(b.assessment_date));
      const labels = rows.map(r => r.assessment_date);
      const scores = rows.map(r => Number(r.score) || 0);
      const confidence = rows.map(r => Number(r.confidence_score) || 0);

      historyEl.style.display = 'block';
      if (emptyEl) emptyEl.style.display = 'none';

      if (this.caHistoryChart) {
        this.caHistoryChart.destroy();
      }

      const ctx = canvas.getContext('2d');
      const isEn = this.lang === 'en';
      this.caHistoryChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: t.conditionScoreResult || 'Condition Score',
              data: scores,
              borderColor: '#d4a853',
              backgroundColor: 'rgba(212,168,83,0.1)',
              fill: true,
              tension: 0.3,
              pointRadius: 4
            },
            {
              label: t.conditionConfidenceResult || 'Confidence',
              data: confidence,
              borderColor: '#3b82f6',
              backgroundColor: 'transparent',
              borderDash: [5, 5],
              tension: 0.3,
              pointRadius: 3,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: '#e8ecf4' } },
            tooltip: {
              callbacks: {
                afterLabel: (ctx) => {
                  const row = rows[ctx.dataIndex];
                  return row.asset_name || '';
                }
              }
            }
          },
          scales: {
            x: {
              ticks: { color: '#94a3b8' },
              grid: { color: 'rgba(255,255,255,0.05)' }
            },
            y: {
              min: 0,
              max: 100,
              ticks: { color: '#94a3b8' },
              grid: { color: 'rgba(255,255,255,0.05)' }
            },
            y1: {
              position: 'right',
              min: 0,
              max: 100,
              ticks: { color: '#94a3b8' },
              grid: { drawOnChartArea: false }
            }
          }
        }
      });
    }

    populateComparisonSelect() {
      const panel = $('#conditionAssessmentPanel');
      const select = panel ? $('#caComparisonSelect', panel) : null;
      if (!select) return;
      const list = this._conditionAssessmentsList || [];
      if (list.length < 2) {
        select.innerHTML = '';
        select.disabled = true;
        return;
      }
      select.disabled = false;
      select.innerHTML = list.map(a => {
        const label = `${a.assessment_date} — ${a.asset_name || a.asset_identifier || a.id} — ${a.grade || ''}`;
        return `<option value="${a.id}">${escapeHtml(label)}</option>`;
      }).join('');
    }

    renderComparison() {
      const panel = $('#conditionAssessmentPanel');
      const select = panel ? $('#caComparisonSelect', panel) : null;
      const tableWrap = panel ? $('#caComparisonTableWrap', panel) : null;
      const chartWrap = panel ? $('#caComparisonChart', panel) : null;
      const comparisonEl = panel ? $('#caComparison', panel) : null;
      if (!select || !tableWrap || !chartWrap || !comparisonEl) return;

      const t = this.locale.texts;
      const selectedIds = Array.from(select.selectedOptions).map(o => o.value);
      if (selectedIds.length < 2) {
        comparisonEl.style.display = 'block';
        tableWrap.innerHTML = `<p class="ca-comparison__empty">${t.conditionCompareEmpty || ''}</p>`;
        if (this.caComparisonChart) { this.caComparisonChart.destroy(); this.caComparisonChart = null; }
        return;
      }

      const list = this._conditionAssessmentsList || [];
      const rows = selectedIds.map(id => list.find(a => a.id === id)).filter(Boolean);
      if (rows.length < 2) return;

      comparisonEl.style.display = 'block';
      const isEn = this.lang === 'en';

      tableWrap.innerHTML = `
        <table class="ca-comparison__table">
          <thead>
            <tr>
              <th>${t.conditionCompareAsset}</th>
              <th>${t.conditionCompareDate}</th>
              <th>${t.conditionCompareScore}</th>
              <th>${t.conditionCompareGrade}</th>
              <th>${t.conditionCompareConfidence}</th>
              <th>${t.conditionCompareCriticalCount}</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(a => `
              <tr>
                <td>${escapeHtml(a.asset_name || a.asset_identifier || a.id)}</td>
                <td>${a.assessment_date}</td>
                <td>${a.score}</td>
                <td>${a.grade || ''}</td>
                <td>${a.confidence_score}%</td>
                <td>${Array.isArray(a.critical_failures) ? a.critical_failures.length : 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      if (this.caComparisonChart) this.caComparisonChart.destroy();
      const ctx = chartWrap.getContext('2d');
      this.caComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: rows.map(a => a.assessment_date),
          datasets: [
            {
              label: t.conditionScoreResult || 'Score',
              data: rows.map(a => Number(a.score) || 0),
              backgroundColor: '#d4a853'
            },
            {
              label: t.conditionConfidenceResult || 'Confidence',
              data: rows.map(a => Number(a.confidence_score) || 0),
              backgroundColor: '#3b82f6'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#e8ecf4' } } },
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { min: 0, max: 100, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
          }
        }
      });
    }

    exportComparisonTable() {
      const t = this.locale.texts;
      const panel = $('#conditionAssessmentPanel');
      const select = panel ? $('#caComparisonSelect', panel) : null;
      if (!select) return;
      const selectedIds = Array.from(select.selectedOptions).map(o => o.value);
      const list = this._conditionAssessmentsList || [];
      const rows = selectedIds.map(id => list.find(a => a.id === id)).filter(Boolean);
      if (rows.length === 0) return;

      const headers = [t.conditionCompareAsset, t.conditionCompareDate, t.conditionCompareScore, t.conditionCompareGrade, t.conditionCompareConfidence, t.conditionCompareCriticalCount];
      const csv = [
        headers.join(','),
        ...rows.map(a => [
          `"${String(a.asset_name || a.asset_identifier || a.id).replace(/"/g, '""')}"`,
          a.assessment_date,
          a.score,
          a.grade || '',
          a.confidence_score,
          Array.isArray(a.critical_failures) ? a.critical_failures.length : 0
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `condition-comparison-${this.currentAsset}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    renderMaintenancePlan() {
      const panel = $('#conditionAssessmentPanel');
      const listEl = panel ? $('#caMaintenanceList', panel) : null;
      const maintenanceEl = panel ? $('#caMaintenance', panel) : null;
      if (!listEl || !maintenanceEl) return;

      const t = this.locale.texts;
      const result = this.inputs.conditionAssessmentResult;
      if (!result) {
        listEl.innerHTML = `<p>${t.conditionMaintenanceGenerate || 'احتسب الدرجة أولاً'}</p>`;
        maintenanceEl.style.display = 'block';
        return;
      }

      const tasks = BondsConditionAssessmentEngine.generateMaintenancePlan(result, { lang: this.lang });
      if (tasks.length === 0) {
        listEl.innerHTML = `<p class="ca-maintenance__empty">${t.conditionMaintenanceEmpty || ''}</p>`;
        maintenanceEl.style.display = 'block';
        return;
      }

      const priorityLabel = {
        high: t.conditionMaintenancePriorityHigh || 'عالية',
        medium: t.conditionMaintenancePriorityMedium || 'متوسطة',
        low: t.conditionMaintenancePriorityLow || 'منخفضة'
      };

      const isEn = this.lang === 'en';
      listEl.innerHTML = tasks.map((task, idx) => {
        const label = task.source === 'critical'
          ? (isEn ? task.labelEn : task.labelAr)
          : (task.category || '');
        const action = isEn ? task.actionEn : task.actionAr;
        return `
          <div class="ca-maintenance__item ca-maintenance__item--${task.priority}">
            <div class="ca-maintenance__header">
              <span class="ca-maintenance__num">#${idx + 1}</span>
              <span class="ca-maintenance__priority">${priorityLabel[task.priority] || task.priority}</span>
            </div>
            <div class="ca-maintenance__body">
              <div><strong>${t.conditionMaintenanceCategory || 'الفئة'}:</strong> ${escapeHtml(label)}</div>
              <div><strong>${t.conditionMaintenanceAction || 'الإجراء'}:</strong> ${escapeHtml(action)}</div>
            </div>
          </div>
        `;
      }).join('');

      maintenanceEl.style.display = 'block';
    }

    async exportConditionAssessmentPDF(panel) {
      if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
        alert('PDF libraries not loaded');
        return;
      }
      const t = this.locale.texts;
      const result = this.inputs.conditionAssessmentResult;
      if (!result) {
        alert(this.lang === 'en' ? 'Calculate the condition score first' : 'احتسب درجة الحالة أولاً');
        return;
      }

      // Temporarily hide action buttons and status from capture
      const toHide = panel.querySelectorAll('.ca-actions, .ca-save-status');
      toHide.forEach(el => el.style.visibility = 'hidden');

      try {
        const canvas = await html2canvas(panel, { scale: 2, useCORS: true, backgroundColor: '#0a0f1a' });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
        const pageWidth = 210;
        const pageHeight = 297;
        const imgWidth = pageWidth;
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        const meta = this.inputs.conditionAssessmentMeta || {};
        const assetName = meta.assetName || this.inputs.assetName || this.currentAsset;
        const dateStr = meta.assessmentDate || new Date().toISOString().split('T')[0];
        const filename = `condition-assessment-${this.currentAsset}-${dateStr}.pdf`;

        // Header text on first page (English only to avoid missing Arabic font)
        pdf.setFontSize(10);
        pdf.setTextColor(180, 180, 180);
        const header = `Condition Assessment Report — ${this.currentAsset} — ${assetName} — ${dateStr}`;
        pdf.text(header, 10, 10);

        pdf.addImage(imgData, 'PNG', 0, 15, imgWidth, imgHeight);
        heightLeft -= (pageHeight - 15);

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight + 15;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(filename);
      } catch (err) {
        console.error('[ValuationUI] PDF export failed:', err);
        alert('PDF export failed: ' + err.message);
      } finally {
        toHide.forEach(el => el.style.visibility = '');
      }
    }

    renderField(def) {
      const valueAttr = def.default !== undefined ? `value="${def.default}"` : '';
      const minAttr = def.min !== undefined ? `min="${def.min}"` : '';
      const maxAttr = def.max !== undefined ? `max="${def.max}"` : '';
      const stepAttr = def.step !== undefined ? `step="${def.step}"` : '';
      const placeholder = def.placeholder ? `placeholder="${def.placeholder}"` : '';
      const hint = def.hint ? `<div class="form-hint">${def.hint}</div>` : '';

      let inputHtml = '';
      if (def.type === 'select') {
        inputHtml = `
          <select name="${def.name}" id="${def.name}">
            ${def.options.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
          </select>
        `;
      } else if (def.type === 'textarea') {
        inputHtml = `<textarea name="${def.name}" id="${def.name}" rows="3" ${placeholder}></textarea>`;
      } else {
        inputHtml = `<input type="${def.type || 'text'}" name="${def.name}" id="${def.name}" ${valueAttr} ${minAttr} ${maxAttr} ${stepAttr} ${placeholder} />`;
      }

      return `
        <div class="form-group ${def.full ? 'form-group--full' : ''}">
          <label for="${def.name}">${def.label}</label>
          ${inputHtml}
          ${hint}
        </div>
      `;
    }

    attachInputListeners() {
      const save = debounce(() => {
        this.collectStepInputs();
        this.saveDraft();
      }, 400);
      $$('input, select, textarea', this.wizardFields).forEach(el => {
        el.addEventListener('input', save);
        el.addEventListener('change', save);
      });
    }

    updateActions() {
      this.btnPrev.disabled = this.currentStep === 0;
      const isLast = this.currentStep === this.locale.steps.length - 1;
      this.btnNext.style.display = isLast ? 'none' : 'inline-flex';
      this.btnSubmit.style.display = isLast ? 'inline-flex' : 'none';
    }

    nextStep() {
      if (this.currentStep >= this.locale.steps.length - 1) return;
      this.collectStepInputs();
      this.currentStep++;
      this.renderStepIndicator();
      this.renderStep();
      this.saveDraft();
    }

    prevStep() {
      if (this.currentStep <= 0) return;
      this.collectStepInputs();
      this.currentStep--;
      this.renderStepIndicator();
      this.renderStep();
      this.saveDraft();
    }

    goToStep(idx) {
      if (idx < 0 || idx >= this.locale.steps.length || idx > this.currentStep) return;
      this.collectStepInputs();
      this.currentStep = idx;
      this.renderStepIndicator();
      this.renderStep();
      this.saveDraft();
    }

    async submit() {
      try {
        this.collectStepInputs();
        await Promise.all([
          this.engine.preloadDepreciationFactors(this.currentAsset),
          this.engine.preloadMarketIntelligence(this.currentAsset, this.inputs)
        ]);
        const valuations = this.engine.calculate(this.currentAsset, this.inputs);
        const scores = this.engine.calculateScores(this.inputs);
        const result = { valuations, scores, assetClass: this.currentAsset, inputs: { ...this.inputs } };
        this.showResults(result);
        this.saveDraft();
        this.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        console.error('[ValuationUI] Submit error:', err);
        alert(this.locale.texts.submitError || 'حدث خطأ أثناء إنشاء التقييم. يرجى التحقق من البيانات المدخلة.');
      }
    }

    showResults(result) {
      this.results.classList.add('is-open');
      const v = result.valuations;
      const s = result.scores;
      const t = this.locale.texts;

      const valueOrder = [
        { key: 'bookValue', label: t.bookValue },
        { key: 'marketValue', label: t.marketValue },
        { key: 'fairValue', label: t.fairValue },
        { key: 'investmentValue', label: t.investmentValue },
        { key: 'liquidationValue', label: t.liquidationValue },
        { key: 'replacementValue', label: t.replacementValue },
        { key: 'insuranceValue', label: t.insuranceValue },
        { key: 'operatingValue', label: t.operatingValue },
        { key: 'quickExitValue', label: t.quickExitValue },
        { key: 'restructuredValue', label: t.restructuredValue }
      ];

      this.valuationCards.innerHTML = valueOrder
        .filter(item => v[item.key] !== undefined)
        .map(item => `
          <div class="valuation-card">
            <div class="valuation-card__label">${item.label}</div>
            <div class="valuation-card__value">${formatCurrency(v[item.key], this.lang)}</div>
          </div>
        `).join('');

      const scoreItems = [
        { key: 'assetQuality', label: t.assetQuality },
        { key: 'marketStrength', label: t.marketStrength },
        { key: 'risk', label: t.risk },
        { key: 'liquidity', label: t.liquidity },
        { key: 'growth', label: t.growth },
        { key: 'management', label: t.management },
        { key: 'brandStrength', label: t.brandStrength },
        { key: 'investmentAttractiveness', label: t.investmentAttractiveness }
      ];

      $('#scoreGrid').innerHTML = scoreItems.map(item => `
        <div class="score-item">
          <div class="score-item__header">
            <span class="score-item__name">${item.label}</span>
            <span class="score-item__value">${s[item.key]}</span>
          </div>
          <div class="score-bar">
            <div class="score-bar__fill" style="width: ${Math.max(0, Math.min(100, s[item.key]))}%"></div>
          </div>
        </div>
      `).join('');

      // Market Intelligence analysis
      const market = v.marketIntelligence;
      const marketSummary = $('#marketSummary');
      const marketCards = $('#marketCards');
      const hasMarket = market && market.averageSellingPrice !== undefined;
      if (marketSummary) marketSummary.style.display = hasMarket ? 'block' : 'none';
      if (marketCards) marketCards.style.display = hasMarket ? 'grid' : 'none';

      if (hasMarket && marketCards) {
        if (marketSummary) {
          const dims = [];
          if (market.country) dims.push(market.country);
          if (market.region) dims.push(market.region);
          if (market.city) dims.push(market.city);
          if (market.sector) dims.push(market.sector);
          const scope = dims.length ? dims.join(' / ') : (t.globalScope || 'عالمي');
          marketSummary.innerHTML = `
            <p><strong>${t.marketIntelligence}:</strong> ${t.marketDataSource}: ${market.source || 'BONDS Market Intelligence'} — ${t.marketScope}: ${scope}</p>
            ${market.notes ? `<p class="market-notes">${market.notes}</p>` : ''}
          `;
        }

        const marketOrder = [
          { key: 'averageSellingPrice', label: t.averageSellingPrice, type: 'currency' },
          { key: 'averageBuyingPrice', label: t.averageBuyingPrice, type: 'currency' },
          { key: 'transactionCount', label: t.transactionCount, type: 'number' },
          { key: 'supplyIndex', label: t.supplyIndex, type: 'number' },
          { key: 'demandIndex', label: t.demandIndex, type: 'number' },
          { key: 'competitorCount', label: t.competitorCount, type: 'number' },
          { key: 'averageSaleSpeedDays', label: t.averageSaleSpeedDays, type: 'number' },
          { key: 'inflationRate', label: t.marketInflationRate, type: 'percent' },
          { key: 'interestRate', label: t.marketInterestRate, type: 'percent' },
          { key: 'economicGrowthRate', label: t.economicGrowthRate, type: 'percent' },
          { key: 'riskScore', label: t.riskScore, type: 'number' },
          { key: 'confidence', label: t.confidence, type: 'percent' },
          { key: 'dataQualityScore', label: t.dataQualityScore, type: 'number' }
        ];

        let cardsHtml = marketOrder
          .filter(item => market[item.key] !== undefined)
          .map(item => {
            const num = Number(market[item.key]) || 0;
            let val;
            if (item.type === 'currency') val = formatCurrency(num, this.lang);
            else if (item.type === 'percent') val = `${(num * 100).toFixed(1)}%`;
            else val = formatCurrency(num, this.lang);
            return `
              <div class="valuation-card">
                <div class="valuation-card__label">${item.label}</div>
                <div class="valuation-card__value">${val}</div>
              </div>
            `;
          }).join('');

        if (market.outlook) {
          const outlookKey = market.outlook === 'positive' ? 'positive'
            : market.outlook === 'negative' ? 'negative' : 'neutral';
          const badgeClass = `market-badge--${outlookKey}`;
          const labelKey = `outlook${outlookKey.charAt(0).toUpperCase() + outlookKey.slice(1)}`;
          cardsHtml += `
            <div class="valuation-card market-badge ${badgeClass}">
              <div class="valuation-card__label">${t.outlook}</div>
              <div class="valuation-card__value">${t[labelKey] || market.outlook}</div>
            </div>
          `;
        }

        marketCards.innerHTML = cardsHtml;

        this._renderMarketTrend(market);
      }

      // Depreciation analysis
      const dep = v;
      const hasDepreciation = dep && dep.totalDepreciation !== undefined;
      const depSummary = $('#deprecationSummary');
      const depCards = $('#deprecationCards');
      if (depSummary) depSummary.style.display = hasDepreciation ? 'block' : 'none';
      if (depCards) depCards.style.display = hasDepreciation ? 'grid' : 'none';

      if (hasDepreciation && depCards) {
        if (depSummary) {
          depSummary.innerHTML = `
            <p><strong>${t.depreciationAnalysis}:</strong> ${t.totalDepreciation} = ${formatCurrency(dep.totalDepreciation, this.lang)}</p>
          `;
        }

        const depOrder = [
          { key: 'accountingDepreciation', label: t.accountingDepreciation },
          { key: 'economicDepreciation', label: t.economicDepreciation },
          { key: 'operationalDepreciation', label: t.operationalDepreciation },
          { key: 'environmentalDepreciation', label: t.environmentalDepreciation },
          { key: 'technicalDepreciation', label: t.technicalDepreciation },
          { key: 'functionalDepreciation', label: t.functionalDepreciation },
          { key: 'maintenanceDepreciation', label: t.maintenanceDepreciation },
          { key: 'misuseDepreciation', label: t.misuseDepreciation },
          { key: 'depreciationCurrentValue', label: t.depreciationCurrentValue },
          { key: 'depreciationFutureValue', label: t.depreciationFutureValue },
          { key: 'depreciationReplacementValue', label: t.depreciationReplacementValue }
        ];

        depCards.innerHTML = depOrder
          .filter(item => dep[item.key] !== undefined)
          .map(item => `
            <div class="valuation-card">
              <div class="valuation-card__label">${item.label}</div>
              <div class="valuation-card__value">${formatCurrency(dep[item.key], this.lang)}</div>
            </div>
          `).join('');

        this._renderDeprecationChart(dep);
      } else {
        const canvas = $('#deprecationChart');
        if (canvas) canvas.style.display = 'none';
      }

      $('#reportText').textContent = this.engine.generateReport(result, this.lang);
    }

    _renderDeprecationChart(dep) {
      const canvas = $('#deprecationChart');
      if (!canvas || typeof Chart === 'undefined') return;
      canvas.style.display = 'block';
      if (container) container.style.display = 'block';
      const ctx = canvas.getContext('2d');

      if (this.deprecationChart) {
        this.deprecationChart.destroy();
      }

      const items = [
        { label: this.locale.texts.accountingDepreciation, value: dep.accountingDepreciation },
        { label: this.locale.texts.economicDepreciation, value: dep.economicDepreciation },
        { label: this.locale.texts.operationalDepreciation, value: dep.operationalDepreciation },
        { label: this.locale.texts.environmentalDepreciation, value: dep.environmentalDepreciation },
        { label: this.locale.texts.technicalDepreciation, value: dep.technicalDepreciation },
        { label: this.locale.texts.functionalDepreciation, value: dep.functionalDepreciation },
        { label: this.locale.texts.maintenanceDepreciation, value: dep.maintenanceDepreciation },
        { label: this.locale.texts.misuseDepreciation, value: dep.misuseDepreciation }
      ].filter(i => i.value > 0);

      const isEn = this.lang === 'en';
      this.deprecationChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: items.map(i => i.label),
          datasets: [{
            label: isEn ? 'Depreciation Amount' : 'مبلغ الاستهلاك',
            data: items.map(i => i.value),
            backgroundColor: 'rgba(212, 168, 83, 0.7)',
            borderColor: 'rgba(212, 168, 83, 1)',
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: this.locale.texts.depreciationAnalysis,
              color: getComputedStyle(document.body).getPropertyValue('--text').trim() || '#e8ecf4'
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#94a3b8' },
              grid: { color: 'rgba(197, 160, 40, 0.1)' }
            },
            x: {
              ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#94a3b8' },
              grid: { display: false }
            }
          }
        }
      });
    }

    async _renderMarketTrend(market) {
      const canvas = $('#marketTrendChart');
      const container = $('#marketTrendContainer');
      if (!canvas || typeof Chart === 'undefined') return;
      if (container) container.style.display = 'none';
      canvas.style.display = 'none';
      if (!market || !market.assetClass) return;

      const client = this.engine._marketIntelligenceClient();
      if (!client || !client.fetchHistory) return;

      const history = await client.fetchHistory(market.assetClass, {
        country: market.country,
        region: market.region,
        city: market.city,
        sector: market.sector,
        limit: 30
      });

      if (!history || history.length < 2) return;

      history.sort((a, b) => new Date(a.updatedAt || a.createdAt || 0) - new Date(b.updatedAt || b.createdAt || 0));
      const labels = history.map((_, i) => `${i + 1}`);
      const prices = history.map(h => h.averageSellingPrice || 0);
      const demand = history.map(h => h.demandIndex || 0);

      canvas.style.display = 'block';
      const ctx = canvas.getContext('2d');
      if (this.marketTrendChart) {
        this.marketTrendChart.destroy();
      }

      const t = this.locale.texts;
      const isEn = this.lang === 'en';
      this.marketTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: t.averageSellingPrice,
              data: prices,
              borderColor: 'rgba(212, 168, 83, 1)',
              backgroundColor: 'rgba(212, 168, 83, 0.1)',
              yAxisID: 'y',
              tension: 0.3,
              fill: true
            },
            {
              label: t.demandIndex,
              data: demand,
              borderColor: 'rgba(74, 222, 128, 1)',
              backgroundColor: 'rgba(74, 222, 128, 0.1)',
              yAxisID: 'y1',
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              labels: { color: getComputedStyle(document.body).getPropertyValue('--text').trim() || '#e8ecf4' }
            },
            title: {
              display: true,
              text: isEn ? 'Market Trend (latest snapshots)' : 'الاتجاه السوقي (آخر اللقطات)',
              color: getComputedStyle(document.body).getPropertyValue('--text').trim() || '#e8ecf4'
            }
          },
          scales: {
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#94a3b8' },
              grid: { color: 'rgba(197, 160, 40, 0.1)' }
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#94a3b8' }
            },
            x: {
              ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#94a3b8' },
              grid: { display: false }
            }
          }
        }
      });
    }

    closeWizard() {
      this.wizard.classList.remove('is-open');
      this.results.classList.remove('is-open');
      this.currentAsset = null;
      this.currentStep = 0;
      this.inputs = {};
    }

    saveDraft() {
      if (!this.currentAsset) return;
      const draft = {
        lang: this.lang,
        assetClass: this.currentAsset,
        step: this.currentStep,
        inputs: this.inputs,
        savedAt: new Date().toISOString()
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      } catch (e) {
        // ignore storage errors
      }
    }

    checkDraft() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (!draft.assetClass || draft.lang !== this.lang) return;
        this.pendingDraft = draft;
        this.restoreText.textContent = (this.locale.texts.restorePrompt || 'لديك مسودة سابقة')
          .replace('{asset}', window.AssetClass.getLabel(draft.assetClass, this.lang));
        this.restoreBanner.classList.add('is-open');
      } catch (e) {
        // ignore
      }
    }

    restoreDraft() {
      const draft = this.pendingDraft;
      if (!draft) return;
      this.currentAsset = draft.assetClass;
      this.currentStep = Math.min(draft.step || 0, this.locale.steps.length - 1);
      this.inputs = { ...draft.inputs, assetClass: this.currentAsset };
      this.model = new window.ValuationModel(this.currentAsset, this.inputs);
      this.restoreBanner.classList.remove('is-open');
      this.wizard.classList.add('is-open');
      this.wizardTitle.textContent = window.AssetClass.getLabel(this.currentAsset, this.lang);
      this.renderStepIndicator();
      this.renderStep();
    }

    discardDraft() {
      this.pendingDraft = null;
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      this.restoreBanner.classList.remove('is-open');
    }
  }

  function initValuationPage(locale) {
    return new ValuationUI(locale);
  }

  window.BondsValuationUI = { init: initValuationPage, ValuationUI };
})();

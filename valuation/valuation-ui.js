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

      this.attachInputListeners();
      this.updateActions();
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
      this.collectStepInputs();
      await this.engine.preloadDepreciationFactors(this.currentAsset);
      const valuations = this.engine.calculate(this.currentAsset, this.inputs);
      const scores = this.engine.calculateScores(this.inputs);
      const result = { valuations, scores, assetClass: this.currentAsset, inputs: { ...this.inputs } };
      this.showResults(result);
      this.saveDraft();
      this.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      }

      $('#reportText').textContent = this.engine.generateReport(result, this.lang);
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

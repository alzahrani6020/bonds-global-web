/**
 * Bonds Calculator Shared Enhancements
 * Adds unified features to any calculator page that exposes window.getCalculatorData()
 */
(function() {
  'use strict';

  var ENHANCEMENT_CSS = `
    .bec-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem; }
    .bec-kpi-card { padding: 1rem; border-radius: 16px; border: 1px solid var(--border, rgba(197,160,40,0.15)); background: rgba(255,255,255,0.03); text-align: center; transition: transform 0.2s ease, box-shadow 0.2s ease; }
    .bec-kpi-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
    .bec-kpi-card--gold { border-color: rgba(212,168,83,0.35); background: rgba(212,168,83,0.08); }
    .bec-kpi-card--green { border-color: rgba(22,163,74,0.35); background: rgba(22,163,74,0.08); }
    .bec-kpi-card--blue { border-color: rgba(59,130,246,0.35); background: rgba(59,130,246,0.08); }
    .bec-kpi-card--purple { border-color: rgba(168,85,247,0.35); background: rgba(168,85,247,0.08); }
    .bec-kpi-card--red { border-color: rgba(220,38,38,0.35); background: rgba(220,38,38,0.08); }
    .bec-kpi-card__label { font-size: 0.8rem; color: var(--text-secondary, #94a3b8); margin-bottom: 0.4rem; }
    .bec-kpi-card__value { font-size: 1.35rem; font-weight: 800; color: var(--text, #e8ecf4); line-height: 1.2; }
    .bec-kpi-card__unit { font-size: 0.75rem; color: var(--text-secondary, #94a3b8); margin-top: 0.2rem; }
    .bec-smart-alerts { display: flex; flex-direction: column; gap: 0.6rem; }
    .bec-smart-alert { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.85rem 1rem; border-radius: 12px; border: 1px solid var(--border, rgba(197,160,40,0.15)); background: rgba(255,255,255,0.03); }
    .bec-smart-alert--danger { border-color: rgba(220,38,38,0.4); background: rgba(220,38,38,0.08); }
    .bec-smart-alert--warning { border-color: rgba(245,158,11,0.4); background: rgba(245,158,11,0.08); }
    .bec-smart-alert--success { border-color: rgba(22,163,74,0.4); background: rgba(22,163,74,0.08); }
    .bec-smart-alert__icon { font-size: 1.25rem; line-height: 1; }
    .bec-smart-alert__title { font-weight: 700; margin-bottom: 0.15rem; color: var(--text, #e8ecf4); }
    .bec-smart-alert__text { font-size: 0.9rem; color: var(--text-secondary, #94a3b8); }
    .bec-share-bar { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin-top: 1rem; }
    .bec-modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 9999; align-items: center; justify-content: center; padding: 1rem; overflow: auto; }
    .bec-modal-content { background: var(--bg-card, rgba(16,24,45,0.6)); border: 1px solid var(--border, rgba(197,160,40,0.15)); border-radius: 24px; max-width: 800px; width: 100%; padding: 1.5rem; box-shadow: 0 25px 80px rgba(0,0,0,0.5); }
    .bec-ai-result { max-height: 400px; overflow-y: auto; line-height: 1.8; }
    .bec-ai-result h4 { color: var(--gold, #d4a853); margin: 1rem 0 0.5rem; }
    .bec-ai-result ul { padding-right: 1.25rem; }
    .bec-ai-result li { margin-bottom: 0.35rem; }
    .bec-loading { color: var(--text-secondary, #94a3b8); font-style: italic; }
  `;

  function addStyles() {
    if (document.getElementById('bec-shared-styles')) return;
    var style = document.createElement('style');
    style.id = 'bec-shared-styles';
    style.textContent = ENHANCEMENT_CSS;
    document.head.appendChild(style);
  }

  function formatCurrency(n) {
    if (typeof window.formatCurrency === 'function') return window.formatCurrency(n);
    if (typeof window.formatNumberAR === 'function') return window.formatNumberAR(n) + ' ' + (window.getCurrencySymbol ? window.getCurrencySymbol() : '');
    return Number(n || 0).toLocaleString('ar-SA');
  }

  function formatNumber(n) {
    if (typeof window.formatNumberAR === 'function') return window.formatNumberAR(n);
    return Number(n || 0).toLocaleString('ar-SA');
  }

  function isRTL() {
    return document.documentElement.getAttribute('dir') === 'rtl';
  }

  function getLang() {
    return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'ar';
  }

  var T = {
    ar: {
      kpi: 'المؤشرات الرئيسية',
      alerts: 'الإنذارات الذكية',
      exportSheets: 'Google Sheets',
      shareImage: 'صورة للمشاركة',
      aiAdvisor: 'مستشار بوندز الذكي',
      aiBtn: 'استشر المستشار الذكي',
      scenarios: 'السيناريوهات المحفوظة',
      saveScenario: 'حفظ السيناريو',
      print: 'طباعة / PDF',
      close: 'إغلاق',
      download: 'تحميل الصورة',
      share: 'مشاركة',
      loading: 'جاري التحليل...',
      noData: 'لا توجد بيانات كافية لإظهار المؤشرات.',
      balanced: 'النموذج المالي يبدو متوازناً.',
      negativeCash: 'الرصيد النقدي سالب في أحد الأشهر — راجع التدفقات.',
      lowMargin: 'هامش الربح ضيق — راجع التكاليف.',
      highFixed: 'التكاليف الثابتة مرتفعة مقارنة بالإيرادات.'
    },
    en: {
      kpi: 'Key Metrics',
      alerts: 'Smart Alerts',
      exportSheets: 'Google Sheets',
      shareImage: 'Share Image',
      aiAdvisor: 'Bonds AI Advisor',
      aiBtn: 'Ask AI Advisor',
      scenarios: 'Saved Scenarios',
      saveScenario: 'Save Scenario',
      print: 'Print / PDF',
      close: 'Close',
      download: 'Download Image',
      share: 'Share',
      loading: 'Analyzing...',
      noData: 'Not enough data to display metrics.',
      balanced: 'The financial model looks balanced.',
      negativeCash: 'Cash balance is negative in some months — review cash flows.',
      lowMargin: 'Profit margin is narrow — review costs.',
      highFixed: 'Fixed costs are high relative to revenue.'
    }
  };

  function t(key) {
    return T[getLang()][key] || T.ar[key];
  }

  // ===== KPI Cards =====
  function initKpiCards(containerSelector, kpiDefinitions) {
    var container = document.querySelector(containerSelector);
    if (!container) return;
    if (document.getElementById('becKpiCards')) return;

    var kpiHTML = '<div id="becKpiCards" class="bec-kpi-grid" style="display:none;margin-bottom:1.5rem;">';
    kpiDefinitions.forEach(function(def, idx) {
      var colors = ['gold', 'green', 'blue', 'purple', 'red', 'orange'];
      var color = def.color || colors[idx % colors.length];
      kpiHTML += '<div class="bec-kpi-card bec-kpi-card--' + color + '">' +
        '<div class="bec-kpi-card__label">' + def.label + '</div>' +
        '<div id="' + def.id + '" class="bec-kpi-card__value">—</div>' +
        (def.unit ? '<div class="bec-kpi-card__unit">' + def.unit + '</div>' : '') +
        '</div>';
    });
    kpiHTML += '</div>';

    var wrapper = document.createElement('div');
    wrapper.innerHTML = kpiHTML;
    container.insertBefore(wrapper.firstElementChild, container.firstElementChild);
  }

  function updateKpiCards(values) {
    var grid = document.getElementById('becKpiCards');
    if (!grid) return;
    grid.style.display = 'grid';
    Object.keys(values).forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.textContent = values[id].text;
        if (values[id].color) el.style.color = values[id].color;
      }
    });
  }

  // ===== Smart Alerts =====
  function initSmartAlerts(containerSelector) {
    var container = document.querySelector(containerSelector);
    if (!container) return;
    if (document.getElementById('becSmartAlerts')) return;

    var section = document.createElement('div');
    section.id = 'becSmartAlertsSection';
    section.className = 'reveal calc-mt-12';
    section.innerHTML = '<div class="calc-panel">' +
      '<h2 class="calc-section-title">' + t('alerts') + '</h2>' +
      '<div id="becSmartAlerts" class="bec-smart-alerts"></div>' +
      '<button onclick="window.BondsEnhancements.refreshAlerts()" class="btn btn-outline calc-btn-sm" style="margin-top:0.75rem;">' + t('alerts') + '</button>' +
      '</div>';
    container.appendChild(section);
  }

  function generateSmartAlerts(data) {
    var alerts = [];
    var lang = getLang();
    var isAr = lang === 'ar';

    if (data.minBalance !== undefined && data.minBalance < 0) {
      alerts.push({ type: 'danger', icon: '🚨', title: isAr ? 'رصيد نقدي سالب' : 'Negative Cash Balance', text: t('negativeCash') });
    }
    if (data.netFlow !== undefined && data.netFlow < 0) {
      alerts.push({ type: 'danger', icon: '⚠️', title: isAr ? 'صافي التدفق السنوي سالب' : 'Negative Annual Net Cash Flow', text: isAr ? 'المصروفات تتجاوز الواردات خلال العام.' : 'Expenses exceed inflows during the year.' });
    }
    if (data.profitMargin !== undefined && data.profitMargin > 0 && data.profitMargin < 15) {
      alerts.push({ type: 'warning', icon: '📉', title: isAr ? 'هامش ربح ضيق' : 'Narrow Profit Margin', text: t('lowMargin') });
    }
    if (data.fixedCosts !== undefined && data.revenue > 0 && data.fixedCosts / data.revenue > 0.5) {
      alerts.push({ type: 'warning', icon: '🏭', title: isAr ? 'تكاليف ثابتة مرتفعة' : 'High Fixed Costs', text: t('highFixed') });
    }

    // Creditworthiness alerts
    if (data.totalScore !== undefined) {
      if (data.totalScore < 40) {
        alerts.push({ type: 'danger', icon: '🔴', title: isAr ? 'تصنيف ائتماني ضعيف جداً' : 'Very Weak Credit Rating', text: isAr ? 'الدرجة الإجمالية أقل من 40؛ المشروع/الشركة يُصنف عالي المخاطر.' : 'Total score below 40; the project/company is classified as high risk.' });
      } else if (data.totalScore < 60) {
        alerts.push({ type: 'warning', icon: '🟡', title: isAr ? 'تصنيف ائتماني ضعيف' : 'Weak Credit Rating', text: isAr ? 'الدرجة بين 40 و 60؛ جودة ائتمانية ضعيفة وتحتاج تحسين.' : 'Score between 40 and 60; credit quality is weak and needs improvement.' });
      } else if (data.totalScore < 70) {
        alerts.push({ type: 'warning', icon: '🟠', title: isAr ? 'جودة ائتمانية مقبولة' : 'Adequate Credit Quality', text: isAr ? 'الدرجة بين 60 و 70؛ جودة ائتمانية مقبولة لكنها ليست ممتازة.' : 'Score between 60 and 70; credit quality is adequate but not strong.' });
      }
    }
    if (data.debtRatio !== undefined && data.debtRatio > 0.6) {
      alerts.push({ type: 'warning', icon: '📉', title: isAr ? 'المديونية مرتفعة' : 'High Debt Level', text: isAr ? 'نسبة الديون تتجاوز 60% من إجمالي الأصول.' : 'Debt ratio exceeds 60% of total assets.' });
    }
    if (data.currentRatio !== undefined && data.currentRatio < 1) {
      alerts.push({ type: 'danger', icon: '⚠️', title: isAr ? 'سيولة ضعيفة' : 'Weak Liquidity', text: isAr ? 'الأصول المتداولة لا تغطي الالتزامات المتداولة.' : 'Current assets do not cover current liabilities.' });
    }
    if (data.interestCoverage !== undefined && data.interestCoverage < 2 && data.interestCoverage >= 0) {
      alerts.push({ type: 'warning', icon: '🔥', title: isAr ? 'تغطية الفوائد ضعيفة' : 'Weak Interest Coverage', text: isAr ? 'أرباح التشغيل لا تكفي لتغطية مصاريف الفوائد بأمان.' : 'Operating profit is insufficient to safely cover interest expense.' });
    }
    if (data.dscr !== undefined && data.dscr < 1) {
      alerts.push({ type: 'danger', icon: '🚨', title: isAr ? 'تغطية خدمة الدين أقل من 1' : 'DSCR Below 1', text: isAr ? 'التدفق النقدي التشغيلي أقل من أقساط الديون السنوية.' : 'Operating cash flow is below annual debt service.' });
    }
    if (data.collateralCoverage !== undefined && data.collateralCoverage < 0.8) {
      alerts.push({ type: 'warning', icon: '🔒', title: isAr ? 'الضمانات غير كافية' : 'Insufficient Collateral', text: isAr ? 'قيمة الضمانات تغطي أقل من 80% من مبلغ التمويل المطلوب.' : 'Collateral covers less than 80% of requested financing.' });
    }

    if (alerts.length === 0) {
      if (data.totalScore !== undefined && data.totalScore >= 70) {
        alerts.push({ type: 'success', icon: '✅', title: isAr ? 'جودة ائتمانية جيدة' : 'Good Credit Quality', text: isAr ? 'التصنيف الائتماني قوي والمؤشرات الرئيسية في مستويات آمنة.' : 'Credit rating is strong and key indicators are at safe levels.' });
      } else {
        alerts.push({ type: 'success', icon: '✅', title: isAr ? 'النموذج المالي متوازن' : 'Balanced Financial Model', text: t('balanced') });
      }
    }
    return alerts;
  }

  function updateSmartAlerts(data) {
    var container = document.getElementById('becSmartAlerts');
    if (!container) return;
    var alerts = generateSmartAlerts(data);
    container.innerHTML = alerts.map(function(a) {
      return '<div class="bec-smart-alert bec-smart-alert--' + a.type + '">' +
        '<div class="bec-smart-alert__icon">' + a.icon + '</div>' +
        '<div><div class="bec-smart-alert__title">' + a.title + '</div>' +
        '<div class="bec-smart-alert__text">' + a.text + '</div></div></div>';
    }).join('');
  }

  // ===== Export Buttons =====
  function addExportButtons(containerSelector) {
    var container = document.querySelector(containerSelector);
    if (!container) return;
    if (container.querySelector('.bec-export-sheets')) return;

    var sheetsBtn = document.createElement('button');
    sheetsBtn.className = 'btn btn-outline calc-btn-sm bec-export-sheets';
    sheetsBtn.textContent = '📋 ' + t('exportSheets');
    sheetsBtn.onclick = window.BondsEnhancements.copyCsvAndOpenSheets;
    container.appendChild(sheetsBtn);

    var shareBtn = document.createElement('button');
    shareBtn.className = 'btn btn-outline calc-btn-sm bec-share-image-btn';
    shareBtn.textContent = '🖼️ ' + t('shareImage');
    shareBtn.onclick = window.BondsEnhancements.generateShareCard;
    container.appendChild(shareBtn);
  }

  function copyCsvAndOpenSheets() {
    var data = window.getCalculatorData ? window.getCalculatorData() : null;
    if (!data || !data.csvRows) {
      alert('لا توجد بيانات للتصدير.');
      return;
    }
    var csv = data.csvRows.map(function(row) { return row.join('\t'); }).join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(csv).then(function() {
        alert('✓ تم نسخ البيانات. سيتم فتح Google Sheets الآن.');
        window.open('https://sheets.new', '_blank');
      }).catch(function() {
        window.open('https://sheets.new', '_blank');
      });
    } else {
      window.open('https://sheets.new', '_blank');
    }
  }

  // ===== Share Card =====
  function initShareCardModal() {
    if (document.getElementById('becShareCardModal')) return;
    var modal = document.createElement('div');
    modal.id = 'becShareCardModal';
    modal.className = 'bec-modal-overlay';
    modal.setAttribute('onclick', 'if(event.target===this)window.BondsEnhancements.closeShareCardModal()');
    modal.innerHTML = '<div class="bec-modal-content" style="max-width:420px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">' +
      '<h3 style="margin:0;color:var(--gold);font-size:1.15rem;">' + t('shareImage') + '</h3>' +
      '<button onclick="window.BondsEnhancements.closeShareCardModal()" class="btn btn-outline btn-sm" style="padding:0.25rem 0.6rem;">×</button>' +
      '</div>' +
      '<div style="border-radius:12px;overflow:hidden;background:#0a0f1a;">' +
      '<canvas id="becShareCardCanvas" width="800" height="1000" style="width:100%;height:auto;display:block;"></canvas>' +
      '</div>' +
      '<div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap;">' +
      '<button onclick="window.BondsEnhancements.downloadShareCard()" class="btn btn-primary btn-sm" style="flex:1;">' + t('download') + '</button>' +
      '<button onclick="window.BondsEnhancements.shareShareCard()" class="btn btn-outline btn-sm" style="flex:1;">' + t('share') + '</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(modal);
  }

  function generateShareCard() {
    var data = window.getCalculatorData ? window.getCalculatorData() : null;
    if (!data || !data.kpis) {
      alert('لا توجد بيانات لإنشاء الصورة.');
      return;
    }
    var canvas = document.getElementById('becShareCardCanvas');
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0a0f1a');
    grad.addColorStop(1, '#10182d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#d4a853';
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, w - 24, h - 24);

    ctx.fillStyle = '#d4a853';
    ctx.font = 'bold 42px Vazirmatn, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BONDS', w / 2, 80);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px Vazirmatn, Arial';
    ctx.fillText(document.title.split('|')[0].trim(), w / 2, 120);

    var y = 190;
    data.kpis.forEach(function(kpi) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(50, y - 32, w - 100, 54);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '20px Vazirmatn, Arial';
      ctx.textAlign = isRTL() ? 'right' : 'left';
      var labelX = isRTL() ? w - 70 : 70;
      ctx.fillText(kpi.label, labelX, y);
      ctx.fillStyle = kpi.color || '#e8ecf4';
      ctx.font = 'bold 24px Vazirmatn, Arial';
      ctx.textAlign = isRTL() ? 'left' : 'right';
      var valueX = isRTL() ? 70 : w - 70;
      ctx.fillText(kpi.value, valueX, y);
      y += 70;
    });

    ctx.fillStyle = '#d4a853';
    ctx.font = '22px Vazirmatn, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('bonds-global.com', w / 2, y + 20);

    document.getElementById('becShareCardModal').style.display = 'flex';
  }

  function closeShareCardModal() {
    document.getElementById('becShareCardModal').style.display = 'none';
  }

  function downloadShareCard() {
    var canvas = document.getElementById('becShareCardCanvas');
    var link = document.createElement('a');
    link.download = 'bonds-summary.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function shareShareCard() {
    var canvas = document.getElementById('becShareCardCanvas');
    canvas.toBlob(function(blob) {
      var file = new File([blob], 'bonds-summary.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Bonds Summary', text: 'Check out this Bonds analysis' });
      } else {
        downloadShareCard();
      }
    });
  }

  // ===== AI Advisor =====
  function initAiAdvisor(containerSelector) {
    var container = document.querySelector(containerSelector);
    if (!container) return;
    if (document.getElementById('becAiAdvisorSection')) return;

    var section = document.createElement('div');
    section.id = 'becAiAdvisorSection';
    section.className = 'reveal calc-mt-12';
    section.innerHTML = '<div class="calc-panel">' +
      '<h2 class="calc-section-title">🤖 ' + t('aiAdvisor') + '</h2>' +
      '<button onclick="window.BondsEnhancements.askAiAdvisor()" id="becAiAdvisorBtn" class="btn btn-primary" style="margin-top:0.75rem;">' + t('aiBtn') + '</button>' +
      '<div id="becAiAdvisorResult" style="margin-top:1rem;"></div>' +
      '</div>';
    container.appendChild(section);
  }

  function askAiAdvisor() {
    var btn = document.getElementById('becAiAdvisorBtn');
    var resultBox = document.getElementById('becAiAdvisorResult');
    var data = window.getCalculatorData ? window.getCalculatorData() : null;
    if (!data) {
      resultBox.innerHTML = '<p class="calc-hint">لا توجد بيانات.</p>';
      return;
    }

    if (window.BondsAuth && window.BondsAuth.requireAuth) {
      window.BondsAuth.requireAuth(window.location.href);
      return;
    }

    btn.textContent = t('loading');
    btn.disabled = true;
    resultBox.innerHTML = '<p class="bec-loading">' + t('loading') + '</p>';

    var payload = Object.assign({
      country: data.country || 'SA',
      currency: window.getCurrencySymbol ? window.getCurrencySymbol() : (getLang() === 'en' ? 'SAR' : 'ريال')
    }, data.aiPayload || data.inputs || {});

    fetch('/api/v3/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ type: data.aiType || 'financial_analysis', payload: payload })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      btn.textContent = t('aiBtn');
      btn.disabled = false;
      if (data.error) {
        resultBox.innerHTML = '<p class="calc-hint">' + (data.error.message || data.error) + '</p>';
        return;
      }
      var html = data.analysis || data.report || data.advice || JSON.stringify(data, null, 2);
      resultBox.innerHTML = '<div class="bec-ai-result">' + html.replace(/\n/g, '<br>') + '</div>';
    })
    .catch(function(err) {
      btn.textContent = t('aiBtn');
      btn.disabled = false;
      resultBox.innerHTML = '<p class="calc-hint">حدث خطأ: ' + err.message + '</p>';
    });
  }

  // ===== Scenario Manager =====
  function initScenarioManager(containerSelector, calcType) {
    var container = document.querySelector(containerSelector);
    if (!container) return;
    if (document.getElementById('becScenarioSection')) return;

    var key = 'bonds_' + (calcType || 'generic') + '_scenarios';
    window.BEC_SCENARIO_KEY = key;

    var section = document.createElement('div');
    section.id = 'becScenarioSection';
    section.className = 'reveal calc-mt-12';
    section.innerHTML = '<div class="calc-panel">' +
      '<h2 class="calc-section-title">💾 ' + t('scenarios') + '</h2>' +
      '<div style="display:flex;gap:0.5rem;margin:0.75rem 0;flex-wrap:wrap;">' +
      '<input type="text" id="becScenarioName" class="bonds-input" placeholder="' + (getLang() === 'en' ? 'Scenario name' : 'اسم السيناريو') + '" style="flex:1;min-width:160px;" />' +
      '<button onclick="window.BondsEnhancements.saveScenario()" class="btn btn-primary calc-btn-sm">' + t('saveScenario') + '</button>' +
      '</div>' +
      '<div id="becScenarioList"></div>' +
      '</div>';
    container.appendChild(section);
    renderScenarios();
  }

  function getScenarios() {
    try {
      return JSON.parse(localStorage.getItem(window.BEC_SCENARIO_KEY) || '[]');
    } catch (e) { return []; }
  }

  function setScenarios(list) {
    localStorage.setItem(window.BEC_SCENARIO_KEY, JSON.stringify(list.slice(0, 20)));
  }

  function saveScenario() {
    var nameInput = document.getElementById('becScenarioName');
    var name = (nameInput.value || '').trim();
    if (!name) {
      var now = new Date().toLocaleString(getLang() === 'en' ? 'en-US' : 'ar-SA', { hour: '2-digit', minute: '2-digit' });
      name = (getLang() === 'en' ? 'Scenario ' : 'سيناريو ') + now;
    }
    var data = window.getCalculatorData ? window.getCalculatorData() : null;
    if (!data) return;

    var scenarios = getScenarios();
    scenarios.unshift({ id: 'sc_' + Date.now(), name: name, date: new Date().toISOString(), data: data });
    setScenarios(scenarios);
    nameInput.value = '';
    renderScenarios();
  }

  function deleteScenario(id) {
    var scenarios = getScenarios().filter(function(s) { return s.id !== id; });
    setScenarios(scenarios);
    renderScenarios();
  }

  function loadScenario(id) {
    var scenario = getScenarios().find(function(s) { return s.id === id; });
    if (!scenario || !window.loadCalculatorData) return;
    window.loadCalculatorData(scenario.data);
  }

  function renderScenarios() {
    var container = document.getElementById('becScenarioList');
    if (!container) return;
    var scenarios = getScenarios();
    if (scenarios.length === 0) {
      container.innerHTML = '<p class="calc-hint">' + (getLang() === 'en' ? 'No saved scenarios.' : 'لا توجد سيناريوهات محفوظة.') + '</p>';
      return;
    }
    container.innerHTML = scenarios.map(function(s) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem 0.8rem;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;margin-bottom:0.5rem;">' +
        '<span style="font-weight:600;">' + s.name + '</span>' +
        '<div style="display:flex;gap:0.4rem;">' +
        '<button onclick="window.BondsEnhancements.loadScenario(\'' + s.id + '\')" class="btn btn-outline calc-btn-sm">' + (getLang() === 'en' ? 'Load' : 'تحميل') + '</button>' +
        '<button onclick="window.BondsEnhancements.deleteScenario(\'' + s.id + '\')" class="btn btn-outline calc-btn-sm" style="color:#dc2626">×</button>' +
        '</div></div>';
    }).join('');
  }

  // ===== Public API =====
  window.BondsEnhancements = {
    init: function(config) {
      config = config || {};
      addStyles();
      if (config.kpiContainer && config.kpis) initKpiCards(config.kpiContainer, config.kpis);
      if (config.alertsContainer) initSmartAlerts(config.alertsContainer);
      if (config.exportContainer) addExportButtons(config.exportContainer);
      initShareCardModal();
      if (config.aiContainer) initAiAdvisor(config.aiContainer);
      if (config.scenarioContainer) initScenarioManager(config.scenarioContainer, config.calcType);
    },
    updateKpiCards: updateKpiCards,
    updateSmartAlerts: updateSmartAlerts,
    copyCsvAndOpenSheets: copyCsvAndOpenSheets,
    generateShareCard: generateShareCard,
    closeShareCardModal: closeShareCardModal,
    downloadShareCard: downloadShareCard,
    shareShareCard: shareShareCard,
    askAiAdvisor: askAiAdvisor,
    saveScenario: saveScenario,
    loadScenario: loadScenario,
    deleteScenario: deleteScenario,
    refreshAlerts: function() {
      var data = window.getCalculatorData ? window.getCalculatorData() : {};
      updateSmartAlerts(data);
    }
  };
})();

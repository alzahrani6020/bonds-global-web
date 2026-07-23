#!/usr/bin/env python3
"""Apply Arabic calculator UX/auth/tracking pattern to English mirror files."""
import re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def read(p):
    with open(p, 'r', encoding='utf-8') as f:
        return f.read()

def write(p, c):
    with open(p, 'w', encoding='utf-8') as f:
        f.write(c)

def rel(*parts):
    return os.path.join(ROOT, *parts)

TRACKING_TPL_2 = """function calculateAll() {
  if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {
    window.BondsAnalytics.trackEvent('calc_completed', { source: '%(source)s', country: document.getElementById('country')?.value || 'SA' });
  }
  window._calcCompleted = true;"""

TRACKING_TPL_4 = """    function calculateAll() {
      if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {
        window.BondsAnalytics.trackEvent('calc_completed', { source: '%(source)s', country: document.getElementById('country')?.value || 'SA' });
      }
      window._calcCompleted = true;"""

TRACKING_ROI = """    function calculateROI() {
      if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {
        window.BondsAnalytics.trackEvent('calc_completed', { source: 'roi', country: 'SA' });
      }
      window._calcCompleted = true;"""

UX_SCRIPTS = """<script src="/api/env"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
<script src="/bonds-auth-2026.js?v=3.0.6"></script>
<script src="../../calculators/shared-analytics.js"></script>
<script src="../../calculators/auth-modal.js"></script>
<script src="../../calculators/exit-intent.js"></script>"""

UX_SCRIPTS_NO_AUTH = """<script src="../../calculators/shared-analytics.js"></script>
<script src="../../calculators/auth-modal.js"></script>
<script src="../../calculators/exit-intent.js"></script>"""


def make_block(source, draft_key, draft_ids, save_fn, convert_fn, pending_map, restore_draft=None):
    ids = ','.join("'" + i + "'" for i in draft_ids)
    restore = restore_draft or f"""(function restoreDraft() {{
      try {{
        var raw = sessionStorage.getItem('bonds_{draft_key}_draft');
        if (!raw) return;
        var draft = JSON.parse(raw);
        Object.keys(draft).forEach(function(id) {{
          var el = document.getElementById(id);
          if (el && draft[id] !== undefined && draft[id] !== '') {{
            el.value = draft[id];
          }}
        }});
        sessionStorage.removeItem('bonds_{draft_key}_draft');
        if (typeof calculateAll === 'function') calculateAll();
      }} catch (e) {{}}
    }})();"""
    return f"""<script>
(function () {{
  function storeCurrentInputs() {{
    try {{
      var payload = {{}};
      [{ids}].forEach(function(id) {{
        var el = document.getElementById(id);
        payload[id] = el ? el.value : '';
      }});
      sessionStorage.setItem('bonds_{draft_key}_draft', JSON.stringify(payload));
    }} catch (e) {{}}
  }}

  window.checkAuthForAction = async function(action, onAllowed) {{
    storeCurrentInputs();
    if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {{
      window.BondsAnalytics.trackEvent('calc_action_clicked', {{ action: action, source: '{source}', country: document.getElementById('country')?.value || 'SA' }});
    }}
    const {{ data: userData }} = await window.BondsAuth.getUser();
    if (userData?.user) {{
      if (onAllowed) onAllowed();
      return true;
    }}
    sessionStorage.setItem('auth_redirect', window.location.pathname + window.location.search);
    sessionStorage.setItem('bonds_pending_action', JSON.stringify({{ source: window.location.pathname, action: action }}));
    if (typeof showAuthModal === 'function') {{
      showAuthModal(action, function() {{
        if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {{
          window.BondsAnalytics.trackEvent('calc_signup_prompt_confirmed', {{ action: action, source: '{source}' }});
        }}
        window.location.href = '/calculators/auth/index.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
      }}, function() {{
        if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {{
          window.BondsAnalytics.trackEvent('calc_guest_continued', {{ action: action, source: '{source}' }});
        }}
      }});
    }} else {{
      window.location.href = '/calculators/auth/index.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    }}
    return false;
  }};

  {save_fn}

  {convert_fn}

  (function trackFirstInteraction() {{
    var tracked = false;
    function once() {{
      if (tracked) return;
      tracked = true;
      if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {{
        window.BondsAnalytics.trackEvent('calc_started', {{ source: '{source}', country: document.getElementById('country')?.value || 'SA' }});
      }}
    }}
    document.querySelectorAll('input, select').forEach(function(el) {{
      el.addEventListener('input', once);
      el.addEventListener('change', once);
    }});
  }})();

  {restore}

  (function handlePendingAction() {{
    if (typeof window === 'undefined' || !window.BondsAuth) return;
    window.BondsAuth.getUser().then(function(userData) {{
      if (!userData?.user) return;
      try {{
        var pendingRaw = sessionStorage.getItem('bonds_pending_action');
        if (!pendingRaw) return;
        var pending = JSON.parse(pendingRaw);
        if (pending.source !== window.location.pathname) return;
        sessionStorage.removeItem('bonds_pending_action');
        {pending_map}
      }} catch (e) {{}}
    }});
  }})();
}})();
</script>"""


# ---------- FEASIBILITY ----------
def edit_feasibility():
    p = rel('en', 'calculators', 'feasibility.html')
    c = read(p)
    c = c.replace('<script src="/calculators/auth-gate.js?v=2"></script>\n    <script src="/auth-guard.js"></script>',
                  '    <script src="/auth-guard.js"></script>')
    c = c.replace('function calculateAll() {', TRACKING_TPL_2 % {'source': 'feasibility'}, 1)
    c = c.replace('''    <div style="text-align:center;margin-top:var(--space-6);display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
      <button class="bonds-btn bonds-btn-secondary" onclick="showTab(\'setup\'); BondsUI.toast(\'🔄 Try new numbers\', \'info\');">🔄 Try New Numbers</button>
      <button class="bonds-btn bonds-btn-primary" onclick="exportExcelFeas()">📊 Excel</button>
      <button class="bonds-btn bonds-btn-primary" onclick="exportPDFFeas()">📄 PDF</button>
    </div>''',
                  '''    <div style="text-align:center;margin-top:var(--space-6);display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
      <button class="bonds-btn bonds-btn-secondary" onclick="showTab(\'setup\'); BondsUI.toast(\'🔄 Try new numbers\', \'info\');">🔄 Try New Numbers</button>
      <button class="bonds-btn bonds-btn-primary" onclick="checkAuthForAction(\'save\', saveFeasibilityProject)">💾 Save</button>
      <button class="bonds-btn bonds-btn-primary" onclick="checkAuthForAction(\'excel\', exportExcelFeas)">📊 Excel</button>
      <button class="bonds-btn bonds-btn-primary" onclick="checkAuthForAction(\'pdf\', exportPDFFeas)">📄 PDF</button>
      <button class="bonds-btn bonds-btn-primary" onclick="checkAuthForAction(\'v3\', convertToV3Project)">🚀 Open in V3</button>
    </div>''')
    c = c.replace('''<script src="../../calculators/usage-guard.js"></script>
  <script src="../../page-tracker-v2.js"></script>
<script src="../../site-layout.js?v=3.0.7"></script>''',
                  '''<script src="../../calculators/usage-guard.js"></script>
  <script src="../../page-tracker-v2.js"></script>
''' + UX_SCRIPTS_NO_AUTH + '''
<script src="../../site-layout.js?v=3.0.7"></script>''')

    save_fn = '''window.saveFeasibilityProject = function() {
    try {
      if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {
        window.BondsAnalytics.trackEvent('calc_project_saved', { source: 'feasibility', country: document.getElementById('country')?.value || 'SA' });
      }
      var last = window._feasResult || {};
      var title = last.verdict === 'loss' ? 'Restaurant Feasibility (Loss)' : 'Restaurant Feasibility Study';
      var summary = 'Monthly profit ' + (last.monthlyProfit !== undefined ? last.monthlyProfit.toLocaleString('en-US') + ' SAR' : '—') + ' · Payback ' + (last.roiMonths && isFinite(last.roiMonths) ? Math.ceil(last.roiMonths) + ' months' : '—');
      var projects = JSON.parse(localStorage.getItem('bonds_guest_projects') || '[]');
      projects.unshift({ title: title, summary: summary, href: window.location.pathname + window.location.search, createdAt: new Date().toISOString(), source: 'feasibility' });
      localStorage.setItem('bonds_guest_projects', JSON.stringify(projects.slice(0, 20)));
      BondsUI.toast('Project saved to your space', 'success');
    } catch (e) {
      BondsUI.toast('Could not save locally', 'warning');
    }
  };'''
    convert_fn = '''window.convertToV3Project = async function() {
    try {
      BondsUI.toast('Creating V3 project...', 'info');
      var last = window._feasResult || {};
      var payload = {
        name: 'Restaurant Feasibility Study',
        sector: 'Restaurant / Food & Beverage',
        activity: 'Restaurant',
        cityCode: null,
        currency: 'SAR',
        capital: last.setupTotal || 0,
        revenue: last.yearlyRevenue || 0,
        annualProfit: last.yearlyProfit || 0,
        language: 'en'
      };
      const { data: sessionData } = await window.BondsAuth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch('/api/v3/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { BondsUI.toast('⚠️ ' + (json.error || 'Failed to create project'), 'error'); return; }
      if (json.project?.id) window.location.href = '/v3/project?id=' + encodeURIComponent(json.project.id);
      else BondsUI.toast('Project link not received', 'error');
    } catch (e) {
      BondsUI.toast('Failed to connect to V3 project', 'error');
    }
  };'''
    block = make_block('feasibility', 'feasibility',
                       ['country','sLicense','sFurniture','sEquipment','sMarketing','sSafety','sOther','mRent','mSalaries','mUtilities','mGasNet','mAds','mMisc','mSupplies','rAvgPrice','rDailyOrders','rWorkDays','platformFeePct','wasteRatePct','packagingCostPerOrder','deliveryCostPerOrder','monthlyGrowthPct'],
                       save_fn, convert_fn,
                       """if (pending.action === 'save' && window.saveFeasibilityProject) window.saveFeasibilityProject();
          else if (pending.action === 'excel' && window.exportExcel) window.exportExcel();
          else if (pending.action === 'pdf' && window.exportPDF) window.exportPDF();
          else if (pending.action === 'v3' && window.convertToV3Project) window.convertToV3Project();""")
    # Assign export wrappers
    block = block.replace('</script>', '''  window.exportExcel = exportExcelFeas;
  window.exportPDF = exportPDFFeas;
</script>''', 1)
    c = c.replace('</body>', block + '\n</body>')
    write(p, c)


# ---------- CASH FLOW ----------
def edit_cash_flow():
    p = rel('en', 'calculators', 'cash-flow.html')
    c = read(p)
    c = c.replace('<script src="/calculators/auth-gate.js?v=2"></script>\n', '')
    c = c.replace('    function calculateAll() {', TRACKING_TPL_4 % {'source': 'cash_flow'}, 1)
    c = c.replace('        updateSummary(months);', '        updateSummary(months);\n        window._lastCashFlowResult = { openingBalance: parseFloat(document.getElementById(\'openingBalance\').value) || 0, country: document.getElementById(\'country\')?.value || \'SA\', months: months };')
    c = c.replace('''            <div class="share-bar hidden-print calc-mt-6">
              <button onclick="exportExcel()" class="btn btn-outline calc-btn-sm">📊 Excel</button>
              <button onclick="exportPDF()" class="btn btn-outline calc-btn-sm">🖨️ طباعة / PDF</button>
            </div>''',
                  '''            <div class="share-bar hidden-print calc-mt-6">
              <button onclick="checkAuthForAction(\'save\', saveCashFlowProject)" class="btn btn-outline calc-btn-sm">💾 Save</button>
              <button onclick="checkAuthForAction(\'excel\', exportExcel)" class="btn btn-outline calc-btn-sm">📊 Excel</button>
              <button onclick="checkAuthForAction(\'pdf\', exportPDF)" class="btn btn-outline calc-btn-sm">🖨️ Print / PDF</button>
              <button onclick="checkAuthForAction(\'v3\', convertCashFlowToV3)" class="btn btn-outline calc-btn-sm">🚀 Open in V3</button>
            </div>''')

    c = c.replace('''  <script src="../../page-tracker-v2.js"></script>
<script src="../../calculators/shared-geo.js?v=6"></script>

<script src="../../components/universal-dropdown.js?v=2.51.8"></script>
<script src="../../components/universal-dropdown-init.js"></script>
<script>
(function(){
  var lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  var dateStr = lastDay.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  document.querySelectorAll('.offer-date-en').forEach(function(el){ el.textContent = dateStr; });
})();
</script>
</body>''',
                  '''  <script src="../../calculators/usage-guard.js"></script>
  <script src="../../page-tracker-v2.js"></script>
''' + UX_SCRIPTS + '''
<script src="../../calculators/shared-geo.js?v=6"></script>

<script src="../../components/universal-dropdown.js?v=2.51.8"></script>
<script src="../../components/universal-dropdown-init.js"></script>
''' + '%BLOCK%' + '''
<script>
(function(){
  var lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  var dateStr = lastDay.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  document.querySelectorAll('.offer-date-en').forEach(function(el){ el.textContent = dateStr; });
})();
</script>
</body>''')

    save_fn = '''window.saveCashFlowProject = function() {
    try {
      if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {
        window.BondsAnalytics.trackEvent('calc_project_saved', { source: 'cash_flow', country: document.getElementById('country')?.value || 'SA' });
      }
      var ob = parseFloat(document.getElementById('openingBalance')?.value) || 0;
      var endBal = document.getElementById('sumEndBal')?.textContent || '—';
      var title = '12-Month Cash Flow';
      var summary = 'Opening ' + ob.toLocaleString('en-US') + ' · Ending balance ' + endBal;
      var projects = JSON.parse(localStorage.getItem('bonds_guest_projects') || '[]');
      projects.unshift({ title: title, summary: summary, href: window.location.pathname + window.location.search, createdAt: new Date().toISOString(), source: 'cash_flow' });
      localStorage.setItem('bonds_guest_projects', JSON.stringify(projects.slice(0, 20)));
      BondsUI.toast('Project saved to your space', 'success');
    } catch (e) {
      BondsUI.toast('Could not save locally', 'warning');
    }
  };'''
    convert_fn = '''window.convertCashFlowToV3 = async function() {
    try {
      BondsUI.toast('Creating V3 project...', 'info');
      var ob = parseFloat(document.getElementById('openingBalance')?.value) || 0;
      var payload = {
        name: '12-Month Cash Flow Forecast',
        sector: 'Cash Flow Forecast',
        activity: 'Cash Flow Planning',
        cityCode: null,
        currency: 'SAR',
        capital: ob,
        revenue: 0,
        annualProfit: 0,
        language: 'en'
      };
      const { data: sessionData } = await window.BondsAuth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch('/api/v3/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { BondsUI.toast('⚠️ ' + (json.error || 'Failed to create project'), 'error'); return; }
      if (json.project?.id) window.location.href = '/v3/project?id=' + encodeURIComponent(json.project.id);
      else BondsUI.toast('Project link not received', 'error');
    } catch (e) {
      BondsUI.toast('Failed to connect to V3 project', 'error');
    }
  };'''
    restore = '''(function restoreDraft() {
      try {
        var raw = sessionStorage.getItem('bonds_cash_flow_draft');
        if (!raw) return;
        var draft = JSON.parse(raw);
        if (draft.openingBalance !== undefined) document.getElementById('openingBalance').value = draft.openingBalance;
        if (draft.wasteAndIncidentalsPct !== undefined) document.getElementById('wasteAndIncidentalsPct').value = draft.wasteAndIncidentalsPct;
        if (draft.country) {
          var countrySel = document.getElementById('country');
          if (countrySel) countrySel.value = draft.country;
        }
        if (typeof INFLOW_ROWS !== 'undefined' && typeof OUTFLOW_ROWS !== 'undefined') {
          INFLOW_ROWS.forEach(function(row) {
            var arr = draft['in_' + row.id];
            if (arr) {
              for (var i = 0; i < 12; i++) {
                var el = document.getElementById('in_' + row.id + '_' + i);
                if (el && arr[i] !== undefined) el.value = arr[i];
              }
            }
          });
          OUTFLOW_ROWS.forEach(function(row) {
            var arr = draft['out_' + row.id];
            if (arr) {
              for (var i = 0; i < 12; i++) {
                var el = document.getElementById('out_' + row.id + '_' + i);
                if (el && arr[i] !== undefined) el.value = arr[i];
              }
            }
          });
        }
        sessionStorage.removeItem('bonds_cash_flow_draft');
        if (typeof calculateAll === 'function') calculateAll();
      } catch (e) {}
    })();'''
    block = make_block('cash_flow', 'cash_flow',
                       ['openingBalance','wasteAndIncidentalsPct','country'],
                       save_fn, convert_fn,
                       """if (pending.action === 'save' && window.saveCashFlowProject) window.saveCashFlowProject();
          else if (pending.action === 'excel' && window.exportExcel) window.exportExcel();
          else if (pending.action === 'pdf' && window.exportPDF) window.exportPDF();
          else if (pending.action === 'v3' && window.convertCashFlowToV3) window.convertCashFlowToV3();""",
                       restore)
    # Enhance storeCurrentInputs to include monthly rows
    block = block.replace("sessionStorage.setItem('bonds_cash_flow_draft', JSON.stringify(payload));",
                          """if (typeof INFLOW_ROWS !== 'undefined' && typeof OUTFLOW_ROWS !== 'undefined') {
          INFLOW_ROWS.forEach(function(row) {
            payload['in_' + row.id] = [];
            for (var i = 0; i < 12; i++) {
              var el = document.getElementById('in_' + row.id + '_' + i);
              payload['in_' + row.id].push(el ? el.value : '');
            }
          });
          OUTFLOW_ROWS.forEach(function(row) {
            payload['out_' + row.id] = [];
            for (var i = 0; i < 12; i++) {
              var el = document.getElementById('out_' + row.id + '_' + i);
              payload['out_' + row.id].push(el ? el.value : '');
            }
          });
        }
        sessionStorage.setItem('bonds_cash_flow_draft', JSON.stringify(payload));""")
    c = c.replace('%BLOCK%', block)
    write(p, c)


# ---------- FACTORY COST ----------
def edit_factory_cost():
    p = rel('en', 'calculators', 'factory-cost.html')
    c = read(p)
    c = c.replace('<script src="/calculators/auth-gate.js?v=2"></script>\n  </head>', '  <script src="../../calculators/shared-ui.js"></script>\n  </head>')
    c = c.replace('''        <div class="note">
          ⚠️ These estimates are approximate based on government data and market averages in each country. Actual prices vary by location, activity, and negotiations.
        </div>
      </div>''',
                  '''        <div class="note">
          ⚠️ These estimates are approximate based on government data and market averages in each country. Actual prices vary by location, activity, and negotiations.
        </div>
        <div class="share-bar hidden-print" style="display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:center;margin-top:1.5rem;">
          <button onclick="checkAuthForAction(\'save\', saveFactoryCostProject)" class="btn btn-outline calc-btn-sm">💾 Save</button>
          <button onclick="checkAuthForAction(\'v3\', convertFactoryCostToV3)" class="btn btn-outline calc-btn-sm">🚀 Open in V3</button>
        </div>
      </div>''')
    c = c.replace('''  <script src="../../admin/analytics-tracker.js?v=1"></script>
<script src="../../calculators/usage-guard.js"></script>
  <script src="../../page-tracker-v2.js"></script>
<script src="../../site-layout.js?v=3.0.7"></script>''',
                  '''  <script src="../../admin/analytics-tracker.js?v=1"></script>
<script src="../../calculators/usage-guard.js"></script>
  <script src="../../page-tracker-v2.js"></script>
''' + UX_SCRIPTS + '''
<script src="../../site-layout.js?v=3.0.7"></script>''')

    save_fn = '''window.saveFactoryCostProject = function() {
    try {
      if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {
        window.BondsAnalytics.trackEvent('calc_project_saved', { source: 'factory_cost', country: document.getElementById('country')?.value || 'SA' });
      }
      var totalMonthly = document.getElementById('totalMonthly')?.textContent || '—';
      var setupCost = document.getElementById('setupCost')?.textContent || '—';
      var industrySel = document.getElementById('industry');
      var industryName = industrySel?.options?.[industrySel.selectedIndex]?.text || 'Factory';
      var title = industryName + ' Factory Cost Study';
      var summary = 'Monthly ' + totalMonthly + ' · Setup ' + setupCost;
      var projects = JSON.parse(localStorage.getItem('bonds_guest_projects') || '[]');
      projects.unshift({ title: title, summary: summary, href: window.location.pathname + window.location.search, createdAt: new Date().toISOString(), source: 'factory_cost' });
      localStorage.setItem('bonds_guest_projects', JSON.stringify(projects.slice(0, 20)));
      BondsUI.toast('Project saved to your space', 'success');
    } catch (e) {
      BondsUI.toast('Could not save locally', 'warning');
    }
  };'''
    convert_fn = '''window.convertFactoryCostToV3 = async function() {
    try {
      BondsUI.toast('Creating V3 project...', 'info');
      var monthlyProduction = parseFloat(document.getElementById('monthlyProduction')?.value) || 0;
      var unitPrice = parseFloat(document.getElementById('unitPrice')?.value) || 0;
      var setupCostText = document.getElementById('setupCost')?.textContent || '0';
      var setupCost = parseFloat(setupCostText.replace(/[^0-9.-]+/g, '')) || 0;
      var industrySel = document.getElementById('industry');
      var industryName = industrySel?.options?.[industrySel.selectedIndex]?.text || 'Manufacturing';
      var payload = {
        name: industryName + ' Factory Cost Project',
        sector: industryName,
        activity: 'Manufacturing',
        cityCode: document.getElementById('city')?.value || null,
        currency: 'SAR',
        capital: setupCost,
        revenue: monthlyProduction * unitPrice * 12,
        annualProfit: 0,
        language: 'en'
      };
      const { data: sessionData } = await window.BondsAuth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch('/api/v3/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { BondsUI.toast('⚠️ ' + (json.error || 'Failed to create project'), 'error'); return; }
      if (json.project?.id) window.location.href = '/v3/project?id=' + encodeURIComponent(json.project.id);
      else BondsUI.toast('Project link not received', 'error');
    } catch (e) {
      BondsUI.toast('Failed to connect to V3 project', 'error');
    }
  };'''
    block = make_block('factory_cost', 'factory_cost',
                       ['country','city','industry','area','type','localWorkers','expatWorkers','localSalary','expatSalary','voltage','electricity','water','monthlyProduction','maintenancePct','insurancePct','rawMaterialPct','unitPrice','wasteAndIncidentalsPct'],
                       save_fn, convert_fn,
                       """if (pending.action === 'save' && window.saveFactoryCostProject) window.saveFactoryCostProject();
          else if (pending.action === 'v3' && window.convertFactoryCostToV3) window.convertFactoryCostToV3();""")
    c = c.replace('</body>', block + '\n</body>')
    write(p, c)

    # Also update shared engine to track completion
    sp = rel('calculators', 'factory-cost-shared.js')
    sc = read(sp)
    marker = "    const city = getCityData(cityKey);"
    if marker in sc and "window._calcCompleted = true;" not in sc:
        sc = sc.replace(marker, marker + "\n    if (!city) {\n      alert(t('selectCityFirst'));\n      return;\n    }\n    if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {\n      window.BondsAnalytics.trackEvent('calc_completed', { source: 'factory_cost', country: _config.countryCode || document.getElementById('country')?.value || 'SA' });\n    }\n    window._calcCompleted = true;\n")
        # Remove duplicate alert block that follows
        sc = sc.replace("    if (!city) {\n      alert(t('selectCityFirst'));\n      return;\n    }\n    if (!city) {\n      alert(t('selectCityFirst'));\n      return;\n    }", "    if (!city) {\n      alert(t('selectCityFirst'));\n      return;\n    }")
        write(sp, sc)


# ---------- PRICING ----------
def edit_pricing():
    p = rel('en', 'calculators', 'pricing.html')
    c = read(p)
    c = c.replace('<script src="/calculators/auth-gate.js?v=2"></script>\n', '')
    c = c.replace('    function calculateAll() {', TRACKING_TPL_4 % {'source': 'pricing'}, 1)
    c = c.replace('''            <div class="share-bar">
              <input type="text" id="shareLink" readonly placeholder="Share link..." />
              <button onclick="copyShareLink(\\'shareLink\\')" class="btn btn-outline calc-btn-sm">Copy Link</button>
              <button onclick="window.print()" class="btn btn-outline hidden-print calc-btn-sm">🖨️ Print</button>
              <button onclick="exportExcel()" class="btn btn-outline hidden-print calc-btn-sm">📊 Excel</button>
              <button onclick="exportPDF()" class="btn btn-outline hidden-print calc-btn-sm">📄 PDF</button>
            </div>''',
                  '''            <div class="share-bar">
              <input type="text" id="shareLink" readonly placeholder="Share link..." />
              <button onclick="copyShareLink(\\'shareLink\\')" class="btn btn-outline calc-btn-sm">Copy Link</button>
              <button onclick="checkAuthForAction(\\'pdf\\', function(){ window.print(); })" class="btn btn-outline hidden-print calc-btn-sm">🖨️ Print</button>
              <button onclick="checkAuthForAction(\\'excel\\', exportExcel)" class="btn btn-outline hidden-print calc-btn-sm">📊 Excel</button>
              <button onclick="checkAuthForAction(\\'pdf\\', exportPDF)" class="btn btn-outline hidden-print calc-btn-sm">📄 PDF</button>
              <button onclick="checkAuthForAction(\\'save\\', savePricingProject)" class="btn btn-outline hidden-print calc-btn-sm">💾 Save</button>
              <button onclick="checkAuthForAction(\\'v3\\', convertPricingToV3)" class="btn btn-outline hidden-print calc-btn-sm">🚀 Open in V3</button>
            </div>''')
    c = c.replace('''  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/bonds-auth-2026.js?v=3.0.6"></script>
<script src="../../site-layout.js?v=3.0.7"></script>''',
                  '''  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/bonds-auth-2026.js?v=3.0.6"></script>
''' + UX_SCRIPTS_NO_AUTH + '''
<script src="../../site-layout.js?v=3.0.7"></script>''')

    save_fn = '''window.savePricingProject = function() {
    try {
      if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {
        window.BondsAnalytics.trackEvent('calc_project_saved', { source: 'pricing', country: document.getElementById('country')?.value || 'SA' });
      }
      var last = window._lastPricingResult;
      var priceText = document.getElementById('resPriceBeforeTax')?.textContent || '—';
      var profitText = document.getElementById('resProfitPerUnit')?.textContent || '—';
      var title = last && last.r && last.r.netProfitPerUnit >= 0 ? 'Profitable Product Pricing' : 'Product Pricing Study';
      var summary = 'Selling price ' + priceText + ' · Profit/unit ' + profitText;
      var projects = JSON.parse(localStorage.getItem('bonds_guest_projects') || '[]');
      projects.unshift({ title: title, summary: summary, href: window.location.pathname + window.location.search, createdAt: new Date().toISOString(), source: 'pricing' });
      localStorage.setItem('bonds_guest_projects', JSON.stringify(projects.slice(0, 20)));
      BondsUI.toast('Project saved to your space', 'success');
    } catch (e) {
      BondsUI.toast('Could not save locally', 'warning');
    }
  };'''
    convert_fn = '''window.convertPricingToV3 = async function() {
    try {
      BondsUI.toast('Creating V3 project...', 'info');
      var last = window._lastPricingResult;
      var volume = parseFloat(document.getElementById('monthlyVolume')?.value) || 0;
      var monthlyProfit = last && last.r ? (last.r.netProfitPerUnit || 0) * volume : 0;
      var price = last && last.r ? (last.r.priceBeforeTax || 0) : 0;
      var sectorSelect = document.getElementById('sectorPreset');
      var sectorName = sectorSelect?.options?.[sectorSelect.selectedIndex]?.text || 'E-commerce';
      var payload = {
        name: sectorName + ' Pricing Study',
        sector: sectorName,
        activity: 'Product Pricing',
        cityCode: null,
        currency: 'SAR',
        capital: 0,
        revenue: price * volume * 12,
        annualProfit: monthlyProfit * 12,
        language: 'en'
      };
      const { data: sessionData } = await window.BondsAuth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch('/api/v3/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { BondsUI.toast('⚠️ ' + (json.error || 'Failed to create project'), 'error'); return; }
      if (json.project?.id) window.location.href = '/v3/project?id=' + encodeURIComponent(json.project.id);
      else BondsUI.toast('Project link not received', 'error');
    } catch (e) {
      BondsUI.toast('Failed to connect to V3 project', 'error');
    }
  };'''
    block = make_block('pricing', 'pricing',
                       ['country','platformSelect','sectorPreset','directCost','overheadCost','wasteAndIncidentalsPct','monthlyFixed','desiredMargin','targetPrice','taxRate','zakatRate','monthlyVolume','platformFee','paymentGatewayFee','packagingCost','deliveryCost','cac'],
                       save_fn, convert_fn,
                       """if (pending.action === 'save' && window.savePricingProject) window.savePricingProject();
          else if (pending.action === 'excel' && window.exportExcel) window.exportExcel();
          else if (pending.action === 'pdf' && window.exportPDF) window.exportPDF();
          else if (pending.action === 'v3' && window.convertPricingToV3) window.convertPricingToV3();""")
    c = c.replace('</body>', block + '\n</body>')
    write(p, c)


# ---------- LOAN ----------
def edit_loan():
    p = rel('en', 'calculators', 'loan.html')
    c = read(p)
    c = c.replace('<script src="/calculators/auth-gate.js?v=2"></script>\n', '')
    c = c.replace('    function calculateAll() {', TRACKING_TPL_4 % {'source': 'loan'}, 1)
    c = c.replace('''            <div class="share-bar">
              <input type="text" id="shareLink" readonly placeholder="رابط المشاركة..." />
              <button onclick="copyLink()" class="btn btn-outline hidden-print calc-btn-sm">نسخ الرابط</button>
              <button onclick="window.print()" class="btn btn-outline hidden-print calc-btn-sm">🖨️ طباعة</button>
              <button onclick="exportExcel()" class="btn btn-outline hidden-print calc-btn-sm">📊 Excel</button>
              <select data-universal-dropdown="true" id="pdfLang" class="hidden-print calc-select-sm" aria-label="PDF language">
                <option value="ar">PDF عربي</option>
                <option value="en">PDF English</option>
              </select>
              <button onclick="exportPDF()" class="btn btn-outline hidden-print calc-btn-sm">📄 تصدير</button>
            </div>''',
                  '''            <div class="share-bar">
              <input type="text" id="shareLink" readonly placeholder="رابط المشاركة..." />
              <button onclick="copyLink()" class="btn btn-outline hidden-print calc-btn-sm">نسخ الرابط</button>
              <button onclick="checkAuthForAction(\'pdf\', function(){ window.print(); })" class="btn btn-outline hidden-print calc-btn-sm">🖨️ طباعة</button>
              <button onclick="checkAuthForAction(\'excel\', exportExcel)" class="btn btn-outline hidden-print calc-btn-sm">📊 Excel</button>
              <select data-universal-dropdown="true" id="pdfLang" class="hidden-print calc-select-sm" aria-label="PDF language">
                <option value="ar">PDF عربي</option>
                <option value="en">PDF English</option>
              </select>
              <button onclick="checkAuthForAction(\'pdf\', exportPDF)" class="btn btn-outline hidden-print calc-btn-sm">📄 تصدير</button>
              <button onclick="checkAuthForAction(\'save\', saveLoanProject)" class="btn btn-outline hidden-print calc-btn-sm">💾 Save</button>
              <button onclick="checkAuthForAction(\'v3\', convertLoanToV3)" class="btn btn-outline hidden-print calc-btn-sm">🚀 Open in V3</button>
            </div>''')
    c = c.replace('''  <script src="../../page-tracker-v2.js"></script>
<script src="../../calculators/shared-geo.js?v=6"></script>

<script src="../../components/universal-dropdown.js?v=2.51.8"></script>
<script src="../../components/universal-dropdown-init.js"></script>
</body>''',
                  '''  <script src="../../calculators/usage-guard.js"></script>
  <script src="../../page-tracker-v2.js"></script>
''' + UX_SCRIPTS + '''
<script src="../../calculators/shared-geo.js?v=6"></script>

<script src="../../components/universal-dropdown.js?v=2.51.8"></script>
<script src="../../components/universal-dropdown-init.js"></script>
''' + '%BLOCK%' + '''
</body>''')

    save_fn = '''window.saveLoanProject = function() {
    try {
      if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {
        window.BondsAnalytics.trackEvent('calc_project_saved', { source: 'loan', country: document.getElementById('country')?.value || 'SA' });
      }
      var loanAmount = document.getElementById('loanAmount')?.value || '—';
      var monthlyPayment = document.getElementById('resMonthlyPayment')?.textContent || '—';
      var title = 'Loan Financing Study';
      var summary = 'Loan ' + loanAmount + ' SAR · Monthly payment ' + monthlyPayment;
      var projects = JSON.parse(localStorage.getItem('bonds_guest_projects') || '[]');
      projects.unshift({ title: title, summary: summary, href: window.location.pathname + window.location.search, createdAt: new Date().toISOString(), source: 'loan' });
      localStorage.setItem('bonds_guest_projects', JSON.stringify(projects.slice(0, 20)));
      BondsUI.toast('Project saved to your space', 'success');
    } catch (e) {
      BondsUI.toast('Could not save locally', 'warning');
    }
  };'''
    convert_fn = '''window.convertLoanToV3 = async function() {
    try {
      BondsUI.toast('Creating V3 project...', 'info');
      var loanAmount = parseFloat(document.getElementById('loanAmount')?.value) || 0;
      var payload = {
        name: 'Loan Financing Study',
        sector: 'Financing',
        activity: 'Loan Comparison',
        cityCode: null,
        currency: 'SAR',
        capital: loanAmount,
        revenue: 0,
        annualProfit: 0,
        language: 'en'
      };
      const { data: sessionData } = await window.BondsAuth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch('/api/v3/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { BondsUI.toast('⚠️ ' + (json.error || 'Failed to create project'), 'error'); return; }
      if (json.project?.id) window.location.href = '/v3/project?id=' + encodeURIComponent(json.project.id);
      else BondsUI.toast('Project link not received', 'error');
    } catch (e) {
      BondsUI.toast('Failed to connect to V3 project', 'error');
    }
  };'''
    block = make_block('loan', 'loan',
                       ['country','loanAmount','downPayment','interestRate','loanTerm','paymentFrequency','interestMethod','borrowerType','extraFees','adminFeeRate','adminFeeAmount','adminFeeMethod','participationRate','monthlyIncome'],
                       save_fn, convert_fn,
                       """if (pending.action === 'save' && window.saveLoanProject) window.saveLoanProject();
          else if (pending.action === 'excel' && window.exportExcel) window.exportExcel();
          else if (pending.action === 'pdf' && window.exportPDF) window.exportPDF();
          else if (pending.action === 'v3' && window.convertLoanToV3) window.convertLoanToV3();""")
    c = c.replace('%BLOCK%', block)
    write(p, c)


# ---------- ROI ----------
def edit_roi():
    p = rel('en', 'calculators', 'roi.html')
    c = read(p)
    c = c.replace('<script src="/calculators/auth-gate.js?v=2"></script>\n  </head>', '  <script src="../../calculators/shared-ui.js"></script>\n  </head>')
    c = c.replace('    function calculateROI() {', TRACKING_ROI, 1)
    c = c.replace('      document.getElementById(\'resultsPanel\').style.display = \'block\';',
                  '''      document.getElementById('resultsPanel').style.display = 'block';
      window._lastROIResult = { investment: investment, revenue: revenue, costs: costs, years: years, netProfit: netProfit, roi: roi, payback: payback, npv: npv, annualNet: annualNet };''')
    c = c.replace('''          <div class="metric-card">
            <span class="metric-label">Annual Cash Flow</span>
            <span class="metric-value" id="annualCashFlow">—</span>
          </div>
        </div>''',
                  '''          <div class="metric-card">
            <span class="metric-label">Annual Cash Flow</span>
            <span class="metric-value" id="annualCashFlow">—</span>
          </div>
          <div class="share-bar hidden-print" style="display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:center;margin-top:1rem;">
            <button onclick="checkAuthForAction(\'save\', saveROIProject)" class="btn btn-outline calc-btn-sm">💾 Save</button>
            <button onclick="checkAuthForAction(\'pdf\', function(){ window.print(); })" class="btn btn-outline calc-btn-sm">🖨️ Print</button>
            <button onclick="checkAuthForAction(\'v3\', convertROIToV3)" class="btn btn-outline calc-btn-sm">🚀 Open in V3</button>
          </div>
        </div>''')
    c = c.replace('''  <script src="../../site-layout.js"></script>
  <script>''',
                  '''  <script src="/api/env"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/bonds-auth-2026.js?v=3.0.6"></script>
  <script src="../../calculators/shared-analytics.js"></script>
  <script src="../../calculators/auth-modal.js"></script>
  <script src="../../calculators/exit-intent.js"></script>
  <script src="../../site-layout.js"></script>
  <script>''')

    save_fn = '''window.saveROIProject = function() {
    try {
      if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {
        window.BondsAnalytics.trackEvent('calc_project_saved', { source: 'roi', country: 'SA' });
      }
      var netProfit = document.getElementById('netProfit')?.textContent || '—';
      var roi = document.getElementById('roiResult')?.textContent || '—';
      var title = 'ROI Analysis';
      var summary = 'Net profit ' + netProfit + ' · ROI ' + roi;
      var projects = JSON.parse(localStorage.getItem('bonds_guest_projects') || '[]');
      projects.unshift({ title: title, summary: summary, href: window.location.pathname + window.location.search, createdAt: new Date().toISOString(), source: 'roi' });
      localStorage.setItem('bonds_guest_projects', JSON.stringify(projects.slice(0, 20)));
      BondsUI.toast('Project saved to your space', 'success');
    } catch (e) {
      BondsUI.toast('Could not save locally', 'warning');
    }
  };'''
    convert_fn = '''window.convertROIToV3 = async function() {
    try {
      BondsUI.toast('Creating V3 project...', 'info');
      var last = window._lastROIResult || {};
      var payload = {
        name: 'ROI Analysis',
        sector: 'Investment Analysis',
        activity: 'ROI / NPV',
        cityCode: null,
        currency: 'USD',
        capital: last.investment || 0,
        revenue: (last.revenue || 0) * (last.years || 5),
        annualProfit: last.netProfit || 0,
        language: 'en'
      };
      const { data: sessionData } = await window.BondsAuth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch('/api/v3/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { BondsUI.toast('⚠️ ' + (json.error || 'Failed to create project'), 'error'); return; }
      if (json.project?.id) window.location.href = '/v3/project?id=' + encodeURIComponent(json.project.id);
      else BondsUI.toast('Project link not received', 'error');
    } catch (e) {
      BondsUI.toast('Failed to connect to V3 project', 'error');
    }
  };'''
    block = make_block('roi', 'roi',
                       ['initialInvestment','annualRevenue','annualCosts','projectYears','discountRate'],
                       save_fn, convert_fn,
                       """if (pending.action === 'save' && window.saveROIProject) window.saveROIProject();
          else if (pending.action === 'pdf') window.print();
          else if (pending.action === 'v3' && window.convertROIToV3) window.convertROIToV3();""")
    c = c.replace('</body>', block + '\n</body>')
    write(p, c)


if __name__ == '__main__':
    edit_feasibility()
    edit_cash_flow()
    edit_factory_cost()
    edit_pricing()
    edit_loan()
    edit_roi()
    print('Done applying UX/auth/tracking pattern to English calculators.')

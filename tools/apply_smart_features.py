#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Apply 3 smart features to restaurant calculator (AR + EN):
1. Enhanced Shareable URL (all inputs)
2. Enhanced LocalStorage (save/load inputs directly, no page reload)
3. Smart Tip generator after results
"""
import re

FILES = [
    ('calculators/restaurant.html', 'ar'),
    ('en/calculators/restaurant.html', 'en'),
]

for path, lang in FILES:
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()

    is_ar = (lang == 'ar')

    # ------------------------------------------------------------------
    # 1. SMART TIP HTML (after smartAlert div, before platform table)
    # ------------------------------------------------------------------
    tip_html_ar = '''        <!-- Smart Tip -->
        <div class="analysis-box reveal" id="smartTipBox" style="margin-top: var(--space-6); display: none; border-left: 4px solid var(--gold);">
          <h4 style="color: var(--gold); margin-bottom: var(--space-2);">💡 نصيحة ذكية</h4>
          <p id="smartTipText" style="font-size: 1rem; line-height: 1.7; margin: 0;"></p>
        </div>

        <!-- Platform Comparison Table -->'''

    tip_html_en = '''        <!-- Smart Tip -->
        <div class="analysis-box reveal" id="smartTipBox" style="margin-top: var(--space-6); display: none; border-left: 4px solid var(--gold);">
          <h4 style="color: var(--gold); margin-bottom: var(--space-2);">💡 Smart Tip</h4>
          <p id="smartTipText" style="font-size: 1rem; line-height: 1.7; margin: 0;"></p>
        </div>

        <!-- Platform Comparison Table -->'''

    tip_html = tip_html_ar if is_ar else tip_html_en
    text = text.replace(
        '        <!-- Platform Comparison Table -->',
        tip_html,
        1
    )

    # ------------------------------------------------------------------
    # 2. ENHANCED updateShareLink
    # ------------------------------------------------------------------
    old_update = '''    function updateShareLink(inputs) {
      var url = new URL(window.location.href);
      url.searchParams.set('d', JSON.stringify(inputs.dishes));
      url.searchParams.set('o', inputs.dailyOrders);
      url.searchParams.set('wd', inputs.workingDays);
      url.searchParams.set('c', currentCountry);
      url.searchParams.set('model', currentBusinessModel);
      document.getElementById('shareLink').value = url.toString();
      updateQR(url.toString());
    }'''

    new_update = '''    function updateShareLink(inputs) {
      var url = new URL(window.location.href);
      url.searchParams.set('d', JSON.stringify(inputs.dishes));
      url.searchParams.set('o', inputs.dailyOrders);
      url.searchParams.set('wd', inputs.workingDays);
      url.searchParams.set('c', currentCountry);
      url.searchParams.set('model', currentBusinessModel);
      url.searchParams.set('rent', inputs.rent);
      url.searchParams.set('sal', inputs.salaries);
      url.searchParams.set('util', inputs.utilities);
      url.searchParams.set('lic', inputs.licenses);
      url.searchParams.set('cloud', inputs.cloudKitchen);
      url.searchParams.set('mkt', inputs.marketing);
      url.searchParams.set('pkg', inputs.packaging);
      url.searchParams.set('del', inputs.delivery);
      url.searchParams.set('waste', inputs.wasteRate);
      url.searchParams.set('gmv', inputs.monthlyGMV);
      var selectedIds = [];
      PLATFORMS.forEach(function(p) {
        var el = document.getElementById(p.id);
        if (el && el.checked && p.id !== 'plat_direct') selectedIds.push(p.id);
      });
      url.searchParams.set('plats', selectedIds.join(','));
      document.getElementById('shareLink').value = url.toString();
      updateQR(url.toString());
    }'''

    text = text.replace(old_update, new_update)

    # ------------------------------------------------------------------
    # 3. ENHANCED loadFromURL
    # ------------------------------------------------------------------
    old_load = '''    function loadFromURL() {
      var url = new URL(window.location.href);
      var d = url.searchParams.get('d');
      var o = url.searchParams.get('o');
      var wd = url.searchParams.get('wd');
      var c = url.searchParams.get('c');
      var model = url.searchParams.get('model');
      if (c && COUNTRIES_DATA[c]) {
        document.getElementById('countrySelect').value = c;
        changeCountry(c);
      }
      if (d) {
        try { dishes = JSON.parse(d); renderDishes(); } catch(e) {}
      }
      if (o) document.getElementById('dailyOrders').value = o;
      if (wd) document.getElementById('workingDays').value = wd;
      if (model && ['traditional', 'cloud', 'cafe', 'dessert'].indexOf(model) !== -1) {
        setBusinessModel(model);
      }
      if (d || o || wd || model) calculateAll();
    }'''

    new_load = '''    function loadFromURL() {
      var url = new URL(window.location.href);
      var d = url.searchParams.get('d');
      var o = url.searchParams.get('o');
      var wd = url.searchParams.get('wd');
      var c = url.searchParams.get('c');
      var model = url.searchParams.get('model');
      var rent = url.searchParams.get('rent');
      var sal = url.searchParams.get('sal');
      var util = url.searchParams.get('util');
      var lic = url.searchParams.get('lic');
      var cloud = url.searchParams.get('cloud');
      var mkt = url.searchParams.get('mkt');
      var pkg = url.searchParams.get('pkg');
      var del = url.searchParams.get('del');
      var waste = url.searchParams.get('waste');
      var gmv = url.searchParams.get('gmv');
      var plats = url.searchParams.get('plats');
      if (c && COUNTRIES_DATA[c]) {
        document.getElementById('countrySelect').value = c;
        changeCountry(c);
      }
      if (d) {
        try { dishes = JSON.parse(d); renderDishes(); } catch(e) {}
      }
      if (o) document.getElementById('dailyOrders').value = o;
      if (wd) document.getElementById('workingDays').value = wd;
      if (rent) document.getElementById('rentCost').value = rent;
      if (sal) document.getElementById('salariesCost').value = sal;
      if (util) document.getElementById('utilitiesCost').value = util;
      if (lic) document.getElementById('licensesCost').value = lic;
      if (cloud) document.getElementById('cloudKitchenCost').value = cloud;
      if (mkt) document.getElementById('marketingCost').value = mkt;
      if (pkg) document.getElementById('packagingCost').value = pkg;
      if (del) document.getElementById('deliveryCost').value = del;
      if (waste) document.getElementById('wasteRate').value = waste;
      if (gmv) document.getElementById('monthlyGMV').value = gmv;
      if (model && ['traditional', 'cloud', 'cafe', 'dessert'].indexOf(model) !== -1) {
        setBusinessModel(model);
      }
      if (plats) {
        var ids = plats.split(',');
        PLATFORMS.forEach(function(p) {
          var el = document.getElementById(p.id);
          if (el) el.checked = ids.indexOf(p.id) !== -1;
        });
      }
      if (d || o || wd || model || rent || plats) calculateAll();
    }'''

    text = text.replace(old_load, new_load)

    # ------------------------------------------------------------------
    # 4. ENHANCED saveSession (store inputs directly)
    # ------------------------------------------------------------------
    old_save = '''    function saveSession() {
      var name = document.getElementById('sessionName').value.trim();
      if (!name) { alert('أدخل اسم للحساب'); return; }
      var url = document.getElementById('shareLink').value;
      var session = {
        id: Date.now(),
        name: name,
        url: url,
        country: currentCountry,
        model: currentBusinessModel,
        date: new Date().toLocaleString('ar-SA'),
        summary: document.getElementById('valNetProfit').textContent + ' ربح | ' + document.getElementById('valMargin').textContent + ' هامش'
      };
      dbGet(_sessionsKey).then(function(sessions) {
        sessions = sessions || [];
        sessions.unshift(session);
        if (sessions.length > 20) sessions = sessions.slice(0, 20);
        return dbSet(_sessionsKey, sessions);
      }).then(function() {
        document.getElementById('sessionName').value = '';
        renderSessions();
        alert('✅ تم حفظ الحساب');
      });
    }'''

    new_save_ar = '''    function saveSession() {
      var name = document.getElementById('sessionName').value.trim();
      if (!name) { alert('أدخل اسم للحساب'); return; }
      var inputs = getInputs();
      var selectedIds = [];
      PLATFORMS.forEach(function(p) {
        var el = document.getElementById(p.id);
        if (el && el.checked && p.id !== 'plat_direct') selectedIds.push(p.id);
      });
      var session = {
        id: Date.now(),
        name: name,
        country: currentCountry,
        model: currentBusinessModel,
        inputs: inputs,
        selectedIds: selectedIds,
        date: new Date().toLocaleString('ar-SA'),
        summary: document.getElementById('valNetProfit').textContent + ' ربح | ' + document.getElementById('valMargin').textContent + ' هامش'
      };
      dbGet(_sessionsKey).then(function(sessions) {
        sessions = sessions || [];
        sessions.unshift(session);
        if (sessions.length > 20) sessions = sessions.slice(0, 20);
        return dbSet(_sessionsKey, sessions);
      }).then(function() {
        document.getElementById('sessionName').value = '';
        renderSessions();
        alert('✅ تم حفظ الحساب');
      });
    }'''

    new_save_en = '''    function saveSession() {
      var name = document.getElementById('sessionName').value.trim();
      if (!name) { alert('Enter a name for this scenario'); return; }
      var inputs = getInputs();
      var selectedIds = [];
      PLATFORMS.forEach(function(p) {
        var el = document.getElementById(p.id);
        if (el && el.checked && p.id !== 'plat_direct') selectedIds.push(p.id);
      });
      var session = {
        id: Date.now(),
        name: name,
        country: currentCountry,
        model: currentBusinessModel,
        inputs: inputs,
        selectedIds: selectedIds,
        date: new Date().toLocaleString('en-US'),
        summary: document.getElementById('valNetProfit').textContent + ' profit | ' + document.getElementById('valMargin').textContent + ' margin'
      };
      dbGet(_sessionsKey).then(function(sessions) {
        sessions = sessions || [];
        sessions.unshift(session);
        if (sessions.length > 20) sessions = sessions.slice(0, 20);
        return dbSet(_sessionsKey, sessions);
      }).then(function() {
        document.getElementById('sessionName').value = '';
        renderSessions();
        alert('✅ Scenario saved');
      });
    }'''

    new_save = new_save_ar if is_ar else new_save_en
    text = text.replace(old_save, new_save)

    # ------------------------------------------------------------------
    # 5. ENHANCED loadSessionUrl (load without reload)
    # ------------------------------------------------------------------
    old_loadsess = '''    function loadSessionUrl(url) {
      window.location.href = url;
    }'''

    new_loadsess_ar = '''    function loadSessionUrl(session) {
      if (typeof session === 'string') { window.location.href = session; return; }
      var s = session;
      if (s.country && COUNTRIES_DATA[s.country]) {
        document.getElementById('countrySelect').value = s.country;
        changeCountry(s.country);
      }
      if (s.inputs) {
        var i = s.inputs;
        if (i.dishes && i.dishes.length) { dishes = i.dishes.map(function(d) { return { name: d.name, price: d.price, cost: d.cost, salesMix: d.salesMix }; }); renderDishes(); }
        if (i.dailyOrders) document.getElementById('dailyOrders').value = i.dailyOrders;
        if (i.workingDays) document.getElementById('workingDays').value = i.workingDays;
        if (i.rent) document.getElementById('rentCost').value = i.rent;
        if (i.salaries) document.getElementById('salariesCost').value = i.salaries;
        if (i.utilities) document.getElementById('utilitiesCost').value = i.utilities;
        if (i.licenses) document.getElementById('licensesCost').value = i.licenses;
        if (i.cloudKitchen) document.getElementById('cloudKitchenCost').value = i.cloudKitchen;
        if (i.marketing) document.getElementById('marketingCost').value = i.marketing;
        if (i.packaging) document.getElementById('packagingCost').value = i.packaging;
        if (i.delivery) document.getElementById('deliveryCost').value = i.delivery;
        if (i.wasteRate !== undefined) document.getElementById('wasteRate').value = i.wasteRate;
        if (i.monthlyGMV) document.getElementById('monthlyGMV').value = i.monthlyGMV;
      }
      if (s.model && ['traditional', 'cloud', 'cafe', 'dessert'].indexOf(s.model) !== -1) {
        setBusinessModel(s.model);
      }
      if (s.selectedIds && s.selectedIds.length) {
        PLATFORMS.forEach(function(p) {
          var el = document.getElementById(p.id);
          if (el) el.checked = s.selectedIds.indexOf(p.id) !== -1;
        });
      }
      calculateAll();
      window.scrollTo({ top: document.getElementById('calc').offsetTop - 80, behavior: 'smooth' });
    }'''

    new_loadsess_en = '''    function loadSessionUrl(session) {
      if (typeof session === 'string') { window.location.href = session; return; }
      var s = session;
      if (s.country && COUNTRIES_DATA[s.country]) {
        document.getElementById('countrySelect').value = s.country;
        changeCountry(s.country);
      }
      if (s.inputs) {
        var i = s.inputs;
        if (i.dishes && i.dishes.length) { dishes = i.dishes.map(function(d) { return { name: d.name, price: d.price, cost: d.cost, salesMix: d.salesMix }; }); renderDishes(); }
        if (i.dailyOrders) document.getElementById('dailyOrders').value = i.dailyOrders;
        if (i.workingDays) document.getElementById('workingDays').value = i.workingDays;
        if (i.rent) document.getElementById('rentCost').value = i.rent;
        if (i.salaries) document.getElementById('salariesCost').value = i.salaries;
        if (i.utilities) document.getElementById('utilitiesCost').value = i.utilities;
        if (i.licenses) document.getElementById('licensesCost').value = i.licenses;
        if (i.cloudKitchen) document.getElementById('cloudKitchenCost').value = i.cloudKitchen;
        if (i.marketing) document.getElementById('marketingCost').value = i.marketing;
        if (i.packaging) document.getElementById('packagingCost').value = i.packaging;
        if (i.delivery) document.getElementById('deliveryCost').value = i.delivery;
        if (i.wasteRate !== undefined) document.getElementById('wasteRate').value = i.wasteRate;
        if (i.monthlyGMV) document.getElementById('monthlyGMV').value = i.monthlyGMV;
      }
      if (s.model && ['traditional', 'cloud', 'cafe', 'dessert'].indexOf(s.model) !== -1) {
        setBusinessModel(s.model);
      }
      if (s.selectedIds && s.selectedIds.length) {
        PLATFORMS.forEach(function(p) {
          var el = document.getElementById(p.id);
          if (el) el.checked = s.selectedIds.indexOf(p.id) !== -1;
        });
      }
      calculateAll();
      window.scrollTo({ top: document.getElementById('calc').offsetTop - 80, behavior: 'smooth' });
    }'''

    new_loadsess = new_loadsess_ar if is_ar else new_loadsess_en
    text = text.replace(old_loadsess, new_loadsess)

    # ------------------------------------------------------------------
    # 6. UPDATE renderSessions to pass session object instead of URL string
    # ------------------------------------------------------------------
    old_rendersess = '''              <button class="btn btn-primary" onclick="loadSessionUrl('${s.url}')" style="font-size: 0.8rem; padding: 0.5rem 1rem;">فتح</button>'''
    new_rendersess_ar = '''              <button class="btn btn-primary" onclick='loadSessionUrl(${JSON.stringify(s)})' style="font-size: 0.8rem; padding: 0.5rem 1rem;">تحميل</button>'''
    new_rendersess_en = '''              <button class="btn btn-primary" onclick='loadSessionUrl(${JSON.stringify(s)})' style="font-size: 0.8rem; padding: 0.5rem 1rem;">Load</button>'''
    new_rendersess = new_rendersess_ar if is_ar else new_rendersess_en
    text = text.replace(old_rendersess, new_rendersess)

    # ------------------------------------------------------------------
    # 7. ADD generateSmartTip function + call in calculateAll
    # ------------------------------------------------------------------
    tip_fn_ar = '''    function generateSmartTip(r) {
      var tips = [];
      var inputs = r.inputs;
      var currency = currentCurrency;
      // Tip 1: Profit vs loss
      if (r.netProfit < 0) {
        var be = r.breakEvenDaily;
        var needed = be - inputs.dailyOrders;
        if (needed > 0) {
          tips.push('أنت تخسر حالياً. زيادة الطلبات اليومية بـ ' + needed + ' طلب فقط تحقق لك نقطة التعادل.');
        }
        var priceBoost = Math.ceil((-r.netProfit / (inputs.dailyOrders * inputs.workingDays)) / (inputs.dailyOrders * inputs.workingDays) * 100);
        if (priceBoost > 0 && priceBoost < 50) {
          tips.push('زيادة سعر البيع ' + priceBoost + '% تقريباً يحقق التعادل بدون زيادة طلبات.');
        }
      } else {
        tips.push('أرباحك الإجمالية ' + formatNumber(Math.round(r.netProfit)) + ' ' + currency + '/شهر. حاول زيادة الحجم على أفضل منصة (' + r.bestPlatform.name + ').');
      }
      // Tip 2: Best vs worst platform
      if (r.worstPlatform && r.bestPlatform && r.worstPlatform.name !== r.bestPlatform.name) {
        var diff = r.bestPlatform.monthlyProfit - r.worstPlatform.monthlyProfit;
        if (diff > 0) {
          tips.push('الفرق بين أفضل منصة (' + r.bestPlatform.name + ') وأسوأها (' + r.worstPlatform.name + ') = ' + formatNumber(Math.round(diff)) + ' ' + currency + '/شهر.');
        }
      }
      // Tip 3: Break-even analysis
      if (r.breakEvenDaily > inputs.dailyOrders * 1.5) {
        tips.push('نقطة التعادل مرتفعة (' + r.breakEvenDaily + ' طلب/يوم). راجع التكاليف الثابتة أو هامش الربح.');
      }
      // Tip 4: Open vs closed model
      var openProfit = 0, closedProfit = 0;
      r.platformResults.forEach(function(p) {
        var pm = inputs.platforms.find(function(x) { return x.name === p.name; });
        if (pm) {
          if (pm.operatingModel === 'open') openProfit += p.monthlyProfit;
          else if (pm.operatingModel === 'closed') closedProfit += p.monthlyProfit;
        }
      });
      if (openProfit > closedProfit && closedProfit > 0) {
        tips.push('نموذج المندوب المفتوح (مثل مرسول) يحقق ربحاً أعلى بـ ' + formatNumber(Math.round(openProfit - closedProfit)) + ' ' + currency + ' من القائمة المغلقة.');
      }
      // Tip 5: Food cost
      if (r.weightedFoodCostPct > 35) {
        tips.push('نسبة تكلفة الطعام مرتفعة (' + r.weightedFoodCostPct.toFixed(1) + '%). المعدل المثالي 25-30%.');
      }
      // Pick best tip
      var tip = tips.length ? tips[0] : '';
      var box = document.getElementById('smartTipBox');
      var txt = document.getElementById('smartTipText');
      if (box && txt) {
        if (tip) { txt.textContent = tip; box.style.display = 'block'; }
        else { box.style.display = 'none'; }
      }
    }'''

    tip_fn_en = '''    function generateSmartTip(r) {
      var tips = [];
      var inputs = r.inputs;
      var currency = currentCurrency;
      if (r.netProfit < 0) {
        var be = r.breakEvenDaily;
        var needed = be - inputs.dailyOrders;
        if (needed > 0) {
          tips.push('You are currently losing money. Increasing daily orders by just ' + needed + ' reaches break-even.');
        }
        var priceBoost = Math.ceil((-r.netProfit / (inputs.dailyOrders * inputs.workingDays)) / (inputs.dailyOrders * inputs.workingDays) * 100);
        if (priceBoost > 0 && priceBoost < 50) {
          tips.push('Raising prices by ~' + priceBoost + '% achieves break-even without more orders.');
        }
      } else {
        tips.push('Your total profit is ' + formatNumber(Math.round(r.netProfit)) + ' ' + currency + '/month. Try scaling on your best platform (' + r.bestPlatform.name + ').');
      }
      if (r.worstPlatform && r.bestPlatform && r.worstPlatform.name !== r.bestPlatform.name) {
        var diff = r.bestPlatform.monthlyProfit - r.worstPlatform.monthlyProfit;
        if (diff > 0) {
          tips.push('Gap between best (' + r.bestPlatform.name + ') and worst (' + r.worstPlatform.name + ') = ' + formatNumber(Math.round(diff)) + ' ' + currency + '/month.');
        }
      }
      if (r.breakEvenDaily > inputs.dailyOrders * 1.5) {
        tips.push('Break-even is high (' + r.breakEvenDaily + ' orders/day). Review fixed costs or profit margin.');
      }
      var openProfit = 0, closedProfit = 0;
      r.platformResults.forEach(function(p) {
        var pm = inputs.platforms.find(function(x) { return x.name === p.name; });
        if (pm) {
          if (pm.operatingModel === 'open') openProfit += p.monthlyProfit;
          else if (pm.operatingModel === 'closed') closedProfit += p.monthlyProfit;
        }
      });
      if (openProfit > closedProfit && closedProfit > 0) {
        tips.push('Open-courier model (like Mrsool) earns ' + formatNumber(Math.round(openProfit - closedProfit)) + ' ' + currency + ' more than closed-menu platforms.');
      }
      if (r.weightedFoodCostPct > 35) {
        tips.push('Food cost ratio is high (' + r.weightedFoodCostPct.toFixed(1) + '%). Ideal range is 25-30%.');
      }
      var tip = tips.length ? tips[0] : '';
      var box = document.getElementById('smartTipBox');
      var txt = document.getElementById('smartTipText');
      if (box && txt) {
        if (tip) { txt.textContent = tip; box.style.display = 'block'; }
        else { box.style.display = 'none'; }
      }
    }'''

    tip_fn = tip_fn_ar if is_ar else tip_fn_en

    # Insert generateSmartTip before formatNumber
    text = text.replace(
        '    function formatNumber(n) {',
        tip_fn + '\n\n    function formatNumber(n) {',
        1
    )

    # Add call in calculateAll after updateCharts
    old_calc_end = '''        updateResults(r);
        updateCharts(r);
        document.getElementById('scenarioSection').style.display = 'block';
        document.getElementById('sensitivitySection').style.display = 'block';
        updateSensitivityDisplay();'''

    new_calc_end = '''        updateResults(r);
        updateCharts(r);
        generateSmartTip(r);
        document.getElementById('scenarioSection').style.display = 'block';
        document.getElementById('sensitivitySection').style.display = 'block';
        updateSensitivityDisplay();'''

    text = text.replace(old_calc_end, new_calc_end)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)

    print('Updated', path)

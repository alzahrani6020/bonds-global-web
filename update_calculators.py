import re
import os

base_dir = "en/calculators"
files = [
    "cash-flow.html",
    "dish-margin.html",
    "loan.html",
    "pricing.html",
    "restaurant.html",
    "menu-engineering.html",
    "menu-engineering-simple.html",
]

total_alerts_replaced = 0
issues = []

def process_cash_flow(content, counter):
    content = content.replace(
        '<link rel="stylesheet" href="../../styles.css" />',
        '<link rel="stylesheet" href="../../styles.css" />\n  <link rel="stylesheet" href="../../calculators/shared-calculators.css" />\n  <script src="../../calculators/shared-ui.js"></script>'
    )
    alerts = [
        ("alert('حدث خطأ في الحساب: ' + err.message);", "BondsUI.toast('❌ حدث خطأ في الحساب: ' + err.message, 'error');"),
        ("alert('مكتبة Excel غير محملة. حاول تحديث الصفحة.');", "BondsUI.toast('❌ مكتبة Excel غير محملة. حاول تحديث الصفحة.', 'error');"),
        ("alert('تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.');", "BondsUI.toast('⚠️ تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.', 'warning');"),
        ("alert('حدث خطأ، حاول مرة أخرى.');", "BondsUI.toast('❌ حدث خطأ، حاول مرة أخرى.', 'error');"),
    ]
    for old, new in alerts:
        if old in content:
            content = content.replace(old, new)
            counter[0] += 1
    old_calc = """    function calculateAll() {
      try {
        var months = getMonthData();"""
    new_calc = """    function calculateAll() {
      try {
        var vOpening = BondsUI.validateField('openingBalance', { type: 'number', min: 0, label: 'Opening Balance' });
        if (!vOpening.valid) {
          BondsUI.toast('❌ ' + vOpening.errors.join(', '), 'error');
          return;
        }
        var months = getMonthData();"""
    content = content.replace(old_calc, new_calc)
    return content

def process_dish_margin(content, counter):
    content = content.replace(
        '<link rel="stylesheet" href="../../styles.css" />',
        '<link rel="stylesheet" href="../../styles.css" />\n  <link rel="stylesheet" href="../../calculators/shared-calculators.css" />\n  <script src="../../calculators/shared-ui.js"></script>'
    )
    alerts = [
        ("alert('Please fill in all fields');", "BondsUI.toast('⚠️ Please fill in all fields', 'warning');"),
        ("alert('Payout cannot be greater than selling price');", "BondsUI.toast('⚠️ Payout cannot be greater than selling price', 'warning');"),
        ("alert('✅ Correction saved locally. It will appear next to the commission in the table.');", "BondsUI.toast('✅ Correction saved locally. It will appear next to the commission in the table.', 'success');"),
        ("alert('Enter selling price first');", "BondsUI.toast('⚠️ Enter selling price first', 'warning');"),
        ("alert('Failed to load Excel');", "BondsUI.toast('❌ Failed to load Excel', 'error');"),
    ]
    for old, new in alerts:
        if old in content:
            content = content.replace(old, new)
            counter[0] += 1
    old_calc = """    function calculate() {
      var foodCost = parseFloat(document.getElementById('foodCost').value) || 0;
      var packagingCost = parseFloat(document.getElementById('packagingCost').value) || 0;
      var sellingPrice = parseFloat(document.getElementById('sellingPrice').value) || 0;
      var commissionRate = parseFloat(document.getElementById('commissionRate').value) || 0;"""
    new_calc = """    function calculate() {
      var vFood = BondsUI.validateField('foodCost', { type: 'number', min: 0, label: 'Food Cost' });
      var vPack = BondsUI.validateField('packagingCost', { type: 'number', min: 0, label: 'Packaging Cost' });
      var vPrice = BondsUI.validateField('sellingPrice', { type: 'number', min: 0, label: 'Selling Price' });
      var vComm = BondsUI.validateField('commissionRate', { type: 'number', min: 0, max: 100, label: 'Commission Rate' });
      if (!vFood.valid || !vPack.valid || !vPrice.valid || !vComm.valid) {
        var errs = [].concat(vFood.errors, vPack.errors, vPrice.errors, vComm.errors);
        BondsUI.toast('❌ ' + errs.join(', '), 'error');
        return;
      }
      var foodCost = parseFloat(document.getElementById('foodCost').value) || 0;
      var packagingCost = parseFloat(document.getElementById('packagingCost').value) || 0;
      var sellingPrice = parseFloat(document.getElementById('sellingPrice').value) || 0;
      var commissionRate = parseFloat(document.getElementById('commissionRate').value) || 0;"""
    content = content.replace(old_calc, new_calc)
    old_all = """    function calculateAllPlatforms() {
      var foodCost = parseFloat(document.getElementById('foodCost').value) || 0;
      var packagingCost = parseFloat(document.getElementById('packagingCost').value) || 0;
      var sellingPrice = parseFloat(document.getElementById('sellingPrice').value) || 0;
      if (!sellingPrice) { alert('Enter selling price first'); return; }"""
    new_all = """    function calculateAllPlatforms() {
      var vPrice = BondsUI.validateField('sellingPrice', { type: 'number', min: 0.01, label: 'Selling Price' });
      if (!vPrice.valid) {
        BondsUI.toast('⚠️ ' + vPrice.errors.join(', '), 'warning');
        return;
      }
      var foodCost = parseFloat(document.getElementById('foodCost').value) || 0;
      var packagingCost = parseFloat(document.getElementById('packagingCost').value) || 0;
      var sellingPrice = parseFloat(document.getElementById('sellingPrice').value) || 0;
      if (!sellingPrice) { BondsUI.toast('⚠️ Enter selling price first', 'warning'); return; }"""
    content = content.replace(old_all, new_all)
    return content

def process_loan(content, counter):
    content = content.replace(
        '<link rel="stylesheet" href="../../styles.css" />',
        '<link rel="stylesheet" href="../../styles.css" />\n  <link rel="stylesheet" href="../../calculators/shared-calculators.css" />\n  <script src="../../calculators/shared-ui.js"></script>'
    )
    alerts = [
        ("alert('Calculate Results أولاً قبل التصدير');", "BondsUI.toast('⚠️ Calculate Results أولاً قبل التصدير', 'warning');"),
        ("alert('مكتبة Excel غير محملة. حاول تحديث الصفحة.');", "BondsUI.toast('❌ مكتبة Excel غير محملة. حاول تحديث الصفحة.', 'error');"),
        ("alert('Calculate results first before exporting PDF');", "BondsUI.toast('⚠️ Calculate results first before exporting PDF', 'warning');"),
        ("alert('تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.');", "BondsUI.toast('⚠️ تم حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع.', 'warning');"),
        ("alert('أدخل Loan Amount');", "BondsUI.toast('⚠️ أدخل Loan Amount', 'warning');"),
        ("alert('تأكد من صحة البيانات المدخلة');", "BondsUI.toast('⚠️ تأكد من صحة البيانات المدخلة', 'warning');"),
        ("alert('Down Payment يجب أن تكون أقل من Loan Amount');", "BondsUI.toast('⚠️ Down Payment يجب أن تكون أقل من Loan Amount', 'warning');"),
        ("alert('حدث خطأ في الحساب: ' + err.message);", "BondsUI.toast('❌ حدث خطأ في الحساب: ' + err.message, 'error');"),
        ("alert('تم نسخ الرابط!');", "BondsUI.toast('✅ تم نسخ الرابط!', 'success');"),
        ("alert('حدث خطأ، حاول مرة أخرى.');", "BondsUI.toast('❌ حدث خطأ، حاول مرة أخرى.', 'error');"),
    ]
    for old, new in alerts:
        if old in content:
            content = content.replace(old, new)
            counter[0] += 1
    old_calc = """    function calculateAll() {
      try {
        var inputs = getInputs();
        if (inputs.loanAmount <= 0) {
          alert('أدخل Loan Amount');
          return;
        }
        if (inputs.interestRate < 0 || inputs.loanTerm <= 0) {
          alert('تأكد من صحة البيانات المدخلة');
          return;
        }
        if (inputs.downPayment >= inputs.loanAmount) {
          alert('Down Payment يجب أن تكون أقل من Loan Amount');
          return;
        }"""
    new_calc = """    function calculateAll() {
      try {
        var vLoan = BondsUI.validateField('loanAmount', { type: 'number', required: true, min: 1, label: 'Loan Amount' });
        var vRate = BondsUI.validateField('interestRate', { type: 'number', required: true, min: 0, label: 'Interest Rate' });
        var vTerm = BondsUI.validateField('loanTerm', { type: 'number', required: true, min: 1, label: 'Loan Term' });
        if (!vLoan.valid || !vRate.valid || !vTerm.valid) {
          var errs = [].concat(vLoan.errors, vRate.errors, vTerm.errors);
          BondsUI.toast('❌ ' + errs.join(', '), 'error');
          return;
        }
        var inputs = getInputs();
        if (inputs.loanAmount <= 0) {
          BondsUI.toast('⚠️ أدخل Loan Amount', 'warning');
          return;
        }
        if (inputs.interestRate < 0 || inputs.loanTerm <= 0) {
          BondsUI.toast('⚠️ تأكد من صحة البيانات المدخلة', 'warning');
          return;
        }
        if (inputs.downPayment >= inputs.loanAmount) {
          BondsUI.toast('⚠️ Down Payment يجب أن تكون أقل من Loan Amount', 'warning');
          return;
        }"""
    content = content.replace(old_calc, new_calc)
    return content

def process_pricing(content, counter):
    content = content.replace(
        '<link rel="stylesheet" href="../../styles.css" />',
        '<link rel="stylesheet" href="../../styles.css" />\n  <link rel="stylesheet" href="../../calculators/shared-calculators.css" />\n  <script src="../../calculators/shared-ui.js"></script>'
    )
    alerts = [
        ("alert('Calculate the results first before exporting');", "BondsUI.toast('⚠️ Calculate the results first before exporting', 'warning');"),
        ("alert('Failed to load Excel library. Please try again.');", "BondsUI.toast('❌ Failed to load Excel library. Please try again.', 'error');"),
        ("alert('Link copied!');", "BondsUI.toast('✅ Link copied!', 'success');"),
        ("alert('Please enter direct cost');", "BondsUI.toast('⚠️ Please enter direct cost', 'warning');"),
        ("alert('Profit margin must be less than 100%');", "BondsUI.toast('⚠️ Profit margin must be less than 100%', 'warning');"),
        ("alert('Calculation error: ' + err.message);", "BondsUI.toast('❌ Calculation error: ' + err.message, 'error');"),
        ("alert('An error occurred, please try again.');", "BondsUI.toast('❌ An error occurred, please try again.', 'error');"),
    ]
    for old, new in alerts:
        if old in content:
            content = content.replace(old, new)
            counter[0] += 1
    old_calc = """    function calculateAll() {
      try {
        var inputs = getInputs();
        if (inputs.direct <= 0) {
          alert('Please enter direct cost');
          return;
        }
        if (inputs.margin >= 100) {
          alert('Profit margin must be less than 100%');
          return;
        }"""
    new_calc = """    function calculateAll() {
      try {
        var vDirect = BondsUI.validateField('directCost', { type: 'number', required: true, min: 0.01, label: 'Direct Cost' });
        var vMargin = BondsUI.validateField('desiredMargin', { type: 'number', required: true, min: 0, max: 99.99, label: 'Desired Margin' });
        if (!vDirect.valid || !vMargin.valid) {
          var errs = [].concat(vDirect.errors, vMargin.errors);
          BondsUI.toast('❌ ' + errs.join(', '), 'error');
          return;
        }
        var inputs = getInputs();
        if (inputs.direct <= 0) {
          BondsUI.toast('⚠️ Please enter direct cost', 'warning');
          return;
        }
        if (inputs.margin >= 100) {
          BondsUI.toast('⚠️ Profit margin must be less than 100%', 'warning');
          return;
        }"""
    content = content.replace(old_calc, new_calc)
    return content

def process_restaurant(content, counter):
    content = content.replace(
        '<link rel="stylesheet" href="../../styles.css" />',
        '<link rel="stylesheet" href="../../styles.css" />\n  <link rel="stylesheet" href="../../calculators/shared-calculators.css" />\n  <script src="../../calculators/shared-ui.js"></script>'
    )
    alerts = [
        ("alert('This feature is available on Pro plan — click \"View Plans\"');", "BondsUI.toast('⚠️ This feature is available on Pro plan — click \"View Plans\"', 'warning');"),
        ("alert('⚠️ You have used more than 5 countries. The free plan includes 5 countries. Upgrade to Pro to unlock all 22 countries.');", "BondsUI.toast('⚠️ You have used more than 5 countries. The free plan includes 5 countries. Upgrade to Pro to unlock all 22 countries.', 'warning');"),
        ("alert('Please fill in all fields');", "BondsUI.toast('⚠️ Please fill in all fields', 'warning');"),
        ("alert('Payout cannot be greater than selling price');", "BondsUI.toast('⚠️ Payout cannot be greater than selling price', 'warning');"),
        ("alert('Enter valid price and payout');", "BondsUI.toast('⚠️ Enter valid price and payout', 'warning');"),
        ("alert('✅ Correction saved. It will appear next to the commission in the table.');", "BondsUI.toast('✅ Correction saved. It will appear next to the commission in the table.', 'success');"),
        ("alert('Enter a name for this scenario');", "BondsUI.toast('⚠️ Enter a name for this scenario', 'warning');"),
        ("alert('✅ Scenario saved');", "BondsUI.toast('✅ Scenario saved', 'success');"),
        ("alert('Add at least one dish');", "BondsUI.toast('⚠️ Add at least one dish', 'warning');"),
        ("alert('Enter daily orders');", "BondsUI.toast('⚠️ Enter daily orders', 'warning');"),
        ("alert('Calculation error: ' + err.message);", "BondsUI.toast('❌ Calculation error: ' + err.message, 'error');"),
        ("alert('Calculate results first');", "BondsUI.toast('⚠️ Calculate results first', 'warning');"),
        ("alert('Failed to load Excel');", "BondsUI.toast('❌ Failed to load Excel', 'error');"),
        ("alert('No platform selected');", "BondsUI.toast('⚠️ No platform selected', 'warning');"),
        ("alert('Sign in required to load cloud scenarios');", "BondsUI.toast('⚠️ Sign in required to load cloud scenarios', 'warning');"),
        ("alert('Scenario not found');", "BondsUI.toast('❌ Scenario not found', 'error');"),
        ("alert('Failed to load scenario');", "BondsUI.toast('❌ Failed to load scenario', 'error');"),
        ("alert('🎉 Subscribed successfully! You can now use all Pro features.');", "BondsUI.toast('✅ Subscribed successfully! You can now use all Pro features.', 'success');"),
        ("alert('Enter valid food cost and target profit');", "BondsUI.toast('⚠️ Enter valid food cost and target profit', 'warning');"),
    ]
    for old, new in alerts:
        if old in content:
            content = content.replace(old, new)
            counter[0] += 1
    old_calc = """    function calculateAll() {
      try {
        var inputs = getInputs();
        if (inputs.dishes.length === 0) { alert('Add at least one dish'); return; }
        if (inputs.dailyOrders <= 0) { alert('Enter daily orders'); return; }"""
    new_calc = """    function calculateAll() {
      try {
        var vOrders = BondsUI.validateField('dailyOrders', { type: 'number', required: true, min: 1, label: 'Daily Orders' });
        var vDays = BondsUI.validateField('workingDays', { type: 'number', required: true, min: 1, max: 31, label: 'Working Days' });
        if (!vOrders.valid || !vDays.valid) {
          var errs = [].concat(vOrders.errors, vDays.errors);
          BondsUI.toast('❌ ' + errs.join(', '), 'error');
          return;
        }
        var inputs = getInputs();
        if (inputs.dishes.length === 0) { BondsUI.toast('⚠️ Add at least one dish', 'warning'); return; }
        if (inputs.dailyOrders <= 0) { BondsUI.toast('⚠️ Enter daily orders', 'warning'); return; }"""
    content = content.replace(old_calc, new_calc)
    return content

def process_menu_engineering(content, counter):
    content = content.replace(
        '<link rel="stylesheet" href="../../styles.css" />',
        '<link rel="stylesheet" href="../../styles.css" />\n  <link rel="stylesheet" href="../../calculators/shared-calculators.css" />\n  <script src="../../calculators/shared-ui.js"></script>'
    )
    alerts = [
        ("alert('Please sign in first');", "BondsUI.toast('⚠️ Please sign in first', 'warning');"),
        ("alert('✅ All data cleared');", "BondsUI.toast('✅ All data cleared', 'success');"),
        ("alert('Error: ' + e.message);", "BondsUI.toast('❌ Error: ' + e.message, 'error');"),
        ("alert('✅ Demo data loaded! Press F5');", "BondsUI.toast('✅ Demo data loaded! Press F5', 'success');"),
        ("alert('Error loading data: ' + e.message);", "BondsUI.toast('❌ Error loading data: ' + e.message, 'error');"),
        ("alert('Enter code and name');", "BondsUI.toast('⚠️ Enter code and name', 'warning');"),
        ("alert('This platform already exists: ' + name);", "BondsUI.toast('⚠️ This platform already exists: ' + name, 'warning');"),
        ("alert('Error: ' + (error.message || JSON.stringify(error)));", "BondsUI.toast('❌ Error: ' + (error.message || JSON.stringify(error)), 'error');"),
        ("alert('Unexpected error: ' + e.message);", "BondsUI.toast('❌ Unexpected error: ' + e.message, 'error');"),
        ("alert('Enter ingredient name');", "BondsUI.toast('⚠️ Enter ingredient name', 'warning');"),
        ("alert('This ingredient already exists: ' + name);", "BondsUI.toast('⚠️ This ingredient already exists: ' + name, 'warning');"),
        ("alert('Enter dish name');", "BondsUI.toast('⚠️ Enter dish name', 'warning');"),
        ("alert('This dish already exists: ' + name);", "BondsUI.toast('⚠️ This dish already exists: ' + name, 'warning');"),
        ("alert('Select dish and ingredient');", "BondsUI.toast('⚠️ Select dish and ingredient', 'warning');"),
        ("alert('Enter a quantity greater than zero');", "BondsUI.toast('⚠️ Enter a quantity greater than zero', 'warning');"),
        ("alert('Select a dish');", "BondsUI.toast('⚠️ Select a dish', 'warning');"),
        ("alert('Error saving: ' + (error.message || JSON.stringify(error)));", "BondsUI.toast('❌ Error saving: ' + (error.message || JSON.stringify(error)), 'error');"),
    ]
    for old, new in alerts:
        if old in content:
            content = content.replace(old, new)
            counter[0] += 1
    old_add = """    const code = document.getElementById('pCode').value.trim();
    const name = document.getElementById('pName').value.trim();
    const commission = parseFloat(document.getElementById('pCommission').value) || 0;
    const service = parseFloat(document.getElementById('pService').value) || 0;
    const gateway = parseFloat(document.getElementById('pGateway').value) || 0;
    const delivery = parseFloat(document.getElementById('pDelivery').value) || 0;
    if (!code || !name) return alert('Enter code and name');"""
    new_add = """    const code = document.getElementById('pCode').value.trim();
    const name = document.getElementById('pName').value.trim();
    const commission = parseFloat(document.getElementById('pCommission').value) || 0;
    const service = parseFloat(document.getElementById('pService').value) || 0;
    const gateway = parseFloat(document.getElementById('pGateway').value) || 0;
    const delivery = parseFloat(document.getElementById('pDelivery').value) || 0;
    var vCode = BondsUI.validateField('pCode', { required: true, label: 'Platform Code' });
    var vName = BondsUI.validateField('pName', { required: true, label: 'Platform Name' });
    if (!vCode.valid || !vName.valid) {
      var errs = [].concat(vCode.errors, vName.errors);
      BondsUI.toast('⚠️ ' + errs.join(', '), 'warning');
      return;
    }
    if (!code || !name) { BondsUI.toast('⚠️ Enter code and name', 'warning'); return; }"""
    content = content.replace(old_add, new_add)
    old_ing = """    const name = document.getElementById('iName').value.trim();
    const unit = document.getElementById('iUnit').value.trim() || 'kg';
    const cost = parseFloat(document.getElementById('iCost').value) || 0;
    const category = document.getElementById('iCategory').value.trim() || 'other';
    if (!name) return alert('Enter ingredient name');"""
    new_ing = """    const name = document.getElementById('iName').value.trim();
    const unit = document.getElementById('iUnit').value.trim() || 'kg';
    const cost = parseFloat(document.getElementById('iCost').value) || 0;
    const category = document.getElementById('iCategory').value.trim() || 'other';
    var vIName = BondsUI.validateField('iName', { required: true, label: 'Ingredient Name' });
    if (!vIName.valid) {
      BondsUI.toast('⚠️ ' + vIName.errors.join(', '), 'warning');
      return;
    }
    if (!name) { BondsUI.toast('⚠️ Enter ingredient name', 'warning'); return; }"""
    content = content.replace(old_ing, new_ing)
    old_menu = """    const name = document.getElementById('mName').value.trim();
    const category = document.getElementById('mCategory').value;
    const price = parseFloat(document.getElementById('mPrice').value) || 0;
    if (!name) return alert('Enter dish name');"""
    new_menu = """    const name = document.getElementById('mName').value.trim();
    const category = document.getElementById('mCategory').value;
    const price = parseFloat(document.getElementById('mPrice').value) || 0;
    var vMName = BondsUI.validateField('mName', { required: true, label: 'Dish Name' });
    if (!vMName.valid) {
      BondsUI.toast('⚠️ ' + vMName.errors.join(', '), 'warning');
      return;
    }
    if (!name) { BondsUI.toast('⚠️ Enter dish name', 'warning'); return; }"""
    content = content.replace(old_menu, new_menu)
    old_link = """    const menuItemId = document.getElementById('cMenuItem').value;
    const ingredientId = document.getElementById('cIngredient').value;
    const qty = parseFloat(document.getElementById('cQty').value) || 0;
    const unit = document.getElementById('cUnit').value.trim() || 'g';
    if (!menuItemId || !ingredientId) return alert('Select dish and ingredient');
    if (qty <= 0) return alert('Enter a quantity greater than zero');"""
    new_link = """    const menuItemId = document.getElementById('cMenuItem').value;
    const ingredientId = document.getElementById('cIngredient').value;
    const qty = parseFloat(document.getElementById('cQty').value) || 0;
    const unit = document.getElementById('cUnit').value.trim() || 'g';
    var vQty = BondsUI.validateField('cQty', { type: 'number', required: true, min: 0.01, label: 'Quantity' });
    if (!vQty.valid) {
      BondsUI.toast('⚠️ ' + vQty.errors.join(', '), 'warning');
      return;
    }
    if (!menuItemId || !ingredientId) { BondsUI.toast('⚠️ Select dish and ingredient', 'warning'); return; }
    if (qty <= 0) { BondsUI.toast('⚠️ Enter a quantity greater than zero', 'warning'); return; }"""
    content = content.replace(old_link, new_link)
    old_sale = """    const menuItemId = document.getElementById('sMenuItem').value;
    const platformId = document.getElementById('sPlatform').value || null;
    const qty = parseInt(document.getElementById('sQty').value) || 1;
    const price = parseFloat(document.getElementById('sPrice').value) || 0;
    if (!menuItemId) return alert('Select a dish');"""
    new_sale = """    const menuItemId = document.getElementById('sMenuItem').value;
    const platformId = document.getElementById('sPlatform').value || null;
    const qty = parseInt(document.getElementById('sQty').value) || 1;
    const price = parseFloat(document.getElementById('sPrice').value) || 0;
    var vSqty = BondsUI.validateField('sQty', { type: 'number', required: true, min: 1, label: 'Quantity' });
    if (!vSqty.valid) {
      BondsUI.toast('⚠️ ' + vSqty.errors.join(', '), 'warning');
      return;
    }
    if (!menuItemId) { BondsUI.toast('⚠️ Select a dish', 'warning'); return; }"""
    content = content.replace(old_sale, new_sale)
    return content

def process_menu_engineering_simple(content, counter):
    content = content.replace(
        '</style>\n</head>',
        '</style>\n  <link rel="stylesheet" href="../../calculators/shared-calculators.css" />\n  <script src="../../calculators/shared-ui.js"></script>\n</head>'
    )
    alerts = [
        ("alert('Enter a name');", "BondsUI.toast('⚠️ Enter a name', 'warning');"),
        ("alert('This platform already exists');", "BondsUI.toast('⚠️ This platform already exists', 'warning');"),
        ("alert('This ingredient already exists');", "BondsUI.toast('⚠️ This ingredient already exists', 'warning');"),
        ("alert('This dish already exists');", "BondsUI.toast('⚠️ This dish already exists', 'warning');"),
        ("alert('Select all fields');", "BondsUI.toast('⚠️ Select all fields', 'warning');"),
        ("alert('Quantity is too large! Did you mean '+q/1000+'? Quantity = required per single dish only (e.g., 0.3 kg rice)');", "BondsUI.toast('⚠️ Quantity is too large! Did you mean '+q/1000+'? Quantity = required per single dish only (e.g., 0.3 kg rice)', 'warning');"),
        ("alert('This ingredient is already linked to this dish');", "BondsUI.toast('⚠️ This ingredient is already linked to this dish', 'warning');"),
    ]
    for old, new in alerts:
        if old in content:
            content = content.replace(old, new)
            counter[0] += 1
    return content

for fname in files:
    path = os.path.join(base_dir, fname)
    with open(path, 'r', encoding='utf-8') as f:
        original = f.read()
    
    counter = [0]
    if fname == 'cash-flow.html':
        updated = process_cash_flow(original, counter)
    elif fname == 'dish-margin.html':
        updated = process_dish_margin(original, counter)
    elif fname == 'loan.html':
        updated = process_loan(original, counter)
    elif fname == 'pricing.html':
        updated = process_pricing(original, counter)
    elif fname == 'restaurant.html':
        updated = process_restaurant(original, counter)
    elif fname == 'menu-engineering.html':
        updated = process_menu_engineering(original, counter)
    elif fname == 'menu-engineering-simple.html':
        updated = process_menu_engineering_simple(original, counter)
    else:
        updated = original
    
    if updated != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(updated)
        print(f"OK {fname}: alerts={counter[0]}")
        total_alerts_replaced += counter[0]
    else:
        print(f"NO CHANGE {fname}")
        issues.append(f"{fname}: no changes made")

print(f"TOTAL_ALERTS={total_alerts_replaced}")
if issues:
    print(f"ISSUES={len(issues)}")
    for i in issues:
        print(i)

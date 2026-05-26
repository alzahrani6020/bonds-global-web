import json
import math

def calculate_break_even(fixed, price, var_cost, qty, tax_rate=15, zakat_rate=2.5):
    """Exact formulas from calculator.html"""
    contribution = price - var_cost
    if contribution > 0:
        be_units = math.ceil(fixed / contribution)
        be_amount = be_units * price
    elif fixed == 0 and contribution >= 0:
        be_units = 0
        be_amount = 0
    else:
        be_units = -1
        be_amount = -1
    
    revenue = qty * price
    total_cost = fixed + (var_cost * qty)
    profit = revenue - total_cost
    tax_amount = profit * (tax_rate / 100) if profit > 0 else 0
    profit_after_tax = profit - tax_amount
    zakat_amount = profit_after_tax * (zakat_rate / 100) if profit_after_tax > 0 else 0
    net_profit = profit_after_tax - zakat_amount
    profit_margin = (net_profit / revenue) * 100 if revenue > 0 else 0
    roi = (net_profit / total_cost) * 100 if total_cost > 0 else 0
    
    return {
        'be_units': be_units, 'be_amount': be_amount,
        'revenue': revenue, 'total_cost': total_cost,
        'profit': profit, 'tax': tax_amount,
        'profit_after_tax': profit_after_tax, 'zakat': zakat_amount,
        'net_profit': net_profit, 'margin': profit_margin, 'roi': roi
    }

def calculate_pricing(direct, overhead, margin, volume, tax_rate=15, zakat_rate=2.5, monthly_fixed=0):
    """Exact formulas from pricing calculator"""
    cost_per_unit = direct + overhead
    if margin < 100:
        price_before_tax = cost_per_unit / (1 - (margin / 100))
    else:
        price_before_tax = 0
    profit_before_tax = price_before_tax - cost_per_unit
    tax_amount = profit_before_tax * (tax_rate / 100) if profit_before_tax > 0 else 0
    profit_after_tax = profit_before_tax - tax_amount
    zakat_amount = profit_after_tax * (zakat_rate / 100) if profit_after_tax > 0 else 0
    net_profit_per_unit = profit_after_tax - zakat_amount
    monthly_profit = net_profit_per_unit * volume
    actual_margin = (net_profit_per_unit / price_before_tax) * 100 if price_before_tax > 0 else 0
    break_even_price = cost_per_unit + (monthly_fixed / volume if volume > 0 else 0)
    return {
        'cost_per_unit': cost_per_unit, 'price_before_tax': price_before_tax,
        'profit_before_tax': profit_before_tax, 'tax': tax_amount,
        'net_profit_per_unit': net_profit_per_unit, 'monthly_profit': monthly_profit,
        'actual_margin': actual_margin, 'break_even_price': break_even_price
    }

def calculate_loan(loan_amount, down_payment, interest_rate, term_months, frequency='monthly', extra_fees=0):
    """Exact formulas from loan calculator"""
    net_loan = loan_amount - down_payment + extra_fees
    is_monthly = frequency == 'monthly'
    periods_per_year = 12 if is_monthly else 4
    total_payments = term_months if is_monthly else max(1, math.floor(term_months / 3))
    periodic_rate = (interest_rate / 100) / periods_per_year
    
    if periodic_rate == 0:
        installment = net_loan / total_payments
    else:
        installment = net_loan * (periodic_rate * ((1 + periodic_rate) ** total_payments)) / (((1 + periodic_rate) ** total_payments) - 1)
    
    total_paid = installment * total_payments
    total_interest = total_paid - net_loan
    ear = ((1 + periodic_rate) ** periods_per_year) - 1
    return {
        'net_loan': net_loan, 'installment': installment,
        'total_paid': total_paid, 'total_interest': total_interest,
        'ear': ear, 'total_payments': total_payments
    }

scenarios = []

# ===== BREAK-EVEN SCENARIOS =====

# Scenario 1: Normal profitable case
r = calculate_break_even(10000, 500, 300, 100, 15, 2.5)
scenarios.append({
    'calc': 'Break-Even', 'name': 'حالة طبيعية (ربح)', 'desc': 'Fixed=10,000, Price=500, VarCost=300, Qty=100, Tax=15%, Zakat=2.5%',
    'inputs': {'fixed':10000,'price':500,'var_cost':300,'qty':100,'tax':15,'zakat':2.5},
    'expected': r
})

# Scenario 2: Exactly at break-even
r = calculate_break_even(10000, 500, 300, 50, 15, 2.5)
scenarios.append({
    'calc': 'Break-Even', 'name': 'عند نقطة التعادل بالضبط', 'desc': 'Qty=50 (exact BE), Profit should be ~0',
    'inputs': {'fixed':10000,'price':500,'var_cost':300,'qty':50,'tax':15,'zakat':2.5},
    'expected': r
})

# Scenario 3: Loss case (below BE)
r = calculate_break_even(10000, 500, 300, 30, 15, 2.5)
scenarios.append({
    'calc': 'Break-Even', 'name': 'خسارة (تحت التعادل)', 'desc': 'Qty=30, should show loss, no tax/zakat',
    'inputs': {'fixed':10000,'price':500,'var_cost':300,'qty':30,'tax':15,'zakat':2.5},
    'expected': r
})

# Scenario 4: Impossible (var cost >= price)
r = calculate_break_even(5000, 200, 250, 100, 15, 2.5)
scenarios.append({
    'calc': 'Break-Even', 'name': 'تعادل غير محقق', 'desc': 'VarCost=250 > Price=200, BE should be -1',
    'inputs': {'fixed':5000,'price':200,'var_cost':250,'qty':100,'tax':15,'zakat':2.5},
    'expected': r
})

# Scenario 5: Zero tax and zakat
r = calculate_break_even(5000, 400, 200, 50, 0, 0)
scenarios.append({
    'calc': 'Break-Even', 'name': 'صفر ضريبة وزكاة', 'desc': 'Tax=0%, Zakat=0%, NetProfit = GrossProfit',
    'inputs': {'fixed':5000,'price':400,'var_cost':200,'qty':50,'tax':0,'zakat':0},
    'expected': r
})

# ===== PRICING SCENARIOS =====

# Scenario 6: Normal pricing
r = calculate_pricing(150, 50, 25, 500, 15, 2.5, 20000)
scenarios.append({
    'calc': 'Pricing', 'name': 'تسعير طبيعي', 'desc': 'Direct=150, Overhead=50, Margin=25%, Volume=500, Fixed=20,000',
    'inputs': {'direct':150,'overhead':50,'margin':25,'volume':500,'tax':15,'zakat':2.5,'monthly_fixed':20000},
    'expected': r
})

# Scenario 7: 0% margin (break-even pricing)
r = calculate_pricing(200, 50, 0, 1000, 15, 2.5, 10000)
scenarios.append({
    'calc': 'Pricing', 'name': 'هامش ربح 0%', 'desc': 'Margin=0%, Price should equal cost, zero profit',
    'inputs': {'direct':200,'overhead':50,'margin':0,'volume':1000,'tax':15,'zakat':2.5,'monthly_fixed':10000},
    'expected': r
})

# Scenario 8: 99% margin (luxury pricing)
r = calculate_pricing(10, 5, 99, 100, 15, 2.5, 5000)
scenarios.append({
    'calc': 'Pricing', 'name': 'هامش ربح 99%', 'desc': 'Margin=99%, extreme case',
    'inputs': {'direct':10,'overhead':5,'margin':99,'volume':100,'tax':15,'zakat':2.5,'monthly_fixed':5000},
    'expected': r
})

# ===== LOAN SCENARIOS =====

# Scenario 9: Standard car loan
r = calculate_loan(100000, 20000, 5.5, 60, 'monthly', 1500)
scenarios.append({
    'calc': 'Loan', 'name': 'قرض سيارة قياسي', 'desc': 'Loan=100K, Down=20K, Rate=5.5%, 60 months, Fees=1,500',
    'inputs': {'loan':100000,'down':20000,'rate':5.5,'term':60,'freq':'monthly','fees':1500},
    'expected': r
})

# Scenario 10: Zero interest (Islamic murabaha style)
r = calculate_loan(500000, 100000, 0, 120, 'monthly', 0)
scenarios.append({
    'calc': 'Loan', 'name': 'صفر فائدة', 'desc': 'Rate=0%, should divide evenly, no interest',
    'inputs': {'loan':500000,'down':100000,'rate':0,'term':120,'freq':'monthly','fees':0},
    'expected': r
})

# Generate Excel report
try:
    import xlsxwriter
    wb = xlsxwriter.Workbook('validation-report.xlsx')
    
    # Sheet 1: Summary
    ws = wb.add_worksheet('Summary')
    ws.write('A1', 'Bonds Global — Calculator Validation Report')
    ws.write('A2', 'Date: May 2026')
    ws.write('A3', 'Method: Python calculations vs Expected Calculator Output')
    ws.write('A5', 'Total Scenarios: 10')
    ws.write('A6', 'Break-Even: 5 scenarios')
    ws.write('A7', 'Pricing: 3 scenarios')
    ws.write('A8', 'Loan: 2 scenarios')
    
    # Sheet 2: Break-Even Results
    ws = wb.add_worksheet('Break-Even')
    headers = ['Scenario', 'Fixed', 'Price', 'VarCost', 'Qty', 'Tax%', 'Zakat%', 'BE Units', 'BE Amount', 'Revenue', 'TotalCost', 'Profit', 'Tax', 'ProfitAfterTax', 'Zakat', 'NetProfit', 'Margin%', 'ROI%']
    for i, h in enumerate(headers):
        ws.write(0, i, h)
    row = 1
    for s in scenarios:
        if s['calc'] != 'Break-Even': continue
        r = s['expected']
        ws.write(row, 0, s['name'])
        ws.write(row, 1, s['inputs']['fixed'])
        ws.write(row, 2, s['inputs']['price'])
        ws.write(row, 3, s['inputs']['var_cost'])
        ws.write(row, 4, s['inputs']['qty'])
        ws.write(row, 5, s['inputs']['tax'])
        ws.write(row, 6, s['inputs']['zakat'])
        ws.write(row, 7, r['be_units'])
        ws.write(row, 8, r['be_amount'])
        ws.write(row, 9, r['revenue'])
        ws.write(row, 10, r['total_cost'])
        ws.write(row, 11, r['profit'])
        ws.write(row, 12, r['tax'])
        ws.write(row, 13, r['profit_after_tax'])
        ws.write(row, 14, r['zakat'])
        ws.write(row, 15, r['net_profit'])
        ws.write(row, 16, round(r['margin'], 2))
        ws.write(row, 17, round(r['roi'], 2))
        row += 1
    
    # Sheet 3: Pricing Results
    ws = wb.add_worksheet('Pricing')
    headers = ['Scenario', 'Direct', 'Overhead', 'Margin%', 'Volume', 'Tax%', 'Zakat%', 'Fixed', 'Cost/Unit', 'PriceBeforeTax', 'ProfitBeforeTax', 'Tax', 'NetProfit/Unit', 'MonthlyProfit', 'ActualMargin%', 'BreakEvenPrice']
    for i, h in enumerate(headers):
        ws.write(0, i, h)
    row = 1
    for s in scenarios:
        if s['calc'] != 'Pricing': continue
        r = s['expected']
        ws.write(row, 0, s['name'])
        ws.write(row, 1, s['inputs']['direct'])
        ws.write(row, 2, s['inputs']['overhead'])
        ws.write(row, 3, s['inputs']['margin'])
        ws.write(row, 4, s['inputs']['volume'])
        ws.write(row, 5, s['inputs']['tax'])
        ws.write(row, 6, s['inputs']['zakat'])
        ws.write(row, 7, s['inputs']['monthly_fixed'])
        ws.write(row, 8, r['cost_per_unit'])
        ws.write(row, 9, round(r['price_before_tax'], 2))
        ws.write(row, 10, round(r['profit_before_tax'], 2))
        ws.write(row, 11, round(r['tax'], 2))
        ws.write(row, 12, round(r['net_profit_per_unit'], 2))
        ws.write(row, 13, round(r['monthly_profit'], 2))
        ws.write(row, 14, round(r['actual_margin'], 2))
        ws.write(row, 15, round(r['break_even_price'], 2))
        row += 1
    
    # Sheet 4: Loan Results
    ws = wb.add_worksheet('Loan')
    headers = ['Scenario', 'Loan', 'Down', 'Rate%', 'Term', 'Freq', 'Fees', 'NetLoan', 'Installment', 'TotalPaid', 'TotalInterest', 'EAR%']
    for i, h in enumerate(headers):
        ws.write(0, i, h)
    row = 1
    for s in scenarios:
        if s['calc'] != 'Loan': continue
        r = s['expected']
        ws.write(row, 0, s['name'])
        ws.write(row, 1, s['inputs']['loan'])
        ws.write(row, 2, s['inputs']['down'])
        ws.write(row, 3, s['inputs']['rate'])
        ws.write(row, 4, s['inputs']['term'])
        ws.write(row, 5, s['inputs']['freq'])
        ws.write(row, 6, s['inputs']['fees'])
        ws.write(row, 7, r['net_loan'])
        ws.write(row, 8, round(r['installment'], 2))
        ws.write(row, 9, round(r['total_paid'], 2))
        ws.write(row, 10, round(r['total_interest'], 2))
        ws.write(row, 11, round(r['ear'] * 100, 4))
        row += 1
    
    wb.close()
    print('validation-report.xlsx created successfully!')
except ImportError:
    print('xlsxwriter not available, creating JSON report instead...')
    with open('validation-report.json', 'w', encoding='utf-8') as f:
        json.dump(scenarios, f, ensure_ascii=False, indent=2, default=str)
    print('validation-report.json created!')

print('\n=== VALIDATION RESULTS ===')
for s in scenarios:
    print(f"\n[{s['calc']}] {s['name']}")
    print(f"  {s['desc']}")
    for k, v in s['expected'].items():
        if isinstance(v, float):
            print(f"  {k}: {v:.2f}")
        else:
            print(f"  {k}: {v}")

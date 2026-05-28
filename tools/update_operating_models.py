#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Add operatingModel to every platform in country-platforms-data.js
and add missing platforms for SA & EG.
Handles nested braces correctly.
"""
import re

INPUT = 'calculators/country-platforms-data.js'

OPEN_IDS = {
    'plat_mrsoul',
    'plat_wssel',
    'plat_indrive',
}
SUBSCRIPTION_IDS = {
    'plat_daily_mealz',
    'plat_calo',
    'plat_freshhouse',
    'plat_right_bite',
}
DIRECT_IDS = {'plat_direct'}

def classify(pid):
    if pid in OPEN_IDS:
        return 'open'
    if pid in SUBSCRIPTION_IDS:
        return 'subscription'
    if pid in DIRECT_IDS:
        return 'direct'
    return 'closed'

def find_platform_objects(text):
    """Find all platform objects using brace counting."""
    results = []
    i = 0
    while i < len(text):
        # look for pattern: { id: 'plat_
        m = re.search(r"\{\s*id:\s*'plat_", text[i:])
        if not m:
            break
        start = i + m.start()
        # find matching closing brace
        depth = 0
        end = start
        while end < len(text):
            if text[end] == '{':
                depth += 1
            elif text[end] == '}':
                depth -= 1
                if depth == 0:
                    end += 1
                    break
            end += 1
        results.append((start, end, text[start:end]))
        i = end
    return results

def process_platform_obj(body):
    """Add operatingModel if missing, classify by id."""
    if 'operatingModel' in body:
        return body
    m = re.search(r"id:\s*'([^']+)'", body)
    pid = m.group(1) if m else 'unknown'
    opm = classify(pid)
    # insert after id field
    body = re.sub(
        r"(id:\s*'[^']+',)",
        r"\1 operatingModel: '{}',".format(opm),
        body,
        count=1
    )
    return body

with open(INPUT, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Process all existing platform objects
objs = find_platform_objects(text)
for start, end, body in reversed(objs):
    new_body = process_platform_obj(body)
    text = text[:start] + new_body + text[end:]

# 2. Add missing platforms for Saudi Arabia (before plat_direct in SA block)
SA_NEW = """      { id: 'plat_nana', name: 'نعناع', nameEn: 'Nana', operatingModel: 'closed', fee: 22, confidence: 'estimated', serviceFee: 0, paymentGatewayFee: 0 },
      { id: 'plat_mr_mandob', name: 'مستر مندوب', nameEn: 'Mr Mandob', operatingModel: 'open', fee: 12, confidence: 'estimated', serviceFee: 0, paymentGatewayFee: 0 },
"""
# Find plat_direct in SA section (before AE:)
text = re.sub(
    r"(    platforms: \[\s*\n)(.*?)(\s*\{ id: 'plat_direct'.*?\},\s*\n)(\s*\],\s*\n\s*note: 'هنقرستيション)",
    lambda m: m.group(1) + m.group(2) + SA_NEW + m.group(3) + m.group(4),
    text,
    flags=re.DOTALL
)

# 3. Add missing platforms for Egypt (before plat_direct in EG block)
EG_NEW = """      { id: 'plat_rabbit', name: 'رابت', nameEn: 'Rabbit', operatingModel: 'closed', fee: 18, confidence: 'estimated', serviceFee: 0, paymentGatewayFee: 0, campaignDiscount: 0 },
      { id: 'plat_breadfast', name: 'بريدفاست', nameEn: 'Breadfast', operatingModel: 'closed', fee: 15, confidence: 'estimated', serviceFee: 0, paymentGatewayFee: 0, campaignDiscount: 0 },
      { id: 'plat_indrive', name: 'إندرايف توصيل', nameEn: 'inDrive Delivery', operatingModel: 'open', fee: 10, confidence: 'estimated', serviceFee: 0, paymentGatewayFee: 0, campaignDiscount: 0 },
"""
text = re.sub(
    r"(    platforms: \[\s*\n)(.*?)(\s*\{ id: 'plat_direct'.*?\},\s*\n)(\s*\],\s*\n\s*note: 'طلبات هي السائد)",
    lambda m: m.group(1) + m.group(2) + EG_NEW + m.group(3) + m.group(4),
    text,
    flags=re.DOTALL
)

with open(INPUT, 'w', encoding='utf-8') as f:
    f.write(text)

print('Done. Platforms processed:', len(objs))

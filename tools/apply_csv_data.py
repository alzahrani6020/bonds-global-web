#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Apply platform data from CSV template to country-platforms-data.js
"""
import csv, re

INPUT_JS = 'calculators/country-platforms-data.js'
INPUT_CSV = 'templates/platform-data-template.csv'

with open(INPUT_JS, 'r', encoding='utf-8') as f:
    js_text = f.read()

with open(INPUT_CSV, 'r', encoding='utf-8') as f:
    csv_rows = list(csv.DictReader(f))

# Group CSV rows by country
csv_by_country = {}
for row in csv_rows:
    cid = row['country_code']
    if cid not in csv_by_country:
        csv_by_country[cid] = []
    csv_by_country[cid].append(row)

def find_country_block(text, country_code):
    """Find the start/end of a country block in JS."""
    pattern = rf"({country_code}:\s*\{{)"
    m = re.search(pattern, text)
    if not m:
        return None, None
    start = m.start()
    # Find matching closing brace for the country object
    depth = 0
    i = start
    while i < len(text):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return start, i + 1
        i += 1
    return start, len(text)

def update_platform_in_block(block, row):
    """Update a single platform object inside a country block."""
    pid = row['platform_id']
    
    # Find the platform object
    pattern = rf"(id:\s*'{re.escape(pid)}',)"
    m = re.search(pattern, block)
    if not m:
        return block, False  # not found
    
    obj_start = block.rfind('{', 0, m.start())
    if obj_start == -1:
        return block, False
    
    # Find matching closing brace
    depth = 0
    obj_end = obj_start
    while obj_end < len(block):
        if block[obj_end] == '{':
            depth += 1
        elif block[obj_end] == '}':
            depth -= 1
            if depth == 0:
                obj_end += 1
                break
        obj_end += 1
    
    old_obj = block[obj_start:obj_end]
    
    # Build new object
    parts = [f"{{ id: '{pid}'"]
    
    # operatingModel
    if row.get('operating_model'):
        parts.append(f"operatingModel: '{row['operating_model']}'")
    
    # name
    if row.get('platform_name_ar'):
        parts.append(f"name: '{row['platform_name_ar']}'")
    
    # nameEn
    if row.get('platform_name_en'):
        parts.append(f"nameEn: '{row['platform_name_en']}'")
    
    # fee
    if row.get('fee_percent'):
        parts.append(f"fee: {row['fee_percent']}")
    
    # confidence
    if row.get('confidence'):
        parts.append(f"confidence: '{row['confidence']}'")
    
    # freeDelivery
    threshold = row.get('free_delivery_threshold', '')
    share = row.get('free_delivery_restaurant_share', '')
    if threshold and share:
        parts.append(f"freeDelivery: {{ threshold: {threshold}, restaurantShare: {share} }}")
    
    # serviceFee
    sf = row.get('service_fee_percent', '')
    if sf and sf != '0':
        parts.append(f"serviceFee: {sf}")
    
    # paymentGatewayFee
    pg = row.get('payment_gateway_fee_percent', '')
    if pg and pg != '0':
        parts.append(f"paymentGatewayFee: {pg}")
    
    # campaignDiscount
    cd = row.get('campaign_discount_percent', '')
    if cd and cd != '0':
        parts.append(f"campaignDiscount: {cd}")
    
    new_obj = ', '.join(parts) + ' }'
    
    block = block[:obj_start] + new_obj + block[obj_end:]
    return block, True

def add_platform_to_block(block, row):
    """Add a new platform object before plat_direct in a country block."""
    pid = row['platform_id']
    
    # Find plat_direct
    m = re.search(r"(id:\s*'plat_direct'.*?)\}", block)
    if not m:
        return block, False
    
    insert_pos = m.start()
    
    # Build new object
    parts = [f"{{ id: '{pid}'"]
    if row.get('operating_model'):
        parts.append(f"operatingModel: '{row['operating_model']}'")
    if row.get('platform_name_ar'):
        parts.append(f"name: '{row['platform_name_ar']}'")
    if row.get('platform_name_en'):
        parts.append(f"nameEn: '{row['platform_name_en']}'")
    if row.get('fee_percent'):
        parts.append(f"fee: {row['fee_percent']}")
    if row.get('confidence'):
        parts.append(f"confidence: '{row['confidence']}'")
    
    threshold = row.get('free_delivery_threshold', '')
    share = row.get('free_delivery_restaurant_share', '')
    if threshold and share:
        parts.append(f"freeDelivery: {{ threshold: {threshold}, restaurantShare: {share} }}")
    
    sf = row.get('service_fee_percent', '')
    if sf and sf != '0':
        parts.append(f"serviceFee: {sf}")
    pg = row.get('payment_gateway_fee_percent', '')
    if pg and pg != '0':
        parts.append(f"paymentGatewayFee: {pg}")
    cd = row.get('campaign_discount_percent', '')
    if cd and cd != '0':
        parts.append(f"campaignDiscount: {cd}")
    
    new_obj = ', '.join(parts) + ' },\n      '
    
    block = block[:insert_pos] + new_obj + block[insert_pos:]
    return block, True

# Process each country
updated_countries = []
added_platforms = []

for cid, rows in csv_by_country.items():
    start, end = find_country_block(js_text, cid)
    if start is None:
        print(f'Country {cid} not found')
        continue
    
    block = js_text[start:end]
    original_block = block
    
    for row in rows:
        pid = row['platform_id']
        block, found = update_platform_in_block(block, row)
        if not found:
            block, added = add_platform_to_block(block, row)
            if added:
                added_platforms.append(f'{cid}/{pid}')
        else:
            updated_countries.append(f'{cid}/{pid}')
    
    js_text = js_text[:start] + block + js_text[end:]

with open(INPUT_JS, 'w', encoding='utf-8') as f:
    f.write(js_text)

print(f'Updated: {len(updated_countries)} platforms')
print(f'Added: {len(added_platforms)} platforms')
if added_platforms:
    for p in added_platforms:
        print('  +', p)

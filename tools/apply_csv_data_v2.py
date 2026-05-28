#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Apply platform fee updates from CSV to country-platforms-data.js
Preserves existing fields like feeTiers, deliverySupport, etc.
Only updates: fee, serviceFee, paymentGatewayFee, campaignDiscount, operatingModel, confidence
Adds missing platforms.
"""
import csv, re

INPUT_JS = 'calculators/country-platforms-data.js'
INPUT_CSV = 'templates/platform-data-template.csv'

with open(INPUT_JS, 'r', encoding='utf-8') as f:
    js_text = f.read()

with open(INPUT_CSV, 'r', encoding='utf-8') as f:
    csv_rows = list(csv.DictReader(f))

def find_platform_objects(text):
    """Find all platform objects with brace counting."""
    results = []
    i = 0
    while i < len(text):
        m = re.search(r"\{\s*id:\s*'plat_", text[i:])
        if not m:
            break
        start = i + m.start()
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

def update_field(body, field, value, is_string=False):
    """Update or add a field in a platform object body."""
    if is_string:
        pattern = rf"{field}:\s*'[^']*'"
        replacement = f"{field}: '{value}'"
    else:
        pattern = rf"{field}:\s*[^,}}]+"
        replacement = f"{field}: {value}"
    
    if re.search(pattern, body):
        body = re.sub(pattern, replacement, body)
    else:
        # Add before the closing brace
        body = body.rstrip()[:-1] + f", {replacement}" + body[-1:]
    return body

def remove_field(body, field):
    """Remove a field if it exists."""
    pattern = rf",?\s*{field}:\s*[^,}}]+"
    body = re.sub(pattern, '', body)
    return body

# Build map of existing platforms
objs = find_platform_objects(js_text)
obj_map = {}  # (start, end, body)
for start, end, body in objs:
    m = re.search(r"id:\s*'([^']+)'", body)
    if m:
        obj_map[m.group(1)] = (start, end, body)

# Process CSV rows
csv_map = {}
for row in csv_rows:
    pid = row['platform_id']
    csv_map[pid] = row

# Track changes
updated = []
added = []

# First pass: update existing platforms
for pid, (start, end, body) in list(obj_map.items()):
    if pid not in csv_map:
        continue
    
    row = csv_map[pid]
    new_body = body
    
    # Update fee
    if row.get('fee_percent'):
        new_body = update_field(new_body, 'fee', row['fee_percent'])
    
    # Update operatingModel
    if row.get('operating_model'):
        new_body = update_field(new_body, 'operatingModel', row['operating_model'], is_string=True)
    
    # Update confidence
    if row.get('confidence'):
        new_body = update_field(new_body, 'confidence', row['confidence'], is_string=True)
    
    # Update serviceFee (add or remove)
    sf = row.get('service_fee_percent', '')
    if sf and sf != '0':
        new_body = update_field(new_body, 'serviceFee', sf)
    else:
        new_body = remove_field(new_body, 'serviceFee')
    
    # Update paymentGatewayFee (add or remove)
    pg = row.get('payment_gateway_fee_percent', '')
    if pg and pg != '0':
        new_body = update_field(new_body, 'paymentGatewayFee', pg)
    else:
        new_body = remove_field(new_body, 'paymentGatewayFee')
    
    # Update campaignDiscount (add or remove)
    cd = row.get('campaign_discount_percent', '')
    if cd and cd != '0':
        new_body = update_field(new_body, 'campaignDiscount', cd)
    else:
        new_body = remove_field(new_body, 'campaignDiscount')
    
    # Update freeDelivery if both values are non-zero
    threshold = row.get('free_delivery_threshold', '')
    share = row.get('free_delivery_restaurant_share', '')
    if threshold and share and threshold != '0':
        new_body = update_field(new_body, 'freeDelivery', f"{{ threshold: {threshold}, restaurantShare: {share} }}")
    else:
        new_body = remove_field(new_body, 'freeDelivery')
    
    # Clean up any double commas or spaces
    new_body = re.sub(r',\s*,', ',', new_body)
    new_body = re.sub(r'\{\s*,', '{', new_body)
    new_body = re.sub(r',\s*\}', '}', new_body)
    
    js_text = js_text[:start] + new_body + js_text[end:]
    
    # Update offsets for subsequent objects
    if new_body != body:
        updated.append(pid)
    objs = find_platform_objects(js_text)
    obj_map = {}
    for s, e, b in objs:
        m = re.search(r"id:\s*'([^']+)'", b)
        if m:
            obj_map[m.group(1)] = (s, e, b)

# Second pass: add missing platforms
for pid, row in csv_map.items():
    if pid in obj_map:
        continue  # already exists
    
    # Find the country's plat_direct to insert before it
    cid = row['country_code']
    # Find country block
    country_pattern = rf"({cid}:\s*\{{)"
    m = re.search(country_pattern, js_text)
    if not m:
        continue
    
    # Find plat_direct within this country block
    block_start = m.start()
    # Find end of country block
    depth = 0
    block_end = block_start
    while block_end < len(js_text):
        if js_text[block_end] == '{':
            depth += 1
        elif js_text[block_end] == '}':
            depth -= 1
            if depth == 0:
                break
        block_end += 1
    
    country_block = js_text[block_start:block_end]
    
    # Find plat_direct in this block
    dm = re.search(r"(\s*\{ id: 'plat_direct'.*?)\}", country_block)
    if not dm:
        continue
    
    insert_rel = dm.start()
    abs_insert = block_start + insert_rel
    
    # Build new platform object
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
    if threshold and share and threshold != '0':
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
    
    js_text = js_text[:abs_insert] + new_obj + js_text[abs_insert:]
    added.append(pid)
    
    # Rebuild map
    objs = find_platform_objects(js_text)
    obj_map = {}
    for s, e, b in objs:
        m = re.search(r"id:\s*'([^']+)'", b)
        if m:
            obj_map[m.group(1)] = (s, e, b)

with open(INPUT_JS, 'w', encoding='utf-8') as f:
    f.write(js_text)

print(f'Updated: {len(updated)} platforms')
if updated:
    for p in updated[:20]:
        print('  ~', p)
    if len(updated) > 20:
        print(f'  ... and {len(updated)-20} more')

print(f'Added: {len(added)} platforms')
if added:
    for p in added:
        print('  +', p)

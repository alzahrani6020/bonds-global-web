import requests
from bs4 import BeautifulSoup
import json
import time
import re

base_url = "https://modon.gov.sa"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

products = []

# Main products page
print("Fetching main products page...")
resp = requests.get(f"{base_url}/ar/Products/Pages/default.aspx", headers=headers, timeout=30)
resp.encoding = 'utf-8'
soup = BeautifulSoup(resp.text, 'html.parser')

# Find all product links
links = soup.find_all('a', href=re.compile(r'/ar/Products/.*'))
seen = set()
for a in links:
    href = a.get('href', '')
    if not href or href in seen:
        continue
    seen.add(href)
    title = a.get_text(strip=True)
    if title and len(title) > 3:
        products.append({
            'title': title,
            'url': href if href.startswith('http') else base_url + href,
            'description': ''
        })

print(f"Found {len(products)} product links")

# Fetch each product page for description
for i, p in enumerate(products[:20]):  # Limit to 20 to avoid blocking
    try:
        print(f"Fetching {i+1}/{min(20,len(products))}: {p['title']}")
        r = requests.get(p['url'], headers=headers, timeout=15)
        r.encoding = 'utf-8'
        s = BeautifulSoup(r.text, 'html.parser')
        # Try to find description
        desc = ''
        for selector in ['.product-desc', '.page-content', '#DeltaPlaceHolderMain', '.ms-rteElement-P']:
            el = s.select_one(selector)
            if el:
                desc = el.get_text(separator=' ', strip=True)[:300]
                break
        p['description'] = desc
        time.sleep(1)
    except Exception as e:
        print(f"Error: {e}")
        p['description'] = ''

# Save
with open('modon_products.json', 'w', encoding='utf-8') as f:
    json.dump(products, f, ensure_ascii=False, indent=2)

print(f"\nSaved {len(products)} products to modon_products.json")

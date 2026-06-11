import os
import re

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

AUTH_SCRIPTS = """  <script src="/api/env"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="/bonds-auth-2026.js"></script>
"""

files_to_patch = [
    "about.html",
    "blog/break-even-explained.html",
    "blog/cash-flow-mistakes.html",
    "blog/en/break-even-explained.html",
    "blog/en/cash-flow-mistakes.html",
    "blog/en/financial-kpis.html",
    "blog/en/index.html",
    "blog/en/pricing-strategy.html",
    "blog/en/tax-zakat-sme.html",
    "blog/financial-kpis.html",
    "blog/index.html",
    "blog/pricing-strategy.html",
    "blog/tax-zakat-sme.html",
    "calculators/cash-flow.html",
    "calculators/loan.html",
    "calculators/pricing.html",
    "calculators/restaurant.html",
    "contact.html",
    "en/about.html",
    "en/calculator.html",
    "en/calculators/cash-flow.html",
    "en/calculators/loan.html",
    "en/calculators/pricing.html",
    "en/calculators/restaurant.html",
    "en/contact.html",
    "en/faq.html",
    "en/methodology.html",
    "en/pricing.html",
    "en/privacy.html",
    "en/services.html",
    "en/terms.html",
    "faq.html",
    "methodology.html",
    "pricing.html",
    "privacy.html",
    "services.html",
    "terms.html",
]

patched = []
skipped = []

for rel_path in files_to_patch:
    full_path = os.path.join(BASE_DIR, rel_path)
    if not os.path.exists(full_path):
        skipped.append(f"{rel_path} (not found)")
        continue

    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()

    if "bonds-auth-2026.js" in content:
        skipped.append(f"{rel_path} (already has auth)")
        continue

    if "</body>" not in content:
        skipped.append(f"{rel_path} (no </body>)")
        continue

    # Insert before </body>
    new_content = content.replace("</body>", AUTH_SCRIPTS + "</body>", 1)

    with open(full_path, "w", encoding="utf-8") as f:
        f.write(new_content)

    patched.append(rel_path)

print(f"Patched {len(patched)} files:")
for p in patched:
    print(f"  + {p}")

if skipped:
    print(f"\nSkipped {len(skipped)} files:")
    for s in skipped:
        print(f"  - {s}")

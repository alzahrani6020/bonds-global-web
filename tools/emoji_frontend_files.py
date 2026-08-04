import os, re
from pathlib import Path
emoji_pat = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0001F000-\U0001F2FF"
    "\U0001F600-\U0001F64F"
    "\U0001F680-\U0001F6FF"
    "\U0001F1E0-\U0001F1FF"
    "\U00002702-\U000027B0"
    "\U000024C2-\U0001F251"
    "]+"
)
roots = ['admin','auth-guard.js','bonds-auth-2026.js','calculator-wizard.js','calculators','components','en/v3','lib/ai','site-layout.js','valuation','v3']
files=[]
for r in roots:
    base=Path(r)
    if not base.exists(): continue
    for path in (base.rglob('*.js') if base.is_dir() else [base]):
        if path.suffix!='.js': continue
        # skip data/script files explicitly
        rel=str(path).replace('\\','/')
        if 'calculators/platform-data/' in rel or 'calculators/geo-data/' in rel or 'calculators/shared-platforms.js' in rel:
            continue
        try:
            text=path.read_text(encoding='utf-8')
        except Exception:
            continue
        if emoji_pat.search(text):
            files.append(rel)
print('count', len(files))
for f in sorted(files): print(f)

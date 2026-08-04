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
js_files=[]
css_files=[]
for root,dirs,files in os.walk('.'):
    if any(x in root for x in ['node_modules','.git','.vercel','.tmp-pdf','.github']):
        continue
    for f in files:
        if f.endswith('.js'):
            path=Path(root)/f
            try:
                text=path.read_text(encoding='utf-8')
            except Exception:
                continue
            if emoji_pat.search(text):
                js_files.append(str(path).replace('\\','/'))
        elif f.endswith('.css'):
            path=Path(root)/f
            try:
                text=path.read_text(encoding='utf-8')
            except Exception:
                continue
            if emoji_pat.search(text):
                css_files.append(str(path).replace('\\','/'))
print('JS files:', len(js_files))
for p in sorted(js_files):
    print(p)
print('\nCSS files:', len(css_files))
for p in sorted(css_files):
    print(p)

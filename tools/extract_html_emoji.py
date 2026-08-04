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
unique=set()
for root,dirs,files in os.walk('.'):
    if any(x in root for x in ['node_modules','.git','.vercel','.tmp-pdf','.github']): continue
    for f in files:
        if not f.endswith('.html'): continue
        path=Path(root)/f
        try: text=path.read_text(encoding='utf-8')
        except: continue
        for m in re.findall(r'data-emoji="([^"]+)"', text):
            for e in emoji_pat.findall(m):
                unique.add(e)
        for m in re.findall(r'data-icon="([^"]+)"', text):
            for e in emoji_pat.findall(m):
                unique.add(e)
Path('tools/html_emoji_list.txt').write_text('\n'.join([f'count {len(unique)}']+sorted(unique)), encoding='utf-8')
print('wrote tools/html_emoji_list.txt count', len(unique))

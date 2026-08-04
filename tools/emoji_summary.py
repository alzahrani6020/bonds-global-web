import os, re, sys
from pathlib import Path
from collections import Counter, defaultdict
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
file_emojis=defaultdict(list)
all_emojis=Counter()
for root,dirs,files in os.walk('.'):
    if any(x in root for x in ['node_modules','.git','.vercel','.tmp-pdf','.github']):
        continue
    for f in files:
        if not (f.endswith('.js') or f.endswith('.css')): continue
        path=Path(root)/f
        try:
            text=path.read_text(encoding='utf-8')
        except Exception:
            continue
        found=set(emoji_pat.findall(text))
        if found:
            rel=str(path).replace('\\','/')
            file_emojis[rel]=sorted(found)
            for e in found:
                all_emojis[e]+=1
lines=[]
lines.append('=== Unique emojis (count) ===')
for e,c in all_emojis.most_common():
    lines.append(f'{e} : {c}')
lines.append('\n=== Files ===')
for f in sorted(file_emojis):
    lines.append(f'{f}: {file_emojis[f]}')
Path('tools/emoji_summary.txt').write_text('\n'.join(lines), encoding='utf-8')
print('wrote tools/emoji_summary.txt')

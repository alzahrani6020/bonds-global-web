#!/usr/bin/env python3
"""
Add paid-tier subscription gate to feasibility and creditworthiness pages.
Adds auth-guard.js (if missing) and calls requireTier('paidCalculators').
"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

TARGETS = [
    'calculators/feasibility.html',
    'calculators/feasibility-template.html',
    'calculators/feasibility-template-real-estate.html',
    'calculators/manufacturing-feasibility.html',
    'en/calculators/feasibility.html',
    'en/calculators/feasibility-template.html',
    'en/calculators/feasibility-template-real-estate.html',
    'calculators/creditworthiness.html',
    'en/calculators/creditworthiness.html',
]

PAID_GATE_SCRIPT = '''<script>
  // Paid-tier gate for feasibility / creditworthiness features
  (function () {
    function runGate() {
      if (typeof window.requireTier === 'function') {
        window.requireTier('paidCalculators');
      } else {
        setTimeout(runGate, 100);
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runGate);
    } else {
      runGate();
    }
  })();
</script>
'''

AUTH_GUARD_SCRIPT = '  <script src="/auth-guard.js"></script>\n'


def process_file(rel_path):
    full_path = ROOT / rel_path
    if not full_path.exists():
        print(f'Skip (missing): {rel_path}')
        return False

    content = full_path.read_text(encoding='utf-8')
    changed = False

    if 'auth-guard.js' not in content:
        # Insert before closing </head>
        if '</head>' in content:
            content = content.replace('</head>', AUTH_GUARD_SCRIPT + '</head>', 1)
            changed = True
        else:
            print(f'Warning: no </head> in {rel_path}')

    if 'requireTier(\'paidCalculators\')' not in content and 'requireTier("paidCalculators")' not in content:
        # Insert before closing </body> if present, otherwise append
        if '</body>' in content:
            content = content.replace('</body>', PAID_GATE_SCRIPT + '</body>', 1)
        else:
            content = content + '\n' + PAID_GATE_SCRIPT
        changed = True

    if changed:
        full_path.write_text(content, encoding='utf-8')
        print(f'Updated: {rel_path}')
        return True
    else:
        print(f'No changes: {rel_path}')
        return False


def main():
    changed_count = 0
    for target in TARGETS:
        if process_file(target):
            changed_count += 1
    print(f'\nUpdated {changed_count} files.')


if __name__ == '__main__':
    main()

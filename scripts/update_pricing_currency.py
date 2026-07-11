#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Update calculators/pricing.html and en/calculators/pricing.html
so currency display follows the selected country instead of hard-coded SAR/ر.س.
Assumes helper functions getCurrencySymbol() and formatCurrency() already exist.
"""
import re
import sys

LANG = sys.argv[1] if len(sys.argv) > 1 else 'ar'
FILE = 'calculators/pricing.html' if LANG == 'ar' else 'en/calculators/pricing.html'

with open(FILE, 'r', encoding='utf-8') as f:
    text = f.read()

cur = 'ر.س' if LANG == 'ar' else 'SAR'

# Helper for break-even/profit/loss suffixes
def suffix_replacements(text):
    # 1) amount + currency + percentage, e.g. "... + ' ر.س ('"
    text = re.sub(
        r"formatNumberAR\(([^)]+)\) \+ ' " + re.escape(cur) + r" \('",
        r"formatCurrency(\1) + ' ('",
        text
    )
    # 2) amount + currency + (profit)
    if LANG == 'ar':
        text = re.sub(
            r"formatNumberAR\(([^)]+)\) \+ ' " + re.escape(cur) + r" \(ربح\)'",
            r"formatCurrency(\1) + ' (ربح)'",
            text
        )
        text = re.sub(
            r"formatNumberAR\(Math\.abs\(([^)]+)\)\) \+ ' " + re.escape(cur) + r" \(خسارة\)'",
            r"formatCurrency(Math.abs(\1)) + ' (خسارة)'",
            text
        )
        text = re.sub(
            r"'0 " + re.escape(cur) + r" \(تعادل\)'",
            r"formatCurrency(0) + ' (تعادل)'",
            text
        )
    else:
        text = re.sub(
            r"formatNumberAR\(([^)]+)\) \+ ' " + re.escape(cur) + r" \(profit\)'",
            r"formatCurrency(\1) + ' (profit)'",
            text
        )
        text = re.sub(
            r"formatNumberAR\(Math\.abs\(([^)]+)\)\) \+ ' " + re.escape(cur) + r" \(loss\)'",
            r"formatCurrency(Math.abs(\1)) + ' (loss)'",
            text
        )
        text = re.sub(
            r"'0 " + re.escape(cur) + r" \(break-even\)'",
            r"formatCurrency(0) + ' (break-even)'",
            text
        )
    # 3) plain zero currency
    text = re.sub(
        r"'0 " + re.escape(cur) + r"'",
        r"formatCurrency(0)",
        text
    )
    # 4) plain amount + currency
    text = re.sub(
        r"formatNumberAR\(([^)]+)\) \+ ' " + re.escape(cur) + r"'",
        r"formatCurrency(\1)",
        text
    )
    # 5) Math.abs + currency (loss alert)
    text = re.sub(
        r"formatNumberAR\(Math\.abs\(([^)]+)\)\) \+ ' " + re.escape(cur),
        r"formatCurrency(Math.abs(\1)) + '",
        text
    )
    # 6) amount + currency + closing strong/span tag (rest of string continues)
    text = re.sub(
        r"formatNumberAR\(([^)]+)\) \+ ' " + re.escape(cur) + r"</(strong|span)>",
        r"formatCurrency(\1) + '</\2>'",
        text
    )
    # 7) fix already-replaced formatCurrency(Math.abs(...)) + ' SAR/ر.س ...'
    text = re.sub(
        r"formatCurrency\(Math\.abs\(([^)]+)\)\) \+ ' " + re.escape(cur),
        r"formatCurrency(Math.abs(\1)) + '",
        text
    )
    return text

text = suffix_replacements(text)

# Chart label
text = re.sub(
    r"label: 'المبلغ \(ر\.س\)'",
    r"label: 'المبلغ (' + getCurrencySymbol() + ')'",
    text
)
text = re.sub(
    r"label: 'Amount \(SAR\)'",
    r"label: 'Amount (' + getCurrencySymbol() + ')'",
    text
)

# Chart tooltip
text = re.sub(
    r"return context\.dataset\.label \+ ': ' \+ formatNumberAR\(context\.raw\) \+ ' " + re.escape(cur) + r"';",
    r"return context.dataset.label + ': ' + formatCurrency(context.raw);",
    text
)

# PDF / template literals: ${x.toLocaleString('en-US')} SAR/ر.س
text = re.sub(
    r"\$\{([^}]+)\.toLocaleString\('en-US'\)\} " + re.escape(cur),
    r"${formatCurrency(\1)}",
    text
)

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated', FILE)

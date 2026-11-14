# Correspondence PDF Fidelity — diagnostic gate (v1)

Scope: **read-only** document comparison. This tool does not issue, approve, upload,
overwrite or re-create official documents. It deliberately does **not** replace the
existing verified PDF viewer or treat a successful deployment as document fidelity.

## Requirements

- Python 3.10+
- Poppler CLI: \`pdfinfo\`, \`pdftoppm\`, \`pdftotext\` on PATH
- No network, application credentials, Supabase keys, or deployed runtime required

## Run

\`\`\`bash
python3 scripts/correspondence-fidelity.py \
  --reference /secure/approved-letter.pdf \
  --candidate /secure/retrieved-from-verify.pdf \
  --expected-sha <64-character-archived-SHA256> \
  --logical-pages 2 \
  --report /tmp/correspondence-fidelity.json
python3 -m unittest discover -s tests/correspondence -p 'test_*.py'
\`\`\`

Exit status: **0 PASS**, **1 FAIL**, **2 UNKNOWN**. The script redacts PDF contents
from JSON reports: it includes file base names, checksums, counts and visual
difference ratios, not private letter text.

### Fail-closed policy

- Different bytes: FAIL for **byte integrity** (although two PDFs may look alike).
- Different raster pages: FAIL for **visual fidelity** (fixed 96 DPI, 16/channel
  tolerance, maximum 0.1% changed pixels).
- Different page counts or \`--logical-pages\`: FAIL.
- Unextractable PDF text: UNKNOWN for textual fidelity unless the PDFs are
  byte-identical.
- Missing original DOM/canvas geometry: UNKNOWN for RTL and printed page labels,
  **even when the compared PDFs are byte-identical**.
- Missing/corrupt evidence, external renderer failure: UNKNOWN, not PASS.

**This v1 gate is diagnostic, not yet an issuance blocker.** It does not establish
full pixel/semantic parity from HTML → html2canvas → jsPDF → archive → verifier.
It must not be wired into \`artifact-finalize\` until stage-specific geometry
evidence and an authenticated end-to-end acceptance test are implemented.
Missing evidence can never be interpreted as proof of quality.

### Historical Fahd letter acceptance record

The previously issued document \`OUT-2026-000004\` has one saved
\`pages_html\` logical page (read-only production DB inspection on 2026-11-14)
but **two physical PDF pages**. Therefore
\`--logical-pages 1\` against that archived PDF must produce FAIL. The issued
raster PDF and the Chrome-export letter are **not** byte-identical or visually
identical. Neither archived artifact is modified by this test.

The historical PDF must not be rewritten. A correction, if required, needs a
new, governed issue linked to its previous record.

## Remaining acceptance before production enforcement

1. Capture approved DOM A4 pages and the exact \`html2canvas\` outputs with
   their relative geometry and RTL/number-marker coordinates.
2. Compare each stage against the generated PDF and annotate the first mismatch.
3. Check QR decoding, stamp/signature placement and page-number labels,
   not just their visual presence.
4. After issuance, retrieve the exact stored PDF from the public verifier,
   compare SHA-256 and render bytes using the same verification path.
5. Test the full 10-item Fahd example in a non-production fixture, with
   deterministic browser/font dependencies, including mobile.
6. Confirm the suite passes on good cases and fails on the known regression
   before enabling fail-closed production issuance.

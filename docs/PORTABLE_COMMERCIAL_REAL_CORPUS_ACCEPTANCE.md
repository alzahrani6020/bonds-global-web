# BONDS Commercial Intelligence — real-file extraction acceptance

This is a **mandatory customer acceptance gate**, not a synthetic fixture or a production deployment. It is **not PASS** until real documents are supplied under explicit authorization and processed in a restricted Windows test environment.

## Input

Prepare one isolated, access-restricted local directory containing `manifest.json` and six real, malware-scanned files consented for this test. No original files, contact names, extracted data, credentials, or plaintext OCR outputs should be committed, uploaded to GitHub Actions, or copied into test artifacts.

Required unique `kind` values: `pdf_text`, `pdf_scanned`, `xlsx`, `docx`, `business_card_image`, `html_directory`. For each case, supply its basename-only `file`, locally computed SHA-256 hash, and manually verified `expected_entities` list, each with an entity `type` (`organization` or `contact`) and exact `name`. Example **schema** (replace the placeholder files and hashes; this example is intentionally not valid acceptance evidence):

```json
{
  "cases": [
    {"kind":"pdf_text","file":"text.pdf","sha256":"REPLACE_WITH_64_HEX_CHARACTERS","expected_entities":[{"type":"organization","name":"Verified company name"}]},
    {"kind":"pdf_scanned","file":"scan.pdf","sha256":"REPLACE_WITH_64_HEX_CHARACTERS","expected_entities":[{"type":"organization","name":"Verified company name"}]},
    {"kind":"xlsx","file":"directory.xlsx","sha256":"REPLACE_WITH_64_HEX_CHARACTERS","expected_entities":[{"type":"organization","name":"Verified company name"}]},
    {"kind":"docx","file":"document.docx","sha256":"REPLACE_WITH_64_HEX_CHARACTERS","expected_entities":[{"type":"organization","name":"Verified company name"}]},
    {"kind":"business_card_image","file":"card.png","sha256":"REPLACE_WITH_64_HEX_CHARACTERS","expected_entities":[{"type":"contact","name":"Verified contact name"}]},
    {"kind":"html_directory","file":"directory.html","sha256":"REPLACE_WITH_64_HEX_CHARACTERS","expected_entities":[{"type":"organization","name":"Verified company name"}]}
  ]
}
```

For the scanned PDF and business card, install offline Tesseract with Arabic and English language data. For scanned PDFs, also install Poppler `pdfinfo` and `pdftoppm`. The scan must actually use the local OCR path. The check must fail if either executable is missing, an expected name is missing, hashes differ, the input includes path traversal, any format is omitted, or the source is silently auto-saved.

Run from the repository root:

```powershell
$env:BONDS_PORTABLE_CORPUS_DIR = 'C:\isolated-test-corpus'
node scripts/accept-portable-commercial-real-corpus.js
```

The script prints input hashes, counts, extraction mode, and PASS/FAIL but **never raw names or contact fields**. A PASS proves **extraction pending human review**, not human correction, database persistence/readback, two-company SaaS isolation, CRM/correspondence/HR destination readback, or signed installer acceptance. Those remain separate mandatory gates.

Do not put customer corpus data in GitHub-hosted public CI. Use a local/offline isolated machine with independent key custody.

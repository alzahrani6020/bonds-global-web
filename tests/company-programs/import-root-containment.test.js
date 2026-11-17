'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const script = fs.readFileSync(path.join(root, 'scripts/import-makkin-into-bonds.ps1'), 'utf8');
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
const vercelignore = fs.readFileSync(path.join(root, '.vercelignore'), 'utf8');

describe('BONDS-only source import safety contract', () => {
  test('raw imported code cannot be committed or deployed', () => {
    for (const text of [gitignore, vercelignore]) {
      expect(text).toMatch(/^\/\.makkin-import\/$/m);
      expect(text).toMatch(/^\/integrations\/makkin\/source\/$/m);
      expect(text).toMatch(/^\/integrations\/makkin\/import-manifest\.json$/m);
    }
  });

  test('default operation never writes or clones', () => {
    expect(script).toMatch(/\[switch\]\$Apply/);
    expect(script).toMatch(/if \(-not \$Apply\) \{/);
    expect(script).toMatch(/No files changed/);
  });

  test('import stays under the BONDS root with one pinned source', () => {
    expect(script).toMatch(/\$root = \(Resolve-Path \(Join-Path \$PSScriptRoot '\.\.'\)\)/);
    expect(script).toMatch(/\$stageParent = Join-Path \$root '\.makkin-import'/);
    expect(script).toMatch(/\$importBase = Join-Path \$root 'integrations\\makkin'/);
    expect(script).toMatch(/Source URL is pinned/);
    expect(script).toMatch(/git -C \$root rev-parse --show-toplevel/);
  });

  test('denies unsafe tracked files and possible plaintext credentials', () => {
    expect(script).toMatch(/ls-files --stage/);
    expect(script).toMatch(/Non-regular tracked Git file rejected/);
    expect(script).toMatch(/Windows case-insensitive filename collision/);
    expect(script).toMatch(/Assert-DirectoryNotLink/);
    expect(script).toMatch(/Assert-NoSecret \$src \$file/);
    // Collect all redacted findings but fail before publishing any source.
    expect(script).toMatch(/\$script:secretFindings\.Add\(/);
    expect(script).toMatch(/throw 'IMPORT_BLOCKED_POTENTIAL_CREDENTIALS'/);
    expect(script.indexOf("throw 'IMPORT_BLOCKED_POTENTIAL_CREDENTIALS'"))
      .toBeLessThan(script.indexOf('Move-Item -LiteralPath $candidate -Destination $target'));
    expect(script).toMatch(/Git LFS pointer is not a real source file/);
  });

  test('publishes complete snapshot only after hashing and preflight', () => {
    const hashIndex = script.indexOf('SHA256 integrity mismatch:');
    const publishIndex = script.indexOf('Move-Item -LiteralPath $candidate -Destination $target');
    expect(hashIndex).toBeGreaterThan(0);
    expect(publishIndex).toBeGreaterThan(hashIndex);
    expect(script).toMatch(/Import target appeared during preflight/);
    expect(script).toMatch(/Move-Item -LiteralPath \$temporaryManifest -Destination \$manifestPath/);
    expect(script).toMatch(/Remove-Item -LiteralPath \$target -Recurse -Force/);
    expect(script).toMatch(/SOURCE_IMPORTED_ONLY_NOT_INTEGRATED_OR_DEPLOYED/);
  });
});

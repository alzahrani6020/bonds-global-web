/**
 * Verify Supabase migration files are valid and ordered.
 */
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '../supabase/migrations');

function main() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.error(" No migration files found");
    process.exit(1);
  }

  let hasIssue = false;
  let previousName = '';

  files.forEach(file => {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');

    if (file <= previousName) {
      console.error(` Migration files must be sorted lexicographically: ${file}`);
      hasIssue = true;
    }
    previousName = file;

    if (!content.trim()) {
      console.error(` Empty migration file: ${file}`);
      hasIssue = true;
    }
  });

  if (hasIssue) {
    process.exit(1);
  }

  console.log(` ${files.length} migration files verified and ordered:`);
  files.forEach(f => console.log(`   - ${f}`));
}

main();

'use strict';

const path = require('path');

function parseMigrationIdentity(targetFile) {
  const base = path.posix.basename(String(targetFile || ''), '.sql');
  const match = base.match(/^(\d{14})_(.+)$/);
  if (!match) {
    throw new Error('Invalid migration identity');
  }
  return { version: match[1], name: match[2] };
}

function normalizeMigrationSql(sql) {
  return String(sql || '').replace(/\r\n/g, '\n').trim();
}

function findEquivalentMigration(records, targetFile, sql) {
  const { version, name } = parseMigrationIdentity(targetFile);
  const normalizedSql = normalizeMigrationSql(sql);

  for (const row of records || []) {
    const sameIdentity = row?.version === version || row?.name === name;
    if (!sameIdentity) continue;

    const statements = Array.isArray(row?.statements) ? row.statements : [];
    const recordedSql = normalizeMigrationSql(statements.join('\n'));

    if (recordedSql && recordedSql === normalizedSql) {
      return {
        version: row.version,
        name: row.name,
      };
    }

    if (row?.version === version) {
      throw new Error(
        `Migration version collision for ${version}: recorded SQL differs from ${targetFile}`
      );
    }
  }

  return null;
}

module.exports = {
  parseMigrationIdentity,
  normalizeMigrationSql,
  findEquivalentMigration,
};

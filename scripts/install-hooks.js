#!/usr/bin/env node
// Install Git hooks from .githooks/ directory
const { execSync } = require('child_process');
const path = require('path');

try {
  execSync('git config core.hooksPath .githooks', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit'
  });
  console.log('✅ Git hooks installed successfully!');
  console.log('   Audit will run automatically before every commit.');
} catch (e) {
  console.error('❌ Failed to install hooks:', e.message);
  process.exit(1);
}

'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Admin dashboard links once to the governed correspondence workspace while preserving verification', () => {
  const root = path.resolve(__dirname, '../..');
  const admin = fs.readFileSync(path.join(root, 'admin/dashboard.html'), 'utf8');
  const workspace = fs.readFileSync(path.join(root, 'my-bonds/index.html'), 'utf8');
  const target = '/letterhead.html?workspace=correspondence&amp;return_to=%2Fadmin%2Fdashboard.html';
  
  assert.match(workspace, /letterhead\.html\?workspace=correspondence/);
  assert.match(admin, /data-target="\/admin\/correspondence-verification\/\?embed=1"/);
  assert.equal(admin.split('href="' + target + '"').length - 1, 1, 'Admin should have exactly one correspondence workspace link');
  assert.match(admin, /href="\/letterhead\.html\?workspace=correspondence&amp;return_to=%2Fadmin%2Fdashboard\.html" target="_blank" rel="noopener noreferrer"/);
  assert.ok(!/data-target="\/letterhead\.html\?workspace=correspondence/.test(admin), 'Correspondence must navigate instead of loading an external page into the admin iframe');
  // The dashboard rebuilds its sidebar on load; links without data-target are otherwise deleted.
  assert.match(admin, /const correspondenceLink = sidebar\.querySelector\('a\.sidebar-link\[href\^="\/letterhead\.html\?workspace=correspondence"\]'\)/);
  assert.match(admin, /if \(correspondenceLink && businessGroup\) businessGroup\.appendChild\(correspondenceLink\)/);
  assert.ok(admin.indexOf('const correspondenceLink =') < admin.indexOf("sidebar.querySelectorAll('.nav-group').forEach(group => group.remove())"));
  assert.ok(admin.indexOf('businessGroup.appendChild(correspondenceLink)') > admin.indexOf('for (const group of groupConfig)'));
  console.log('Dashboard correspondence workspace link: PASS');
  
});

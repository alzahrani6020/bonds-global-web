'use strict';

const fs = require('fs');
const path = require('path');

const OWNER_ID = '50ca4eaa-8362-46eb-98b7-5fe5b3006f4e';
const OTHER_ID = '7e2b0ef3-6ed3-41b7-9b51-a87962d30011';

function loadAuthority() {
  const source = fs.readFileSync(path.join(__dirname, '../../lib/api/correspondence.js'), 'utf8');
  const testModule = { exports: {} };
  // Load the production implementation without altering the production module exports.
  // Only external services are stubbed; all authorization logic is executed as shipped.
  const mockedRequire = id => {
    if (id === './supabase') return () => { throw new Error('No database connection in authority regression tests'); };
    if (id === './email') return { sendEmail: () => { throw new Error('No mail in authority regression tests'); } };
    return require(id);
  };
  const run = new Function('require', 'module', 'exports', source + '\nmodule.exports.__authorityTest = {resolveCorrespondencePermissions, transitionDocument, markGovernanceAction};');
  run(mockedRequire, testModule, testModule.exports);
  return testModule.exports.__authorityTest;
}

const { resolveCorrespondencePermissions, transitionDocument, markGovernanceAction } = loadAuthority();

function permissionsDb(grants = []) {
  return {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(async () => ({ data: grants.map(permission => ({ permission })), error: null }))
      }))
    }))
  };
}

const docUnderReview = () => ({
  id: 'cd311bc8-c70c-4663-8713-b352d1195410',
  status: 'under_review',
  created_by: '84d1af92-143f-43df-8e2b-ea2f4a595f61',
  owner_user_id: OWNER_ID,
  direction: 'outgoing',
  current_version: 1
});
const approvedDoc = () => ({ ...docUnderReview(), status: 'approved' });

describe('correspondence exclusive approval, signing and stamping', () => {
  test('idempotent approval cannot bypass the owner guard in the HTTP handler', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../lib/api/correspondence.js'), 'utf8');
    const handler = source.slice(source.indexOf("  if (action === 'transition') {"));
    const denial = handler.indexOf("if (target === 'approved' && !isExclusiveCorrespondenceActor(user.id))");
    const idempotent = handler.indexOf('if (target === doc.status)');
    expect(denial).toBeGreaterThanOrEqual(0);
    expect(idempotent).toBeGreaterThan(denial);
  });
  test.each(['admin', 'super_admin'])('non-owner %s cannot acquire restricted permissions', async role => {
    const db = permissionsDb();
    const result = await resolveCorrespondencePermissions(db, OTHER_ID, role);
    for (const permission of ['approve', 'sign', 'stamp']) expect(result.has(permission)).toBe(false);
    expect(result.has('review')).toBe(true);
    expect(db.from).not.toHaveBeenCalled();
  });

  test('non-admin cannot gain restricted permissions from explicit database grants', async () => {
    const db = permissionsDb(['approve', 'sign', 'stamp', 'review']);
    const result = await resolveCorrespondencePermissions(db, OTHER_ID, 'user');
    expect([...result]).toEqual(['review']);
  });

  test('verified owner retains approval signing and stamping permissions', async () => {
    const db = permissionsDb();
    const result = await resolveCorrespondencePermissions(db, OWNER_ID, 'super_admin');
    expect(['approve', 'sign', 'stamp'].every(permission => result.has(permission))).toBe(true);
  });

  test.each(['admin', 'super_admin'])('approval of another account is forbidden for %s before any database write', async role => {
    const db = permissionsDb();
    await expect(transitionDocument(db, docUnderReview(), { id: OTHER_ID }, role, new Set(['approve']), 'approved', {}))
      .rejects.toMatchObject({ status: 403 });
    expect(db.from).not.toHaveBeenCalled();
  });

  test('owner reaches the approval database transition rather than owner-only denial', async () => {
    const sentinel = new Error('Isolated test intercepted write');
    const db = { from: jest.fn(() => { throw sentinel; }) };
    await expect(transitionDocument(db, docUnderReview(), { id: OWNER_ID }, 'super_admin', new Set(['approve']), 'approved', {}))
      .rejects.toBe(sentinel);
    expect(db.from).toHaveBeenCalledWith('correspondence_documents');
  });

  test.each(['sign', 'stamp'])('non-owner admin cannot %s, even on an approved document', async action => {
    const db = permissionsDb();
    await expect(markGovernanceAction(db, approvedDoc(), { id: OTHER_ID }, 'super_admin', new Set([action]), action, {}))
      .rejects.toMatchObject({ status: 403 });
    expect(db.from).not.toHaveBeenCalled();
  });

  test.each(['sign', 'stamp'])('owner %s passes authorization and reaches artifact checks', async action => {
    const db = permissionsDb();
    if (action === 'sign') {
      await expect(markGovernanceAction(db, approvedDoc(), { id: OWNER_ID }, 'super_admin', new Set([action]), action, {}))
        .rejects.toMatchObject({ status: 400, message: 'A PNG signature artifact is required' });
    } else {
      const sentinel = new Error('Isolated test intercepted stamp write');
      db.from = jest.fn(() => { throw sentinel; });
      await expect(markGovernanceAction(db, approvedDoc(), { id: OWNER_ID }, 'super_admin', new Set([action]), action, {}))
        .rejects.toBe(sentinel);
      expect(db.from).toHaveBeenCalledWith('correspondence_documents');
    }
  });
});

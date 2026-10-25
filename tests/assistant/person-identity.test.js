/** @jest-environment node */

const fs = require('fs');
const path = require('path');

const {
  PERSON_IDENTITY_SCHEMA_VERSION,
  IDENTITY_VERIFICATION_STATES,
  buildPersonEntityFrame,
  resolveCandidateIdentity,
  verifyPersonIdentity
} = require('../../lib/assistant/person-identity');

describe('Governed person identity pipeline', () => {
  test('builds an immutable versioned PersonEntityFrame from titled Arabic mention', () => {
    const frame = buildPersonEntityFrame('المستشار المالي الدكتور طلال حسن الزهراني');

    expect(frame.person_identity_schema_version).toBe(PERSON_IDENTITY_SCHEMA_VERSION);
    expect(frame.canonical_name).toBe('طلال حسن الزهراني');
    expect(frame.raw_mention).toBe('المستشار المالي الدكتور طلال حسن الزهراني');
    expect(frame.qualifiers.map(item => item.value)).toEqual(
      expect.arrayContaining(['المستشار المالي', 'الدكتور'])
    );
    expect(frame.qualifiers.every(item => item.source === 'user' && item.verified === false)).toBe(true);
    expect(Object.isFrozen(frame)).toBe(true);
    expect(Object.isFrozen(frame.qualifiers)).toBe(true);
  });

  test('parses honorifics without making them part of canonical identity', () => {
    const frame = buildPersonEntityFrame('صاحب السمو الملكي الأمير محمد بن سلمان');

    expect(frame.canonical_name).toBe('محمد بن سلمان');
    expect(frame.qualifiers.map(item => item.value)).toEqual(
      expect.arrayContaining(['صاحب السمو الملكي', 'الأمير'])
    );
  });

  test('separates relation, organization and canonical name', () => {
    const frame = buildPersonEntityFrame('رئيس شركة X خالد محمد');

    expect(frame.canonical_name).toBe('خالد محمد');
    expect(frame.relations).toEqual([
      expect.objectContaining({ value:'رئيس', source:'user', verified:false })
    ]);
    expect(frame.organizations).toEqual([
      expect.objectContaining({ value:'شركة X', source:'user', verified:false })
    ]);
  });

  test('resolves candidate identity per source and verifies matching organization', () => {
    const frame = buildPersonEntityFrame('رئيس شركة X خالد محمد');
    const candidates = [
      resolveCandidateIdentity(frame, {
        id:'source-a',
        text:'خالد محمد هو رئيس شركة X ويتولى إدارة أعمالها.'
      }, 0),
      resolveCandidateIdentity(frame, {
        id:'source-b',
        text:'تذكر السيرة الرسمية أن خالد محمد يشغل منصب رئيس شركة X.'
      }, 1)
    ];

    expect(candidates[0].name_score).toBe(1);
    expect(candidates[0].organization_support).toBe(1);

    const verified = verifyPersonIdentity(frame, candidates, { minSupportingSources:2 });
    expect(verified.verification_state).toBe(IDENTITY_VERIFICATION_STATES.VERIFIED);
    expect(verified.matched).toBe(true);
    expect(verified.resolution_basis).toEqual(expect.arrayContaining(['name', 'organization', 'relation']));
    expect(verified.supporting_sources).toEqual(expect.arrayContaining(['source-a', 'source-b']));
  });

  test('same-name candidates without requested organization remain ambiguous', () => {
    const frame = buildPersonEntityFrame('رئيس شركة X خالد محمد');
    const candidates = [
      resolveCandidateIdentity(frame, {
        id:'source-a',
        text:'خالد محمد خبير اقتصادي وله نشاط مهني مستقل.'
      }, 0),
      resolveCandidateIdentity(frame, {
        id:'source-b',
        text:'خالد محمد باحث وله مؤلفات متعددة.'
      }, 1)
    ];

    const verified = verifyPersonIdentity(frame, candidates, { minSupportingSources:2 });
    expect(verified.verification_state).toBe(IDENTITY_VERIFICATION_STATES.AMBIGUOUS);
    expect(verified.matched).toBe(false);
  });

  test('wrong user qualifier is not promoted to verified fact', () => {
    const frame = buildPersonEntityFrame('الطبيب خالد محمد علي');
    const candidates = [
      resolveCandidateIdentity(frame, {
        id:'source-a',
        text:'خالد محمد علي محام ومستشار قانوني.'
      }, 0),
      resolveCandidateIdentity(frame, {
        id:'source-b',
        text:'خالد محمد علي يعمل في المجال القانوني.'
      }, 1)
    ];

    const verified = verifyPersonIdentity(frame, candidates, { minSupportingSources:2 });
    expect(verified.verification_state).toBe(IDENTITY_VERIFICATION_STATES.VERIFIED);
    expect(verified.verified_qualifiers).toEqual([]);
  });

  test('explicit contradiction fails closed', () => {
    const frame = buildPersonEntityFrame('الطبيب خالد محمد علي');
    const candidates = [
      resolveCandidateIdentity(frame, {
        id:'source-a',
        text:'خالد محمد علي ليس الطبيب المذكور، بل يعمل محاميا.'
      }, 0),
      resolveCandidateIdentity(frame, {
        id:'source-b',
        text:'خالد محمد علي ليس الطبيب المذكور في السؤال.'
      }, 1)
    ];

    const verified = verifyPersonIdentity(frame, candidates, { minSupportingSources:2 });
    expect(verified.verification_state).toBe(IDENTITY_VERIFICATION_STATES.CONTRADICTED);
    expect(verified.matched).toBe(false);
    expect(verified.unresolved_conflicts.length).toBeGreaterThan(0);
  });
  test('downstream research and answer layers do not rebuild PersonEntityFrame from raw text', () => {
    const downstream = [
      path.join(__dirname, '../../lib/intelligence/research-workflow.js'),
      path.join(__dirname, '../../lib/assistant/open-chat-tool-loop.js')
    ];

    for (const filename of downstream) {
      const source = fs.readFileSync(filename, 'utf8');
      expect(source).not.toContain('buildPersonEntityFrame(');
      expect(source).not.toContain('personEntityFromMention(');
    }
  });

});

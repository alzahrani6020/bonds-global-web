/** @jest-environment node */

const fs = require('fs');
const path = require('path');

const {
  PERSON_IDENTITY_SCHEMA_VERSION,
  IDENTITY_VERIFICATION_STATES,
  buildPersonEntityFrame,
  isPersonIdentitySocialSource,
  isPersonIdentitySourceEligible,
  isAuthoritativePersonPrimarySource,
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
      path.join(__dirname, '../../lib/assistant/universal-orchestrator.js')
    ];

    for (const filename of downstream) {
      const source = fs.readFileSync(filename, 'utf8');
      expect(source).not.toContain('buildPersonEntityFrame(');
      expect(source).not.toContain('personEntityFromMention(');
    }
  });


  test('rejects social-network pages and event-only posts as person identity evidence', () => {
    const frame = buildPersonEntityFrame('الدكتور طلال حسن الزهراني');

    const linkedIn = {
      url:'https://www.linkedin.com/in/example-person',
      title:'طلال حسن الزهراني',
      text:'طلال حسن الزهراني مستشار مالي.'
    };
    const eventPost = {
      url:'https://publisher.example/news/visit-2024',
      title:'استضافة الدكتور طلال حسن الزهراني',
      text:'استضاف المكتب الدكتور طلال حسن الزهراني في زيارة خلال أكتوبر 2024.'
    };
    const profile = {
      url:'https://publisher.example/profile/talal-alzahrani',
      title:'الملف التعريفي للدكتور طلال حسن الزهراني',
      text:'الدكتور طلال حسن الزهراني خبير اقتصادي ومستشار مالي.'
    };

    expect(isPersonIdentitySocialSource(linkedIn)).toBe(true);
    expect(isPersonIdentitySourceEligible(frame, linkedIn)).toBe(false);
    expect(isPersonIdentitySourceEligible(frame, eventPost)).toBe(false);
    expect(isPersonIdentitySourceEligible(frame, profile)).toBe(true);
  });

  test('accepts canonical affiliation on the exact trusted Vercel runtime host only', () => {
    const previous = process.env.VERCEL_URL;
    process.env.VERCEL_URL = 'bonds-global-staged-dr-talal.vercel.app';
    try {
      const frame = buildPersonEntityFrame('الدكتور طلال حسن الزهراني');
      const source = {
        url:'https://bonds-global-staged-dr-talal.vercel.app/dr-talal-alzahrani',
        title:'الدكتور طلال حسن الزهراني | مستشار مالي | بوندز',
        text:'نبذة الدكتور طلال حسن الزهراني خبير اقتصادي ومستشار مالي.',
        extracted:{
          title:'الدكتور طلال حسن الزهراني | مستشار مالي | بوندز',
          text:'نبذة الدكتور طلال حسن الزهراني خبير اقتصادي ومستشار مالي.',
          profile_page:{
            profile_page:true,
            profile_page_url:'https://bonds-global.com/dr-talal-alzahrani',
            person_name:'الدكتور طلال حسن الزهراني',
            person_alternate_names:['Dr. Talal Hassan Alzahrani'],
            works_for_name:'بوندز للاستشارات المالية',
            works_for_url:'https://bonds-global.com'
          }
        }
      };
      expect(isAuthoritativePersonPrimarySource(frame, source)).toBe(true);

      const untrustedTransport = {
        ...source,
        url:'https://attacker.vercel.app/dr-talal-alzahrani'
      };
      expect(isAuthoritativePersonPrimarySource(frame, untrustedTransport)).toBe(false);

      const wrongCanonicalPath = {
        ...source,
        extracted:{
          ...source.extracted,
          profile_page:{
            ...source.extracted.profile_page,
            profile_page_url:'https://bonds-global.com/another-person'
          }
        }
      };
      expect(isAuthoritativePersonPrimarySource(frame, wrongCanonicalPath)).toBe(false);
    } finally {
      if (previous == null) delete process.env.VERCEL_URL;
      else process.env.VERCEL_URL = previous;
    }
  });

  test('does not verify another person that only shares scattered name tokens', () => {
    const frame = buildPersonEntityFrame('الدكتور طلال حسن الزهراني');
    const wrong = resolveCandidateIdentity(frame, {
      url:'https://example.com/wrong-person',
      title:'محمد عبيشة الزهراني',
      snippet:'محمد عبيشة الزهراني شاعر وباحث. ورد اسم طلال في قسم آخر، واسم حسن في تعليق منفصل.'
    }, 0);

    expect(wrong.exact_name_match).toBe(false);
    expect(wrong.name_score).toBeGreaterThan(0);
    const verification = verifyPersonIdentity(frame, [wrong, wrong], { minSupportingSources:2 });
    expect(verification.verification_state).not.toBe('VERIFIED');
    expect(verification.matched).toBe(false);
  });

});

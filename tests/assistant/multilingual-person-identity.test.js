'use strict';

const {
  crossScriptNameScore
} = require('../../lib/assistant/multilingual-person-identity');
const {
  buildPersonEntityFrame,
  resolveCandidateIdentity,
  verifyPersonIdentity
} = require('../../lib/assistant/person-identity');

describe('multilingual person identity resolver', () => {
  test('matches Arabic and Latin-script renderings conservatively', () => {
    expect(crossScriptNameScore('حسني مبارك', 'Hosni Mubarak was president of Egypt.')).toBeGreaterThanOrEqual(0.88);
    expect(crossScriptNameScore('حسني مبارك', 'Barack Obama was president of the United States.')).toBe(0);
  });

  test('marks cross-script evidence as alias support, not a verified fact by itself', () => {
    const frame = buildPersonEntityFrame('حسني مبارك');
    const candidate = resolveCandidateIdentity(frame, {
      url:'https://example.com/hosni-mubarak',
      title:'Hosni Mubarak',
      text:'Hosni Mubarak was an Egyptian politician.'
    }, 0);

    expect(candidate.name_score).toBeGreaterThanOrEqual(0.88);
    expect(candidate.resolution_basis).toContain('multilingual_alias');

    const oneSource = verifyPersonIdentity(frame, [candidate], { minSupportingSources:2 });
    expect(oneSource.verification_state).toBe('INSUFFICIENT_EVIDENCE');
  });

  test('verifies only after two supporting sources, including cross-script evidence', () => {
    const frame = buildPersonEntityFrame('حسني مبارك');
    const candidates = [
      resolveCandidateIdentity(frame, {
        url:'https://ar.wikipedia.org/wiki/حسني_مبارك',
        title:'حسني مبارك',
        text:'حسني مبارك سياسي وعسكري مصري.'
      }, 0),
      resolveCandidateIdentity(frame, {
        url:'https://www.britannica.com/biography/Hosni-Mubarak',
        title:'Hosni Mubarak',
        text:'Hosni Mubarak was an Egyptian military officer and politician.'
      }, 1)
    ];

    const result = verifyPersonIdentity(frame, candidates, { minSupportingSources:2 });
    expect(result.verification_state).toBe('VERIFIED');
    expect(result.supporting_sources).toHaveLength(2);
  });
  test('does not confuse Talal Hassan Alzahrani with Yasser Talal Alzahrani plus unrelated Hassan text', () => {
    const frame = buildPersonEntityFrame('الدكتور طلال حسن الزهراني');
    expect(frame.canonical_name).toBe('طلال حسن الزهراني');

    const wrong = resolveCandidateIdentity(frame, {
      url:'https://ar.wikipedia.org/wiki/%D9%8A%D8%A7%D8%B3%D8%B1_%D8%B7%D9%84%D8%A7%D9%84_%D8%A7%D9%84%D8%B2%D9%87%D8%B1%D8%A7%D9%86%D9%8A',
      title:'ياسر طلال الزهراني',
      text:'ياسر طلال الزهراني مواطن سعودي. استشهاد التراث الديني في شعر حسن إبراهيم حسن.'
    }, 0);

    expect(wrong.name_score).toBeLessThan(0.75);

    const result = verifyPersonIdentity(frame, [wrong], { minSupportingSources:2 });
    expect(result.verification_state).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.matched).toBe(false);
  });

  test('still accepts the correct ordered Arabic name when present', () => {
    const frame = buildPersonEntityFrame('الدكتور طلال حسن الزهراني');
    const correct = resolveCandidateIdentity(frame, {
      url:'https://example.com/talal-hassan-alzahrani',
      title:'الدكتور طلال حسن الزهراني',
      text:'الدكتور طلال حسن الزهراني مستشار مالي وخبير اقتصادي.'
    }, 0);

    expect(correct.name_score).toBeGreaterThanOrEqual(0.9);
  });

});

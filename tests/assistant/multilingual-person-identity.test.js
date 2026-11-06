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
});

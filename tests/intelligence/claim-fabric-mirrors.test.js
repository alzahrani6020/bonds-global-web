'use strict';

const {
  verifyStructuredClaims,
  enrichSourcesWithStructuredClaims
} = require('../../lib/intelligence/claim-fabric');

function claim({ publisher, hash, value = '100' }) {
  return {
    key: 'metric.gdp',
    subject: 'SA',
    predicate: 'metric.gdp',
    value,
    value_normalized: value,
    publisher,
    source_id: publisher + '-1',
    confidence: 0.82,
    content_hash: hash
  };
}

function source({ publisher, hash, claims }) {
  return {
    id: publisher + '-1',
    publisher,
    url: 'https://' + publisher + '/x',
    content_hash: hash,
    text: 'GDP reached 100 billion this year according to the statistics authority.',
    claims
  };
}

describe('verifyStructuredClaims mirror detection', () => {
  test('identical content fingerprints across publishers count as one independent source', () => {
    const { verified, supported } = verifyStructuredClaims([
      { structured_claims: [claim({ publisher: 'agency-a.com', hash: 'same-body' })] },
      { structured_claims: [claim({ publisher: 'agency-b.com', hash: 'same-body' })] }
    ], 2);

    expect(verified).toHaveLength(0);
    expect(supported).toHaveLength(1);
    expect(supported[0].independent_publishers).toBe(1);
    expect(supported[0].mirrored_sources).toBe(1);
    expect(supported[0].verification_state).toBe('SUPPORTED');
  });

  test('different content fingerprints across publishers count as independent corroboration', () => {
    const { verified, supported } = verifyStructuredClaims([
      { structured_claims: [claim({ publisher: 'agency-a.com', hash: 'body-a' })] },
      { structured_claims: [claim({ publisher: 'agency-b.com', hash: 'body-b' })] }
    ], 2);

    expect(supported).toHaveLength(0);
    expect(verified).toHaveLength(1);
    expect(verified[0].independent_publishers).toBe(2);
    expect(verified[0].mirrored_sources).toBe(0);
    expect(verified[0].verification_state).toBe('VERIFIED');
  });

  test('claims without content fingerprints keep the legacy publisher counting', () => {
    const { verified } = verifyStructuredClaims([
      { structured_claims: [claim({ publisher: 'agency-a.com', hash: null })] },
      { structured_claims: [claim({ publisher: 'agency-b.com', hash: null })] }
    ], 2);

    expect(verified).toHaveLength(1);
    expect(verified[0].independent_publishers).toBe(2);
    expect(verified[0].mirrored_sources).toBe(0);
  });

  test('mirrored copies do not inflate confidence from publisher count', () => {
    const mirror = verifyStructuredClaims([
      { structured_claims: [claim({ publisher: 'agency-a.com', hash: 'same' })] },
      { structured_claims: [claim({ publisher: 'agency-b.com', hash: 'same' })] },
      { structured_claims: [claim({ publisher: 'agency-c.com', hash: 'same' })] }
    ], 2);
    const independent = verifyStructuredClaims([
      { structured_claims: [claim({ publisher: 'agency-a.com', hash: 'a' })] },
      { structured_claims: [claim({ publisher: 'agency-b.com', hash: 'b' })] },
      { structured_claims: [claim({ publisher: 'agency-c.com', hash: 'c' })] }
    ], 2);

    const mirrorClaim = [...mirror.verified, ...mirror.supported][0];
    const independentClaim = [...independent.verified, ...independent.supported][0];
    expect(mirrorClaim.independent_publishers).toBe(1);
    expect(independentClaim.independent_publishers).toBe(3);
    expect(mirrorClaim.confidence).toBeLessThan(independentClaim.confidence);
  });

  test('same fingerprint from the same publisher still counts once (no double count)', () => {
    const { verified } = verifyStructuredClaims([
      { structured_claims: [claim({ publisher: 'agency-a.com', hash: 'dup' })] },
      { structured_claims: [claim({ publisher: 'agency-a.com', hash: 'dup' })] }
    ], 1);

    expect(verified).toHaveLength(1);
    expect(verified[0].independent_publishers).toBe(1);
    expect(verified[0].mirrored_sources).toBe(0);
  });
});

describe('content fingerprint plumbing', () => {
  test('enrichSourcesWithStructuredClaims stamps source content_hash onto explicit and extracted claims', () => {
    const [enriched] = enrichSourcesWithStructuredClaims([
      source({
        publisher: 'agency-a.com',
        hash: 'fp-1',
        claims: [{ key: 'metric.gdp', predicate: 'metric.gdp', value: '100', publisher: 'agency-a.com' }]
      })
    ]);

    expect(enriched.claims[0].content_hash).toBe('fp-1');
    expect(enriched.structured_claims.every(item => item.content_hash === 'fp-1' || item.content_hash === undefined)).toBe(true);
  });
});

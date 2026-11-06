'use strict';

const {
  canonicalPublisherIdentity,
  samePublisher
} = require('../../lib/intelligence/publisher-identity');
const { verifyEvidence } = require('../../lib/intelligence/research-intelligence');

describe('publisher identity resolver', () => {
  test('collapses controlled publisher subdomains but not unrelated shared suffixes', () => {
    expect(canonicalPublisherIdentity('https://ar.wikipedia.org/wiki/X')).toBe('wikipedia.org');
    expect(canonicalPublisherIdentity('https://en.wikipedia.org/wiki/X')).toBe('wikipedia.org');
    expect(canonicalPublisherIdentity('https://www.bbc.com/news')).toBe('bbc.com');
    expect(canonicalPublisherIdentity('https://sport.bbc.com/x')).toBe('bbc.com');
    expect(samePublisher('https://www.bbc.com/a', 'https://sport.bbc.com/b')).toBe(true);

    expect(canonicalPublisherIdentity('https://ministry-a.gov.sa/page')).toBe('ministry-a.gov.sa');
    expect(canonicalPublisherIdentity('https://ministry-b.gov.sa/page')).toBe('ministry-b.gov.sa');
    expect(samePublisher('https://ministry-a.gov.sa', 'https://ministry-b.gov.sa')).toBe(false);
  });

  test('counts publisher families once in evidence verification', () => {
    const wikipediaOnly = verifyEvidence({
      topic:'حسني مبارك',
      minIndependentPublishers:2,
      sources:[
        { url:'https://ar.wikipedia.org/wiki/X', text:'حسني مبارك سياسي مصري.' },
        { url:'https://en.wikipedia.org/wiki/X', text:'Hosni Mubarak was an Egyptian politician.' }
      ]
    });
    expect(wikipediaOnly.ok).toBe(false);
    expect(wikipediaOnly.result.independent_publisher_count).toBe(1);

    const independent = verifyEvidence({
      topic:'حسني مبارك',
      minIndependentPublishers:2,
      sources:[
        { url:'https://ar.wikipedia.org/wiki/X', text:'حسني مبارك سياسي مصري.' },
        { url:'https://www.bbc.com/arabic/x', text:'حسني مبارك رئيس مصري سابق.' }
      ]
    });
    expect(independent.ok).toBe(true);
    expect(independent.result.independent_publisher_count).toBe(2);
  });
});

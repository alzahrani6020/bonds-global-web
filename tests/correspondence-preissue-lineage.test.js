'use strict';

const { assertEligibleCorrespondencePredecessor } = require('../lib/api/correspondence');

function mockDb(issue, document, issueError = null, docError = null) {
  const issueQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({
      data: issue ? [issue] : [], error: issueError
    })
  };
  const docQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: document, error: docError })
  };
  const sb = { from: jest.fn(name => {
    if (name === 'correspondence_issues') return issueQuery;
    if (name === 'correspondence_documents') return docQuery;
    throw new Error('Unexpected table ' + name);
  }) };
  return { sb, issueQuery, docQuery };
}

describe('issuance predecessor integrity gate', () => {
  const relatedId = '11111111-1111-4111-8111-111111111111';

  test('independent issue does not query prior correspondence', async () => {
    const { sb } = mockDb();
    await expect(assertEligibleCorrespondencePredecessor(sb, null)).resolves.toBeUndefined();
    expect(sb.from).not.toHaveBeenCalled();
  });

  test.each(['pending', 'revoked', 'superseded'])(
    'rejects %s predecessor even if it once had a PDF', async state => {
      const { sb, docQuery } = mockDb(
        { state, pdf_hash: 'hash' }, { status: 'issued', artifact_hash: 'hash' }
      );
      await expect(assertEligibleCorrespondencePredecessor(sb, relatedId))
        .rejects.toMatchObject({ status: 409 });
      expect(docQuery.maybeSingle).not.toHaveBeenCalled();
    }
  );

  test('rejects an active predecessor with no PDF', async () => {
    const { sb } = mockDb({ state: 'active', pdf_hash: null });
    await expect(assertEligibleCorrespondencePredecessor(sb, relatedId))
      .rejects.toMatchObject({ status: 409 });
  });

  test('rejects a mismatched or absent artifact binding', async () => {
    const { sb } = mockDb(
      { state: 'active', pdf_hash: 'expected' },
      { status: 'issued', artifact_hash: 'different' }
    );
    await expect(assertEligibleCorrespondencePredecessor(sb, relatedId))
      .rejects.toMatchObject({ status: 409 });
  });

  test('admits only finalized active predecessor with matching binding', async () => {
    const { sb, issueQuery, docQuery } = mockDb(
      { state: 'active', pdf_hash: 'expected' },
      { status: 'issued', artifact_hash: 'expected' }
    );
    await expect(assertEligibleCorrespondencePredecessor(sb, relatedId)).resolves.toBeUndefined();
    expect(issueQuery.eq).toHaveBeenCalledWith('document_id', relatedId);
    expect(docQuery.eq).toHaveBeenCalledWith('id', relatedId);
  });

  test('database errors are not treated as permission to issue', async () => {
    const { sb } = mockDb(null, null, new Error('database unavailable'));
    await expect(assertEligibleCorrespondencePredecessor(sb, relatedId))
      .rejects.toThrow('database unavailable');
  });
});

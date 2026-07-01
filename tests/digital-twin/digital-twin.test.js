const { DigitalTwin, buildSnapshot, computeChecksum } = require('../../lib/digital-twin/digital-twin');

describe('Digital Twin', () => {
  it('builds a snapshot', () => {
    const snapshot = buildSnapshot(
      { id: 'p1', project_number: 'PRJ-2026-00000001', sector: 'restaurant' },
      { asset: { class: 'realEstate' }, reports: [{ type: 'valuation' }] }
    );
    expect(snapshot.project_id).toBe('p1');
    expect(snapshot.computed.reportCount).toBe(1);
    expect(snapshot.generated_at).toBeTruthy();
  });

  it('computes checksum', () => {
    const snapshot = buildSnapshot({ id: 'p1' });
    const checksum1 = computeChecksum(snapshot);
    snapshot.market = { index: 1 };
    const checksum2 = computeChecksum(snapshot);
    expect(checksum1).not.toBe(checksum2);
    expect(checksum1.length).toBe(16);
  });

  it('works without supabase', async () => {
    const twin = new DigitalTwin(null);
    const { snapshot } = await twin.build('p1');
    const saved = await twin.save('p1', snapshot);
    expect(saved.project_id).toBe('p1');
  });
});

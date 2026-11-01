const { resolveActivityAndCityFromMessage, _resetLookupCache } = require('../../v3/api/ai');

function supabaseWith({ activities, cities }) {
  const calls = { economic_activities: 0, cities: 0 };
  const rowsFor = table => (table === 'economic_activities' ? activities : cities);
  return {
    calls,
    client: {
      from(table) {
        calls[table] += 1;
        const result = { data: rowsFor(table) };
        const chain = {
          select: () => chain,
          eq: () => chain,
          limit: () => chain,
          then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
        };
        return chain;
      }
    }
  };
}

describe('chat activity/city resolution', () => {
  beforeEach(() => _resetLookupCache());

  const activities = [{ code: 'ACT-1', name_ar: 'مطعم' }];
  const cities = [{ code: 'SA-01-001', name_ar: 'الرياض' }];

  test('resolves activity and city from the message', async () => {
    const { client } = supabaseWith({ activities, cities });
    const context = await resolveActivityAndCityFromMessage('مطعم في الرياض', {}, client);
    expect(context).toMatchObject({ activityCode: 'ACT-1', cityCode: 'SA-01-001' });
  });

  test('reuses cached reference lists across messages instead of re-querying', async () => {
    const { client, calls } = supabaseWith({ activities, cities });
    await resolveActivityAndCityFromMessage('مطعم في الرياض', {}, client);
    await resolveActivityAndCityFromMessage('مطعم في الرياض', {}, client);
    await resolveActivityAndCityFromMessage('مرحبا', {}, client);
    expect(calls.economic_activities).toBe(1);
    expect(calls.cities).toBe(1);
  });

  test('does not query lists already provided by the context', async () => {
    const { client, calls } = supabaseWith({ activities, cities });
    await resolveActivityAndCityFromMessage('مطعم', { activityCode: 'X', cityCode: 'Y' }, client);
    expect(calls.economic_activities).toBe(0);
    expect(calls.cities).toBe(0);
  });

  test('a row with an empty name never matches every message', async () => {
    const { client } = supabaseWith({
      activities: [{ code: 'BAD', name_ar: '' }, { code: 'NULL', name_ar: null }],
      cities: [{ code: 'BAD-CITY', name_ar: '   ' }]
    });
    const context = await resolveActivityAndCityFromMessage('أي رسالة عادية', {}, client);
    expect(context.activityCode).toBeUndefined();
    expect(context.cityCode).toBeUndefined();
  });

  test('empty results are not cached so a transient failure does not stick', async () => {
    const failing = supabaseWith({ activities: null, cities: null });
    await resolveActivityAndCityFromMessage('مطعم', {}, failing.client);
    const ok = supabaseWith({ activities, cities });
    const context = await resolveActivityAndCityFromMessage('مطعم في الرياض', {}, ok.client);
    expect(context.activityCode).toBe('ACT-1');
  });
});
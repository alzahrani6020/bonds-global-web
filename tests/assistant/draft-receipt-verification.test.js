/** @jest-environment node */
const { resolveAssistantAction } = require('../../lib/assistant/idempotency');

function database(record, error = null) {
  const query = {select:jest.fn(),eq:jest.fn(),maybeSingle:jest.fn().mockResolvedValue({data:record,error})};
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  return { from:jest.fn().mockReturnValue(query),rpc:jest.fn().mockResolvedValue({data:{state:'resolved_succeeded',status:'succeeded'},error:null}),query };
}
const args = {
  userId:'user-1', idempotencyKey:'a'.repeat(64),status:'succeeded',
  action:{id:'a',type:'form_save_draft',target:'establishment',risk:'medium'},
  result:{ok:true,record_id:'draft-1',status:'draft'}
};
describe('draft success requires a server read-back', () => {
  test('records success only after reading the owned persisted draft', async () => {
    const db = database({id:'draft-1',user_id:'user-1',status:'draft'});
    expect((await resolveAssistantAction({...args,supabase:db})).state).toBe('resolved_succeeded');
    expect(db.from).toHaveBeenCalledWith('client_establishment_profiles');
    expect(db.query.eq).toHaveBeenCalledWith('user_id','user-1');
    expect(db.query.eq).toHaveBeenCalledWith('id','draft-1');
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });
  test.each([
    null,
    {id:'draft-1',user_id:'other-user',status:'draft'},
    {id:'draft-1',user_id:'user-1',status:'submitted'},
    {id:'different-id',user_id:'user-1',status:'draft'}
  ])('rejects an absent, foreign, changed or mismatched record: %p', async record => {
    const db = database(record);
    await expect(resolveAssistantAction({...args,supabase:db})).rejects.toThrow('DRAFT_RECEIPT_NOT_VERIFIED');
    expect(db.rpc).not.toHaveBeenCalled();
  });
  test('a failed read never becomes successful execution', async () => {
    const db = database(null,{message:'unavailable'});
    await expect(resolveAssistantAction({...args,supabase:db})).rejects.toThrow('DRAFT_RECEIPT_NOT_VERIFIED');
    expect(db.rpc).not.toHaveBeenCalled();
  });
  test('uncertain execution can still be marked to prevent duplicate writes', async () => {
    const db=database(null);
    await resolveAssistantAction({...args,supabase:db,status:'uncertain',result:null});
    expect(db.from).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });
});

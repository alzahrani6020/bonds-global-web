const {assertMinisterOfficeSmoke} = require('../../scripts/minister-office-smoke');

const verified = {res:{ok:true,status:200},body:{reply:'أحمد بن محمد هو وزير الداخلية في السعودية.\nhttps://example.org/evidence',
  inference:{planner:'universal-v2-deterministic-research',tool_used:true}}};
test('the staged release gate rejects a 200 response without a holder or source', async () => {
  const request = jest.fn().mockResolvedValue({res:{ok:true,status:200},body:{reply:'لم أتمكن من توثيق شاغل المنصب',
    inference:{planner:'universal-v2-deterministic-research',tool_used:true}}});
  await expect(assertMinisterOfficeSmoke({baseUrl:'https://staged.example',token:'synthetic-fixture',request}))
    .rejects.toThrow('MINISTER_OFFICE_SMOKE_FAILED');
});
test('the gate exercises the screenshot question in execute mode without hardcoding an incumbent', async () => {
  const request = jest.fn().mockResolvedValue(verified);
  await assertMinisterOfficeSmoke({baseUrl:'https://staged.example',token:'synthetic-fixture',request});
  const body = JSON.parse(request.mock.calls[0][1].body);
  expect(body).toMatchObject({conversation_mode:'execute',messages:[{role:'user',content:'من هو وزير الداخلية السعودي؟'}]});
});
test('the gate rejects research that exceeds its 30 second acceptance budget', async () => {
  const now = jest.fn().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(45000);
  await expect(assertMinisterOfficeSmoke({baseUrl:'https://staged.example',token:'synthetic-fixture',request:async()=>verified,now}))
    .rejects.toThrow('elapsed_ms=45000');
});
test('checks the new screenshot in financial mode and rejects an interior-only answer', async()=>{
  const office={question:'من وزير الخارجية السعودي',portfolio:'الخارجية',conversationMode:'financial'};
  await expect(assertMinisterOfficeSmoke({...office,baseUrl:'https://staged.example',token:'synthetic-fixture',request:async()=>verified}))
    .rejects.toThrow('MINISTER_OFFICE_SMOKE_FAILED');
  const request=jest.fn().mockResolvedValue({...verified,body:{...verified.body,reply:verified.body.reply.replace('الداخلية','الخارجية')}});
  await assertMinisterOfficeSmoke({...office,baseUrl:'https://staged.example',token:'synthetic-fixture',request});
  expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({conversation_mode:'financial',messages:[{role:'user',content:'من وزير الخارجية السعودي'}]});
});

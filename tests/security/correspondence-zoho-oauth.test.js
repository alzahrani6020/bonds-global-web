'use strict';
const {buildAuthorizeUrl,exchangeCode,refreshToken,verifiedAccount}=require('../../lib/api/correspondence-zoho-oauth');
describe('Zoho OAuth account binding',()=>{
 test('consent URL is allowlisted and preserves consent state',()=>{
  const uri=buildAuthorizeUrl({region:'com',clientId:'1000.client',redirectUri:'https://bonds-global.com/api/campaign-mailboxes',state:'a'.repeat(42)});
  const url=new URL(uri);
  expect(url.hostname).toBe('accounts.zoho.com');
  expect(url.searchParams.get('access_type')).toBe('offline');
  expect(url.searchParams.get('state')).toBe('a'.repeat(42));
  expect(url.searchParams.get('scope')).toContain('ZohoMail.messages.CREATE');
 });
 test('invalid region and insecure redirect fail closed',()=>{
  expect(()=>buildAuthorizeUrl({region:'evil.example',clientId:'1000.client',redirectUri:'https://bonds-global.com/api/campaign-mailboxes',state:'a'.repeat(42)})).toThrow('UNKNOWN_ZOHO_REGION');
  expect(()=>buildAuthorizeUrl({region:'com',clientId:'1000.client',redirectUri:'http://bonds-global.com/api/campaign-mailboxes',state:'a'.repeat(42)})).toThrow('INVALID_ZOHO_REDIRECT');
 });
 test('token exchange does not reuse browser identity as sender',async()=>{
  const fetcher=jest.fn(async()=>({ok:true,json:async()=>({access_token:'fake-access-token',refresh_token:'fake-refresh-token'})}));
  const result=await exchangeCode({region:'com',clientId:'client',clientSecret:'secret',redirectUri:'https://bonds-global.com/api/campaign-mailboxes',code:'fake-authorization-code',fetcher});
  expect(result.refresh_token).toBe('fake-refresh-token');
  const [url,options]=fetcher.mock.calls[0];
  expect(url).toBe('https://accounts.zoho.com/oauth/v2/token');
  expect(options.method).toBe('POST');
  const body=new URLSearchParams(options.body);
  expect(body.get('grant_type')).toBe('authorization_code');
 });
 test('refresh requires provider response token',async()=>{
  const fetcher=jest.fn(async()=>({ok:true,json:async()=>({access_token:'new-token'})}));
  expect((await refreshToken({region:'com',clientId:'client',clientSecret:'secret',refreshToken:'fake-refresh',fetcher})).access_token).toBe('new-token');
 });
 test('verified account requires confirmed sender alias',async()=>{
  const data={status:{code:200},data:[{accountId:'123456789',enabled:true,outgoingBlocked:false,mailboxStatus:'enabled',
    emailAddress:[{mailId:'info@bonds-global.com',isConfirmed:true}]}]};
  const fetcher=jest.fn(async()=>({ok:true,json:async()=>data}));
  const account=await verifiedAccount({region:'com',address:'info@bonds-global.com',accessToken:'fake-token',fetcher});
  expect(account.accountId).toBe('123456789');
  data.data[0].emailAddress[0].isConfirmed=false;
  await expect(verifiedAccount({region:'com',address:'info@bonds-global.com',accessToken:'fake-token',fetcher})).rejects.toThrow('ZOHO_SENDER_NOT_CONFIRMED');
 });
});

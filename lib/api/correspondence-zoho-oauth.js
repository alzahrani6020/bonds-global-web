'use strict';
const HOSTS=Object.freeze({
 com:'accounts.zoho.com',eu:'accounts.zoho.eu',in:'accounts.zoho.in',
 comau:'accounts.zoho.com.au',jp:'accounts.zoho.jp',ca:'accounts.zohocloud.ca',
 comcn:'accounts.zoho.com.cn'
});
const MAIL_HOSTS=Object.freeze({
 com:'mail.zoho.com',eu:'mail.zoho.eu',in:'mail.zoho.in',
 comau:'mail.zoho.com.au',jp:'mail.zoho.jp',ca:'mail.zohocloud.ca',
 comcn:'mail.zoho.com.cn'
});
const SCOPES='ZohoMail.accounts.READ,ZohoMail.messages.CREATE,ZohoMail.messages.READ';
function reject(code){throw new Error(code);}
function regionHost(region){if(!Object.prototype.hasOwnProperty.call(HOSTS,region))reject('UNKNOWN_ZOHO_REGION');return HOSTS[region];}
function checkRedirect(uri){
 try{const url=new URL(uri);if(url.protocol!=='https:'||url.username||url.password||url.hash)reject('INVALID_ZOHO_REDIRECT');return url.toString();}
 catch(_e){reject('INVALID_ZOHO_REDIRECT');}
}
function buildAuthorizeUrl({region,clientId,redirectUri,state}){
 if(typeof clientId!=='string'||clientId.length<5||typeof state!=='string'||state.length<32)reject('ZOHO_OAUTH_CONFIG_INVALID');
 const u=new URL('https://'+regionHost(region)+'/oauth/v2/auth');
 u.search=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:checkRedirect(redirectUri),scope:SCOPES,access_type:'offline',prompt:'consent',state}).toString();
 return u.toString();
}
async function tokenRequest({region,clientId,clientSecret,parameters,fetcher=fetch}){
 if(!clientId||!clientSecret)reject('ZOHO_OAUTH_CONFIG_MISSING');
 const url='https://'+regionHost(region)+'/oauth/v2/token';
 const body=new URLSearchParams({...parameters,client_id:clientId,client_secret:clientSecret});
 const res=await fetcher(url,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});
 const payload=await res.json().catch(()=>null);
 if(!res.ok||!payload?.access_token)reject('ZOHO_TOKEN_EXCHANGE_FAILED');
 return payload;
}
async function exchangeCode(input){
 if(!input.code||typeof input.code!=='string'||input.code.length>1024)reject('INVALID_ZOHO_CODE');
 return tokenRequest({...input,parameters:{grant_type:'authorization_code',code:input.code,redirect_uri:checkRedirect(input.redirectUri)}});
}
async function refreshToken(input){
 if(!input.refreshToken||typeof input.refreshToken!=='string')reject('INVALID_REFRESH_TOKEN');
 return tokenRequest({...input,parameters:{grant_type:'refresh_token',refresh_token:input.refreshToken}});
}
async function verifiedAccount({region,address,accessToken,fetcher=fetch}){
 if(!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(String(address||'')))reject('INVALID_SENDER_ADDRESS');
 if(!accessToken)reject('ZOHO_ACCESS_TOKEN_MISSING');
 regionHost(region);
 const res=await fetcher('https://'+MAIL_HOSTS[region]+'/api/accounts',{
   headers:{Accept:'application/json',Authorization:'Zoho-oauthtoken '+accessToken}
 });
 const response=await res.json().catch(()=>null);
 if(!res.ok||Number(response?.status?.code)!==200||!Array.isArray(response?.data))reject('ZOHO_ACCOUNT_LOOKUP_FAILED');
 const requested=address.toLowerCase();
 const account=response.data.find(a=>String(a.accountId||'').match(/^\d{4,24}$/)&&
  a.enabled===true&&a.outgoingBlocked!==true&&a.mailboxStatus==='enabled'&&
  Array.isArray(a.emailAddress)&&a.emailAddress.some(e=>
    String(e.mailId||'').toLowerCase()===requested&&e.isConfirmed===true));
 if(!account)reject('ZOHO_SENDER_NOT_CONFIRMED');
 return Object.freeze({accountId:String(account.accountId),address:requested,region});
}
module.exports={buildAuthorizeUrl,exchangeCode,refreshToken,verifiedAccount,HOSTS,MAIL_HOSTS};

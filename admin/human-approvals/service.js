/* Human Approval Queue admin service */
/* global BondsAuth */
(function(){
  'use strict';
  const BASE='/api/v3/admin/human-approvals';
  async function request(path='',options={}){
    if(!window.BondsAuth||!BondsAuth.authenticatedFetch)throw new Error('AUTH_UNAVAILABLE');
    const res=await BondsAuth.authenticatedFetch(BASE+path,{
      ...options,
      headers:{'Content-Type':'application/json',...(options.headers||{})},
      redirectOnAuth:true
    });
    if(!res||res.__authError)throw new Error(res?.authError||'AUTH_REQUIRED');
    const data=await res.json();
    if(!res.ok||data.success===false)throw new Error(data.error||'HUMAN_APPROVAL_REQUEST_FAILED');
    return data;
  }
  window.HumanApprovalService={
    async list(filters={}){
      const q=new URLSearchParams();
      for(const [k,v] of Object.entries(filters))if(v!==undefined&&v!==null&&v!=='')q.set(k,v);
      return request(q.toString()?'?'+q.toString():'');
    },
    async decide(id,decision,note){
      return request('/'+encodeURIComponent(id)+'/decision',{
        method:'POST',body:JSON.stringify({decision,note:note||null})
      });
    }
  };
})();

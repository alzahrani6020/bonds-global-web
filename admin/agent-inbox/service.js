/* Agent Inbox admin service */
/* global BondsAuth */
(function () {
  'use strict';

  const BASE='/api/v3/admin/agent-inbox';

  async function request(path='', options={}) {
    if (!window.BondsAuth || !BondsAuth.authenticatedFetch) throw new Error('AUTH_UNAVAILABLE');
    const res=await BondsAuth.authenticatedFetch(BASE+path, {
      ...options,
      headers:{ 'Content-Type':'application/json', ...(options.headers||{}) },
      redirectOnAuth:true
    });
    if (!res || res.__authError) throw new Error(res?.authError || 'AUTH_REQUIRED');
    const data=await res.json();
    if (!res.ok || data.success === false) throw new Error(data.error || 'AGENT_INBOX_REQUEST_FAILED');
    return data;
  }

  window.AgentInboxService={
    async list(filters={}) {
      const q=new URLSearchParams();
      for(const [k,v] of Object.entries(filters)) if(v!==undefined && v!==null && v!=='') q.set(k,v);
      return request(q.toString() ? '?'+q.toString() : '');
    },
    async assignees() { return request('/assignees'); },
    async update(id, patch) {
      return request('/'+encodeURIComponent(id), {
        method:'PATCH',
        body:JSON.stringify(patch||{})
      });
    }
  };
})();

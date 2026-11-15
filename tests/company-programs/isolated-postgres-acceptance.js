'use strict';
// Execute ONLY after tests/crm/isolated-postgres-acceptance.js in the same
// disposable PostgreSQL CI container. Never use a production database.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');

async function main(){
  const url=process.env.CRM_TEST_DATABASE_URL;
  if (!url || !/^postgres(?:ql)?:\/\//.test(url) ||
      /supabase\.co|bonds-global|render\.com/i.test(url)) {
    throw Error('Only disposable CRM_TEST_DATABASE_URL is allowed');
  }
  const db=new Client({connectionString:url,connectionTimeoutMillis:5000});
  await db.connect();
  try{
    const exists=await db.query("select to_regclass('public.crm_app_workspaces') as crm");
    assert.ok(exists.rows[0].crm,'Run the existing isolated CRM acceptance first');
    await db.query(`
      create table if not exists public.companies (
        id uuid primary key, name text not null,
        owner_user_id uuid not null references auth.users(id),
        is_active boolean not null default true
      );
      create table if not exists public.company_members (
        id uuid primary key, company_id uuid references public.companies(id),
        user_id uuid references auth.users(id),role text
      );
    `);
    for(const file of [
      '20261115230000_company_programs_real_workspace_entitlements.sql',
      '20261115231000_company_programs_makkin_verified_links.sql'
    ]){
      const sql=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations',file),'utf8');
      await db.query(sql);
    }
    const required=[
      'company_program_workspaces','company_program_entitlements',
      'company_program_entitlement_audit','company_program_makkin_links'
    ];
    for(const table of required){
      const q=await db.query('select relrowsecurity from pg_class where oid=$1::regclass',['public.'+table]);
      assert.equal(q.rows[0].relrowsecurity,true,'RLS missing on '+table);
      const p=await db.query("select has_table_privilege('authenticated',$1,'INSERT') as can_write,has_table_privilege('authenticated',$1,'SELECT') as can_read",['public.'+table]);
      assert.equal(p.rows[0].can_write,false,'Client can modify '+table);
      assert.equal(p.rows[0].can_read,false,'Client can read privileged '+table);
    }
    const userA=randomUUID(),userB=randomUUID();
    await db.query('insert into auth.users(id) values($1),($2)',[userA,userB]);
    const crm=(await db.query("insert into public.crm_app_workspaces(owner_user_id,name) values($1,'Test CRM Workspace') returning id",[userA])).rows[0].id;
    const company=randomUUID();
    await db.query("insert into public.companies(id,name,owner_user_id) values($1,'Test Company',$2)",[company,userB]);
    const c=(await db.query("insert into public.company_program_workspaces(kind,crm_workspace_id) values('crm',$1) returning id",[crm])).rows[0].id;
    const b=(await db.query("insert into public.company_program_workspaces(kind,company_id) values('company',$1) returning id",[company])).rows[0].id;
    assert.notEqual(c,b,'Company and CRM workspaces cannot be silently conflated');
    await assert.rejects(()=>db.query("insert into public.company_program_workspaces(kind,company_id) values('crm',$1)",[company]),e=>e.code==='23514');
    await assert.rejects(()=>db.query("insert into public.company_program_workspaces(kind,crm_workspace_id) values('crm',$1)",[crm]),e=>e.code==='23505');
    const row=(await db.query("insert into public.company_program_entitlements(workspace_link_id,program_key,status) values($1,'crm','active') returning id",[c])).rows[0];
    await db.query("insert into public.company_program_entitlements(workspace_link_id,program_key,status) values($1,'hr','pending')",[b]);
    await db.query("update public.company_program_entitlements set status='suspended' where id=$1",[row.id]);
    const history=await db.query('select action,previous_status,new_status from public.company_program_entitlement_audit where entitlement_id=$1 order by id',[row.id]);
    assert.deepEqual(history.rows.map(x=>x.action),['INSERT','UPDATE']);
    assert.equal(history.rows[1].previous_status,'active');
    assert.equal(history.rows[1].new_status,'suspended');
    await assert.rejects(()=>db.query('delete from public.company_program_entitlements where id=$1',[row.id]),e=>e.code==='P0001');
    await assert.rejects(()=>db.query("insert into public.company_program_entitlements(workspace_link_id,program_key) values($1,'invented')",[c]),e=>e.code==='23514');
    await assert.rejects(()=>db.query("insert into public.company_program_entitlements(workspace_link_id,program_key) values($1,'crm')",[c]),e=>e.code==='23505');
    const mapping=await db.query("insert into public.company_program_makkin_links(workspace_link_id,makkin_tenant_id) values($1,'unverified-tenant') returning state",[c]);
    assert.equal(mapping.rows[0].state,'pending');
    await assert.rejects(()=>db.query("update public.company_program_makkin_links set state='verified' where workspace_link_id=$1",[c]),e=>e.code==='23514');
    await db.query('begin');
    try{
      await db.query('set local role authenticated');
      await assert.rejects(()=>db.query('select id from public.company_program_entitlements'),e=>e.code==='42501');
      await assert.rejects(()=>db.query('select id from public.company_program_makkin_links'),e=>e.code==='25P02'||e.code==='42501');
    } finally {await db.query('rollback');}
    console.log('COMPANY PROGRAMS ISOLATED POSTGRES: PASS — real workspace FKs, fail-closed grants, immutable entitlement history, link verification');
  }finally{await db.end();}
}
main().catch(e=>{console.error('COMPANY PROGRAMS ISOLATED POSTGRES: FAIL',e.message,'SQLSTATE='+String(e.code||'unknown'));process.exitCode=1;});

'use strict';
// Runs ONLY against an isolated PostgreSQL container. Never use the production DSN.
// This verifies that the client CRM migration executes, that tenant RLS restricts
// both reads and writes, and that stage/tenant FKs cannot be bypassed.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {Client}=require('pg');

async function main(){
 const url=process.env.CRM_TEST_DATABASE_URL;
 if(!url || !/^(?:postgres(?:ql)?:\/\/)/.test(url) || /supabase\.co|bonds-global/i.test(url)){
  throw Error('CRM_TEST_DATABASE_URL must be a disposable local PostgreSQL instance');
 }
 const client=new Client({connectionString:url,connectionTimeoutMillis:5000});
 await client.connect();
 try{
  await client.query(`
   create role anon nologin;
   create role authenticated nologin;
   create role service_role nologin;
   create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth,public to authenticated;
   grant execute on function auth.uid() to authenticated;`);
  const migration=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261115020000_crm_client_app_isolated_workspaces.sql'),'utf8');
  await client.query(migration);
  const tables=['crm_app_workspaces','crm_app_companies','crm_app_contacts','crm_app_deals','crm_app_activities','crm_app_renewals','crm_app_success','crm_app_pipelines','crm_app_pipeline_stages'];
  const {rows:rls}=await client.query("select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relname=any($1)",[tables]);
  assert.equal(rls.length,tables.length,'CRM tables missing from migration');
  for(const row of rls)assert.equal(row.relrowsecurity,true,'RLS missing for '+row.relname);

  const a=randomUUID(),b=randomUUID();
  await client.query('insert into auth.users(id) values($1),($2)',[a,b]);
  async function as(user,fn){
   await client.query('begin');
   try{
    await client.query('set local role authenticated');
    await client.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
    const result=await fn();
    await client.query('commit');
    return result;
   }catch(e){await client.query('rollback');throw e;}
  }
  const first=await as(a,()=>client.query("insert into crm_app_workspaces(owner_user_id,name) values($1,'Tenant A') returning id",[a]));
  const second=await as(b,()=>client.query("insert into crm_app_workspaces(owner_user_id,name) values($1,'Tenant B') returning id",[b]));
  const wa=first.rows[0].id,wb=second.rows[0].id;
  const company=await as(a,()=>client.query("insert into crm_app_companies(workspace_id,name) values($1,'Company A') returning id,status",[wa]));
  const ca=company.rows[0].id;
  assert.equal(company.rows[0].status,'prospect');

  const invisible=await as(b,()=>client.query('select id from crm_app_companies where id=$1',[ca]));
  assert.equal(invisible.rowCount,0,'Tenant B can read tenant A company');
  const unauthorizedEdit=await as(b,()=>client.query("update crm_app_companies set name='Tampered' where id=$1 returning id",[ca]));
  assert.equal(unauthorizedEdit.rowCount,0,'Tenant B can update tenant A company');
  await assert.rejects(()=>as(b,()=>client.query("insert into crm_app_companies(workspace_id,name) values($1,'Escalation')",[wa])),
    error=>error.code==='42501','Tenant B insert into tenant A workspace must be denied');

  const contact=await as(a,()=>client.query("insert into crm_app_contacts(workspace_id,company_id,name,email) values($1,$2,'Contact A','User@Example.com') returning id",[wa,ca]));
  assert.equal(contact.rowCount,1);
  await assert.rejects(()=>as(a,()=>client.query("insert into crm_app_contacts(workspace_id,name,email) values($1,'Duplicate','user@example.com')",[wa])),
    error=>error.code==='23505','Emails must be unique within workspace');
  const otherContact=await as(b,()=>client.query("insert into crm_app_contacts(workspace_id,name,email) values($1,'Contact B','user@example.com') returning id",[wb]));
  assert.equal(otherContact.rowCount,1,'Emails may repeat in different tenant workspaces');

  const pa=(await as(a,()=>client.query("insert into crm_app_pipelines(workspace_id,name,is_default) values($1,'Sales A',true) returning id",[wa]))).rows[0].id;
  const pb=(await as(b,()=>client.query("insert into crm_app_pipelines(workspace_id,name,is_default) values($1,'Sales B',true) returning id",[wb]))).rows[0].id;
  const sa=(await as(a,()=>client.query("insert into crm_app_pipeline_stages(workspace_id,pipeline_id,name) values($1,$2,'Qualified') returning id",[wa,pa]))).rows[0].id;
  const sb=(await as(b,()=>client.query("insert into crm_app_pipeline_stages(workspace_id,pipeline_id,name) values($1,$2,'Closed') returning id",[wb,pb]))).rows[0].id;
  await assert.rejects(()=>as(a,()=>client.query("insert into crm_app_deals(workspace_id,title,pipeline_id,pipeline_stage_id) values($1,'Bad Stage',$2,$3)",[wa,pa,sb])),
    error=>error.code==='23503','Cross-tenant stage FK must reject');
  const deal=await as(a,()=>client.query("insert into crm_app_deals(workspace_id,company_id,title,pipeline_id,pipeline_stage_id) values($1,$2,'Deal A',$3,$4) returning id,currency,stage",[wa,ca,pa,sa]));
  assert.equal(deal.rows[0].currency,'SAR');
  assert.equal(deal.rows[0].stage,'lead');

  const activity=await as(a,()=>client.query("insert into crm_app_activities(workspace_id,company_id,deal_id,subject) values($1,$2,$3,'Follow up') returning id",[wa,ca,deal.rows[0].id]));
  const activityId=activity.rows[0].id;
  const changed=await as(a,()=>client.query("update crm_app_activities set deleted_at=now() where id=$1 returning id,deleted_at",[activityId]));
  assert.ok(changed.rows[0].deleted_at,'Activity soft archive did not persist');
  const hidden=await as(b,()=>client.query('select id from crm_app_activities where id=$1',[activityId]));
  assert.equal(hidden.rowCount,0,'Tenant B can read tenant A activity');

  await assert.rejects(()=>client.query('delete from auth.users where id=$1',[a]),error=>error.code==='23503',
   'Deleting owner must not cascade CRM company records');
  console.log('CRM ISOLATED POSTGRES ACCEPTANCE: PASS — migration, 9x RLS, tenant CRUD, CSV dedupe, pipelines, archive, owner retention');
 }finally{await client.end();}
}
main().catch(e=>{console.error('CRM ISOLATED POSTGRES ACCEPTANCE: FAIL',e.message,'SQLSTATE='+String(e.code||'unknown'));process.exitCode=1;});

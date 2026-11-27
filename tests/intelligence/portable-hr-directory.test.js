'use strict';
const {createHrCommercialDirectory}=require('../../lib/api/commercial-directory-hr');
const A='12345678-1234-4123-8123-1234567890ab';
function fake({owner=true,entitled=true,authenticated=true}={}){
 const db={auth:{getUser:async()=>authenticated?{data:{user:{id:'actor',is_anonymous:false}},error:null}:{data:null,error:{code:'401'}}},
  from:jest.fn(table=>{
   const query={
    select:jest.fn(()=>query),eq:jest.fn(()=>query),order:jest.fn(()=>query),ilike:jest.fn(()=>query),
    maybeSingle:jest.fn(async()=>({data:owner?{id:A,owner_user_id:'actor'}:{id:A,owner_user_id:'stranger'},error:null})),
    limit:jest.fn(async()=>({data:table==='hr_saas_workspaces'?(entitled?[{id:'hr-workspace',crm_workspace_id:A}]:[]):[{id:'record-1',name:'شركة الريادة'}],error:null}))
   };return query;
  })};
 return db;
}
function res(){return {statusCode:0,body:null,setHeader(){},status(v){this.statusCode=v;return this},json(v){this.body=v;return this}}}
const req=(suffix='')=>({method:'GET',url:'/api/commercial-directory-hr?workspace_id='+A+'&type=organizations'+suffix,headers:{authorization:'Bearer signed-hr-session'}})
describe('HR read-only licensed shared directory',()=>{
 test('owner of linked HR and CRM workspace receives approved name-only directory',async()=>{
  const db=fake(),result=res();await createHrCommercialDirectory({clientFactory:()=>db})(req(),result);
  expect(result.statusCode).toBe(200);
  expect(result.body).toMatchObject({workspace_id:A,read_only:true,create_employee:false,send_mail:false});
  expect(result.body.items[0].name).toBe('شركة الريادة');
  expect(db.from).toHaveBeenCalledWith('hr_saas_workspaces');
 });
 test('no HR entitlement or different CRM ownership yields no data',async()=>{
  let result=res();await createHrCommercialDirectory({clientFactory:()=>fake({entitled:false})})(req(),result);expect(result.statusCode).toBe(403);
  result=res();await createHrCommercialDirectory({clientFactory:()=>fake({owner:false})})(req(),result);expect(result.statusCode).toBe(404);
 });
 test('anonymous, malformed workspace and forbidden query fail closed',async()=>{
  let result=res();await createHrCommercialDirectory({clientFactory:()=>fake({authenticated:false})})(req(),result);expect(result.statusCode).toBe(401);
  result=res();await createHrCommercialDirectory({clientFactory:()=>fake()})(req('&q=%25'),result);expect(result.statusCode).toBe(400);
  result=res();await createHrCommercialDirectory({clientFactory:()=>fake()})({...req(),headers:{}},result);expect(result.statusCode).toBe(401);
 });
});

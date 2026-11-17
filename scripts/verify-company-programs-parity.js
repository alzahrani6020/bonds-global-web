#!/usr/bin/env node
'use strict';
// Strict release gate: does NOT accept product names/links as evidence.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const source=read('docs/makkin-source-inventory-20261115.json');
const routes=read('docs/makkin-route-transfer-matrix.json');
const errors=[];
function fail(message){errors.push(message);}
const srcRoutes=new Map(source.navigation.map(item=>[item.path,item]));
const destRoutes=new Map();
for(const entry of routes.routes){
 if(!srcRoutes.has(entry.sccRoute))fail('Unknown SCC route: '+entry.sccRoute);
 if(destRoutes.has(entry.sccRoute))fail('Duplicated route: '+entry.sccRoute);
 if(!entry.ownerPrograms?.length)fail('Unowned route: '+entry.sccRoute);
 destRoutes.set(entry.sccRoute,entry);
 if(!entry.bondsRoute||entry.transferStatus!=='VERIFIED'||
    entry.fieldAndWorkflowParity!=='PASS'){
   fail('Not operationally migrated: '+entry.sccRoute);
 }else{
   const resolved=path.resolve(root,entry.bondsRoute.replace(/^\//,''));
   if(!resolved.startsWith(root+path.sep)||!fs.existsSync(resolved))
     fail('Missing BONDS file for: '+entry.sccRoute);
 }
}
for(const srcRoute of srcRoutes.keys()){
 if(!destRoutes.has(srcRoute))fail('Source route omitted: '+srcRoute);
}
if(source.models.length<1 || source.summary.modelFields<1 || source.apiModules.length<1)
 fail('Missing field/model/module source inventory');
if(!fs.existsSync(path.join(root,'docs/makkin-database-field-parity.json')))
 fail('Missing field-by-field schema and migration proof');
else {
 const parity=read('docs/makkin-database-field-parity.json');
 const models=new Map(parity.models.map(m=>[m.model,m]));
 for(const model of source.models) {
  const target=models.get(model.name);
  if(!target) { fail('Missing source model: '+model.name); continue; }
  const fields=new Map(target.fields.map(f=>[f.sourceField,f]));
  for(const field of model.fields) {
   const match=fields.get(field.name);
   if(!match) { fail('Missing field: '+model.name+'.'+field.name); continue; }
   if(match.sourceType!==field.type)fail('Type mismatch: '+model.name+'.'+field.name);
   if(!match.bondsTable||!match.bondsField||
       match.status!=='VERIFIED'||!match.evidence)
     fail('Field not verified: '+model.name+'.'+field.name);
  }
 }
}
if(!fs.existsSync(path.join(root,'docs/makkin-operational-e2e-evidence.json')))
 fail('Missing authenticated real-workspace workflow evidence');
const result={
 status:errors.length?'FAIL':'PASS',
 source:{routes:source.navigation.length,models:source.models.length,
         fields:source.summary.modelFields,modules:source.apiModules.length},
 checkedRoutes:routes.routes.length,errors:errors.length,
 details:errors.slice(0,100)
};
console.log(JSON.stringify(result,null,2));
if(errors.length)process.exitCode=1;

'use strict';
const {analyzeEntities,possibleDuplicates}=require('../../lib/portable-intelligence/entity-intelligence');
describe('tenant-neutral commercial entity extraction',()=>{
 test('Arabic source evidence stays review-only',()=>{
  const r=analyzeEntities('اسم الشركة: شركة الأفق للخدمات\nالمدينة: جدة\ninfo@afaq.example',{filename:'card.pdf',kind:'pdf'});
  expect(r.candidates).toMatchObject({organization_name:'شركة الأفق للخدمات',city:'جدة',email:'info@afaq.example'});
  expect(r.provenance.organization_name).toMatchObject({filename:'card.pdf',line:1});
  expect(r.auto_saved).toBe(false);expect(r.records).toEqual([]);
 });
 test.each([['وزارة الصحة','government'],['مدرسة المروج','school'],['مستشفى الحياة','hospital'],['مصنع الرمال','factory']])('%s categorized for review', (name,category)=>{
  expect(analyzeEntities('اسم الجهة: '+name).classification.category).toBe(category);
 });
 test('no guessing from unlabeled source',()=>{
  const r=analyzeEntities('document without organization but info@example.com');
  expect(r.candidates.organization_name).toBeUndefined();expect(r.classification.requires_review).toBe(true);
 });
 test('duplicate suggestions do not cross record types',()=>{
  const r=possibleDuplicates({type:'organization',name:'شركة أحمد',email:'info@test.com'},[{id:1,type:'organization',name:'شركة احمد'},{id:2,type:'contact',name:'شركة أحمد',email:'info@test.com'}]);
  expect(r).toEqual([{id:1,reasons:['name']}]);
 });
 test('bounded input',()=>expect(()=>analyzeEntities('a'.repeat(120001))).toThrow('ENTITY_TEXT_LIMIT'));
});

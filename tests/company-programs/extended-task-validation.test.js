/** @jest-environment node */
'use strict';
const {validateMakkinWriteOperation:validate}=require('../../lib/company-programs/makkin-write-operations');
const base={title:'Task',description:'Safety acceptance',status:'IN_PROGRESS',priority:'URGENT',
 dueDate:'2026-12-02',estimatedHours:2.5};
test('staging task accepts SCC-defined lifecycle and planning fields without tenant override',()=>{
 const operation=validate('projects','projects.tasks.create',base);
 expect(operation).toMatchObject({
  operation:{program:'projects',path:'/projects/tasks',verify:'title'},
  data:base
 });
 expect(validate('projects','projects.tasks.create',{title:'  Normalized  ',priority:'LOW'}).data.title)
  .toBe('Normalized');
});
test.each([
 {title:'Valid',tenantId:'forged'},
 {title:'Valid',projectId:'other-company-project'},
 {title:'Valid',assignedToId:'other-user'},
 {title:'Valid',parentId:'other-company-task'},
 {title:'Valid',status:'DONE'},
 {title:'Valid',status:'CANCELLED'},
 {title:'Valid',priority:'CRITICAL'},
 {title:'Valid',dueDate:'2026-02-30'},
 {title:'Valid',dueDate:'2026/12/02'},
 {title:'Valid',estimatedHours:-1},
 {title:'Valid',estimatedHours:1000},
 {title:'Valid',estimatedHours:1.234},
 {title:'Valid',estimatedHours:'2.5'},
 {title:'Valid',estimatedHours:Infinity},
 {title:'Valid',description:42}
])('staging task disallows unsafe or invalid fields: %j',(payload)=>{
 expect(validate('projects','projects.tasks.create',payload)).toBeNull();
});
test('staging task cannot use another program or arbitrary operation',()=>{
 expect(validate('hr','projects.tasks.create',base)).toBeNull();
 expect(validate('projects','projects.tasks.update',base)).toBeNull();
 expect(validate('projects','projects.tasks.create',[])).toBeNull();
});

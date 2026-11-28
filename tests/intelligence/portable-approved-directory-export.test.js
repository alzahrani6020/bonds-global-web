'use strict';
const {exportReviewedDirectory}=require('../../lib/portable-intelligence/approved-directory-export');
const A='12345678-1234-4123-8123-1234567890ab',B='12345678-1234-4123-8123-1234567890ac';
const entries=[{id:1,workspace_id:A,record:{type:'organization',name:'Factory',email:'factory@example.org'},source:{filename:'origin.csv'}},{id:2,workspace_id:B,record:{type:'contact',name:'Foreign'},source:{filename:'other.csv'}}];
describe('portable approved directory export',()=>{
 const list=jest.fn(async()=>entries),authorize=jest.fn(async()=>true);
 test('exports approved fields without sending mail or creating employees',async()=>{
  const result=await exportReviewedDirectory({workspaceId:A,actorId:'owner',target:'correspondence',recordIds:[1],authorize,list});
  expect(result.records[0]).toMatchObject({name:'Factory',source:{filename:'origin.csv'}});
  expect(result).toMatchObject({send_mail:false,create_hr_employee:false,commit_destination:false,requires_destination_authorization:true});
  expect(authorize).toHaveBeenCalledWith({workspaceId:A,actorId:'owner',action:'correspondence.directory.export'});
 });
 test('refuses cross-company row even if storage accidentally returned it',async()=>{
  await expect(exportReviewedDirectory({workspaceId:A,actorId:'owner',target:'crm',recordIds:[2],authorize,list})).rejects.toThrow('EXPORT_RECORD_NOT_FOUND');
 });
 test('refuses export without permission or duplicate IDs',async()=>{
  await expect(exportReviewedDirectory({workspaceId:A,actorId:'viewer',target:'hr',recordIds:[1],authorize:async()=>false,list})).rejects.toThrow('EXPORT_NOT_AUTHORIZED');
  await expect(exportReviewedDirectory({workspaceId:A,actorId:'owner',target:'hr',recordIds:[1,1],authorize,list})).rejects.toThrow('INVALID_RECORD_SELECTION');
 });
});

'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const code=fs.readFileSync(path.join(root,'components/institutional-directory-import.js'),'utf8');
function harness(){
  const elements=new Map();
  function node(id){
    if(!elements.has(id)){
      elements.set(id,{
        id,value:'',disabled:false,hidden:false,textContent:'',files:[],
        addEventListener:jest.fn(),replaceChildren:jest.fn(),
        append:jest.fn(),requestSubmit:jest.fn()
      });
    }
    return elements.get(id);
  }
  const window={BondsAuth:{getSupabase:jest.fn()}};
  const document={documentElement:{lang:'ar'},getElementById:node,createElement:()=>({append:jest.fn(),textContent:''})};
  vm.runInNewContext(code,{window,document,process:{env:{NODE_ENV:'test'}},URL,Error,Set,String,Array}, {filename:'institutional-directory-import.js'});
  return {handlers:window.BONDS_INSTITUTIONAL_IMPORT_TEST,node,window};
}
describe('Institutional directory import -- strict explicit, tenant-scoped preparation',()=>{
 test('parses quoted commas and BOM header',()=>{
  const {handlers}=harness();
  const data=handlers.parseCsv('\uFEFFtype,name,sector,email\norganization,"University, Jeddah",university,office@example.org');
  expect(data).toHaveLength(1);
  expect(data[0].name).toBe('University, Jeddah');
  expect(data[0].sector).toBe('university');
 });
 test('rejects missing workspace/id authority fields in CSV header',()=>{
  const {handlers}=harness();
  expect(()=>handlers.parseCsv('type,name,workspace_id\norganization,X,ignored')).toThrow('INVALID_HEADERS');
  expect(()=>handlers.parseCsv('type,name,owner_user_id\ncontact,X,ignored')).toThrow('INVALID_HEADERS');
  expect(()=>handlers.parseCsv('type,name,name\norganization,X,X')).toThrow('INVALID_HEADERS');
 });
 test('rejects extra columns, malformed quotes and empty body',()=>{
  const {handlers}=harness();
  expect(()=>handlers.parseCsv('type,name\norganization,a,extra')).toThrow('INVALID_ROW_2');
  expect(()=>handlers.parseCsv('type,name\norganization,"a')).toThrow('INVALID_CSV');
  expect(()=>handlers.parseCsv('type,name')).toThrow('EMPTY_CSV');
 });
 test('bounds size and number of rows',()=>{
  const {handlers}=harness();
  expect(()=>handlers.parseCsv('x'.repeat(100001))).toThrow('FILE_TOO_LARGE');
  expect(()=>handlers.parseCsv('type,name\n'+'contact,x\n'.repeat(101))).toThrow('TOO_MANY_ROWS');
 });
 test('rejects malformed email, phone, control characters and oversize fields',()=>{
  const {handlers}=harness();
  const validate=handlers.validate;
  expect(()=>validate({type:'contact',name:'Test',email:'bad@@example.org'})).toThrow('INVALID_EMAIL');
  expect(()=>validate({type:'contact',name:'Test',phone:'not a phone'})).toThrow('INVALID_PHONE');
  expect(()=>validate({type:'organization',name:'Test\nInjected'})).toThrow('INVALID_FIELD');
  expect(()=>validate({type:'organization',name:'Test',city:'x'.repeat(101)})).toThrow('INVALID_FIELD');
  expect(()=>validate({type:'organization',name:'Test',sector:'not-supported'})).toThrow('INVALID_SECTOR');
 });
 test('does not allow CSV to alter authorization or CRM status',()=>{
  const {handlers}=harness();
  const x=handlers.validate({type:'organization',name:'Example',sector:'government',status:'active',workspace_id:'evil'});
  expect(x.row).toEqual({name:'Example',sector:'government',legal_name:null,city:null,country:null,email:null,phone:null,status:'prospect'});
  const y=handlers.validate({type:'contact',name:'Person',email:'person@example.org'});
  expect(y.row).toEqual({name:'Person',email:'person@example.org',phone:null,role:null,status:'lead'});
 });
 test('the save event is explicitly user-initiated and RLS scoped, with no provider mail operations',()=>{
  expect(code).toContain("addEventListener('click',async()=>");
  expect(code).toContain('workspace_id:workspaceId');
  expect(code).toContain('getAllKeys(sb');
  expect(code).toContain('sb.from(table).insert(');
  expect(code).toContain("await sb.auth.getUser()");
  expect(code).not.toMatch(/service_role|serviceRole|sendEmail|smtp|zoho\.send|\.delete\(/i);
  expect(code).not.toContain('localStorage');
  expect(code).not.toContain('sessionStorage');
 });
 test('the bilingual UI includes controls, confirmation, and no auto-import',()=>{
  for(const pathName of ['institutional-directory.html','en/institutional-directory.html']){
    const html=fs.readFileSync(path.join(root,pathName),'utf8');
    for(const id of ['institutional-entry-form','institutional-preview-csv','institutional-apply','institutional-csv','institutional-preview']){
      expect(html).toContain('id="'+id+'"');
    }
    expect(html).toContain('id="institutional-apply" disabled');
    expect(html).toContain('/components/institutional-directory-import.js?v=1');
  }
 });
});

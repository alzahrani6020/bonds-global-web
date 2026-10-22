'use strict';

const EMPLOYEE_ASSISTANT_VERSION = 1;
const EMPLOYEE_ROLES = Object.freeze(['owner','super_admin','admin','support']);

function clean(value,max=200){
  if(value===null||value===undefined)return null;
  const text=String(value).trim();
  return text?text.slice(0,max):null;
}

function configuredOwnerEmails(){
  return String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map(value=>value.trim().toLowerCase())
    .filter(Boolean);
}

function rolePolicy(role){
  const approver=['owner','super_admin','admin'].includes(role);
  const employee=EMPLOYEE_ROLES.includes(role);
  return {
    employee_only:employee,
    existing_authorization_only:true,
    permission_escalation:false,
    execution_authorized:false,
    auto_execute:false,
    agent_inbox:employee?'available':'unavailable',
    human_approval:approver?'review':'unavailable',
    support_can_decide_human_approvals:false
  };
}

async function resolveEmployeeAssistantMode({supabase,user}){
  if(!supabase||typeof supabase.from!=='function')throw new Error('EMPLOYEE_ASSISTANT_UNAVAILABLE');
  if(!user||!user.id)throw new Error('EMPLOYEE_ASSISTANT_USER_REQUIRED');

  const email=clean(user.email,320)?.toLowerCase()||'';
  let role=null;
  let source=null;

  if(email && configuredOwnerEmails().includes(email)){
    role='owner';
    source='owner_email';
  }else{
    const {data,error}=await supabase
      .from('admin_roles')
      .select('role')
      .eq('user_id',user.id)
      .maybeSingle();
    if(error)throw new Error('EMPLOYEE_ASSISTANT_ROLE_LOOKUP_FAILED');
    const candidate=clean(data?.role,50);
    if(EMPLOYEE_ROLES.includes(candidate)){
      role=candidate;
      source='admin_roles';
    }
  }

  const eligible=Boolean(role);
  return {
    version:EMPLOYEE_ASSISTANT_VERSION,
    current_mode:eligible?'employee':'customer',
    available_modes:eligible?['customer','employee']:['customer'],
    employee:{
      eligible,
      role:role||null,
      identity_source:source
    },
    policy:rolePolicy(role)
  };
}

async function buildEmployeeAssistantWorkspace({
  supabase,user,listAgentInbox,listHumanApprovalQueue
}){
  const mode=await resolveEmployeeAssistantMode({supabase,user});
  if(!mode.employee.eligible)throw new Error('EMPLOYEE_ASSISTANT_ACCESS_DENIED');

  const inbox=await listAgentInbox({supabase,limit:100});
  let approvals=null;
  if(['owner','super_admin','admin'].includes(mode.employee.role)){
    approvals=await listHumanApprovalQueue({supabase,status:'pending',limit:100});
  }

  return {
    ...mode,
    workspace:{
      agent_inbox:{
        active_count:Array.isArray(inbox?.items)?inbox.items.length:0
      },
      human_approvals:{
        available:Boolean(approvals),
        pending_count:Array.isArray(approvals?.items)?approvals.items.length:0
      }
    }
  };
}

module.exports={
  EMPLOYEE_ASSISTANT_VERSION,
  EMPLOYEE_ROLES,
  configuredOwnerEmails,
  rolePolicy,
  resolveEmployeeAssistantMode,
  buildEmployeeAssistantWorkspace
};

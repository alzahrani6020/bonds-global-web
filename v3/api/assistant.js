'use strict';

const {
  PROTOCOL,
  createEnvelope,
  planRegisteredAction
} = require('../../lib/assistant/protocol');
const contract = require('../../lib/assistant/assistant-protocol.contract.json');
const navigation = require('../../lib/assistant/navigation-registry.json');
const forms = require('../../lib/assistant/form-registry.json');
const { prepareConfirmation, resolveConfirmation } = require('../../lib/assistant/confirmation-engine');
const { claimAssistantAction, resolveAssistantAction } = require('../../lib/assistant/idempotency');
const { getSupabaseClient } = require('../lib/supabase');
const { appendAssistantAuditBestEffort } = require('../../lib/assistant/audit-trail');
const { saveWorkflowState, loadWorkflowState, setWorkflowStatus } = require('../../lib/assistant/workflow-state');
const { findOwnedDocuments, loadOwnedDocument } = require('../../lib/assistant/document-intelligence');
const { suggestDocumentWorkflow } = require('../../lib/assistant/document-workflow');
const { applyAssistantEvent } = require('../../lib/assistant/event-driven');
const { listOwnedDrafts } = require('../../lib/assistant/draft-center');
const { buildAgentInbox } = require('../../lib/assistant/agent-inbox');
const { transitionSensitiveWorkflowState } = require('../../lib/assistant/sensitive-workflow-state-machine');
const { deriveAgentInboxItem, verifyAgentInboxItemOwnership, enqueueAgentInboxItem, listAgentInbox } = require('../../lib/assistant/agent-inbox-queue');
const { createHumanEscalation, listUserHumanEscalations } = require('../../lib/assistant/human-escalation');
const { requestHumanApproval, listUserHumanApprovals, listHumanApprovalQueue } = require('../../lib/assistant/human-approval');
const { resolveEmployeeAssistantMode, buildEmployeeAssistantWorkspace } = require('../../lib/assistant/employee-assistant-mode');
const {
  featureForAssistantMutation,
  assertAssistantMutationEnabled,
  getAssistantEmergencyModeState
} = require('../../lib/assistant/emergency-kill-switch');
const { notificationsFromAssistantEvent } = require('../../lib/assistant/notification-engine');
const {
  persistAssistantNotifications,
  listAssistantNotifications,
  markAssistantNotificationRead
} = require('../../lib/assistant/notification-store');
const { getCachedIntrospection } = require('../../lib/assistant/safe-introspection-cache');
const { publicAssistantPolicyDescriptor } = require('../../lib/assistant/policy-engine');
const { simulateAssistantPolicy } = require('../../lib/assistant/policy-simulation');

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 262144) {
        reject(new Error('request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

async function assistantRouter(req, res, path, user) {
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

  const mutationFeature = featureForAssistantMutation(path, req.method);
  if (mutationFeature) {
    try {
      await assertAssistantMutationEnabled({
        supabase:getSupabaseClient(),
        feature:mutationFeature
      });
    } catch (err) {
      const readOnly = err.code === 'ASSISTANT_READ_ONLY_MODE';
      const disabled = err.code === 'ASSISTANT_FEATURE_DISABLED';
      return sendJson(res, 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:readOnly
          ? 'ASSISTANT_READ_ONLY_MODE'
          : disabled
            ? 'ASSISTANT_FEATURE_DISABLED'
            : 'ASSISTANT_KILL_SWITCH_UNAVAILABLE',
        feature:(readOnly || disabled) ? err.feature : mutationFeature,
        mode:readOnly ? 'read_only_emergency' : undefined,
        expires_at:(readOnly || disabled) ? (err.expires_at || null) : null,
        policy:{
          execution_authorized:false,
          auto_execute:false
        }
      });
    }
  }

  if (path === '/assistant/contract' && req.method === 'GET') {
    return sendJson(res, 200, contract);
  }
  if (path === '/assistant/navigation' && req.method === 'GET') {
    return sendJson(res, 200, navigation);
  }
  if (path === '/assistant/forms' && req.method === 'GET') {
    return sendJson(res, 200, forms);
  }
  if (path === '/assistant' && req.method === 'GET') {
    return sendJson(res, 200, createEnvelope({
      status:'ready',
      reply:'مساعد بوندز جاهز.',
      context:{ protocol:PROTOCOL, execution:'plan_only' }
    }));
  }

  if (path === '/assistant/policy' && req.method === 'GET') {
    return sendJson(res, 200, {
      protocol:PROTOCOL,
      status:'completed',
      policy:publicAssistantPolicyDescriptor()
    });
  }

  if (path === '/assistant/policy/simulate' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (_err) {
      return sendJson(res, 400, {
        protocol:PROTOCOL,
        status:'denied',
        error:'INVALID_JSON_BODY'
      });
    }

    try {
      const simulation=simulateAssistantPolicy(body);
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:'completed',
        simulation
      });
    } catch (err) {
      const code=String(err?.message || 'POLICY_SIMULATION_FAILED');
      const clientError=[
        'POLICY_SIMULATION_ACTION_REQUIRED',
        'POLICY_SIMULATION_LIMIT_EXCEEDED'
      ].includes(code);
      return sendJson(res, clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:clientError ? code : 'POLICY_SIMULATION_FAILED',
        policy:{
          simulation_only:true,
          authorization_source:false,
          execution_authorized:false,
          auto_execute:false
        }
      });
    }
  }

  if (path === '/assistant/introspection' && req.method === 'GET') {
    try {
      const introspection = await getCachedIntrospection({
        loader:async()=>({
          protocol:contract.protocol || PROTOCOL,
          protocol_version:Number(contract.version || 1),
          navigation_schema_version:Number(navigation.schema_version || 1),
          form_schema_version:Number(forms.schema_version || 1),
          navigation_targets:Object.keys(navigation.destinations || {}).length,
          registered_forms:Object.keys(forms.forms || {}).length,
          action_types:Array.isArray(contract.action?.allowed_types)
            ? contract.action.allowed_types
            : [],
          emergency_mode:await getAssistantEmergencyModeState({
            supabase:getSupabaseClient()
          })
        })
      });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:'completed',
        introspection
      });
    } catch (_err) {
      return sendJson(res, 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:'ASSISTANT_INTROSPECTION_UNAVAILABLE',
        policy:{
          informational_only:true,
          authorization_source:false,
          execution_authorized:false,
          auto_execute:false
        }
      });
    }
  }

  if (path === '/assistant/emergency-mode' && req.method === 'GET') {
    try {
      const emergencyMode = await getAssistantEmergencyModeState({
        supabase:getSupabaseClient()
      });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:'completed',
        emergency_mode:emergencyMode
      });
    } catch (err) {
      return sendJson(res, 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:'ASSISTANT_EMERGENCY_MODE_UNAVAILABLE',
        policy:{
          execution_authorized:false,
          auto_execute:false
        }
      });
    }
  }

  if (path === '/assistant/mode' && req.method === 'GET') {
    try {
      const mode = await resolveEmployeeAssistantMode({
        supabase:getSupabaseClient(),
        user
      });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:'completed',
        assistant_mode:mode
      });
    } catch (err) {
      const clientError = err.message === 'EMPLOYEE_ASSISTANT_USER_REQUIRED';
      return sendJson(res, clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/employee/workspace' && req.method === 'GET') {
    try {
      const workspace = await buildEmployeeAssistantWorkspace({
        supabase:getSupabaseClient(),
        user,
        listAgentInbox,
        listHumanApprovalQueue
      });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:'completed',
        employee_assistant:workspace
      });
    } catch (err) {
      const forbidden = err.message === 'EMPLOYEE_ASSISTANT_ACCESS_DENIED';
      const clientError = err.message === 'EMPLOYEE_ASSISTANT_USER_REQUIRED';
      return sendJson(res, forbidden ? 403 : clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }
  if (path === '/assistant/notifications' && req.method === 'GET') {
    try {
      const requestUrl = new URL(req.url || '/api/v3/assistant/notifications', 'http://localhost');
      const unreadOnly = ['1','true','yes'].includes(
        String(requestUrl.searchParams.get('unread') || '').toLowerCase()
      );
      const limit = requestUrl.searchParams.get('limit') || 25;
      const notifications = await listAssistantNotifications({
        supabase:getSupabaseClient(),
        userId:user.id,
        unreadOnly,
        limit
      });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:'completed',
        notifications,
        unread_count:notifications.filter(item => !item.read).length
      });
    } catch (err) {
      return sendJson(res, 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/notifications/read' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      const notification = await markAssistantNotificationRead({
        supabase:getSupabaseClient(),
        userId:user.id,
        notificationId:body.notification_id
      });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:'completed',
        notification
      });
    } catch (err) {
      const clientError = err.message === 'INVALID_NOTIFICATION_ID';
      const notFound = err.message === 'NOTIFICATION_NOT_FOUND';
      return sendJson(res, clientError ? 422 : notFound ? 404 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/confirmation/prepare' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      const confirmation = prepareConfirmation(body.action, { language:body.language });
      await appendAssistantAuditBestEffort({
        supabase:getSupabaseClient(),
        userId:user.id,
        action:body.action,
        eventType:'confirmation_prepared',
        outcome:confirmation.status,
        sessionId:body.session_id,
        boundary:body.boundary,
        metadata:{ confirmation_status:confirmation.status }
      });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:confirmation.required ? 'needs_confirmation' : 'ready',
        confirmation
      });
    } catch (err) {
      return sendJson(res, 422, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/confirmation/resolve' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      const confirmation = resolveConfirmation(body.action, body.confirmation, body.decision);
      await appendAssistantAuditBestEffort({
        supabase:getSupabaseClient(),
        userId:user.id,
        action:body.action,
        eventType:'confirmation_resolved',
        outcome:confirmation.status,
        sessionId:body.session_id,
        boundary:body.boundary,
        metadata:{ decision:body.decision, confirmation_status:confirmation.status }
      });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:confirmation.status === 'confirmed' ? 'completed' : 'denied',
        confirmation
      });
    } catch (err) {
      return sendJson(res, 409, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/idempotency/claim' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      const idempotency = await claimAssistantAction({
        supabase:getSupabaseClient(),
        userId:user.id,
        action:body.action,
        idempotencyKey:body.idempotency_key
      });
      const conflict = ['in_progress', 'uncertain', 'key_conflict'].includes(idempotency.state);
      await appendAssistantAuditBestEffort({
        supabase:getSupabaseClient(),
        userId:user.id,
        action:body.action,
        eventType:idempotency.state === 'replay_succeeded' ? 'replayed' : 'idempotency_claimed',
        outcome:idempotency.state,
        idempotencyKey:body.idempotency_key,
        sessionId:body.session_id,
        boundary:body.boundary
      });
      return sendJson(res, conflict ? 409 : 200, {
        protocol:PROTOCOL,
        status: conflict ? 'denied' : 'ready',
        idempotency
      });
    } catch (err) {
      const clientError = [
        'INVALID_IDEMPOTENCY_KEY',
        'IDEMPOTENCY_USER_REQUIRED',
        'IDEMPOTENCY_ACTION_NOT_SUPPORTED'
      ].includes(err.message);
      return sendJson(res, clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/idempotency/resolve' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      const idempotency = await resolveAssistantAction({
        supabase:getSupabaseClient(),
        userId:user.id,
        action:body.action,
        idempotencyKey:body.idempotency_key,
        status:body.status,
        result:body.result
      });
      const conflict = ['missing', 'key_conflict', 'uncertain'].includes(idempotency.state);
      const auditEvent = body.status === 'succeeded'
        ? 'write_succeeded'
        : 'write_uncertain';
      await appendAssistantAuditBestEffort({
        supabase:getSupabaseClient(),
        userId:user.id,
        action:body.action,
        eventType:auditEvent,
        outcome:idempotency.state,
        idempotencyKey:body.idempotency_key,
        resourceId:body.result?.record_id,
        sessionId:body.session_id,
        boundary:body.boundary,
        metadata:{ requested_status:body.status }
      });
      return sendJson(res, conflict ? 409 : 200, {
        protocol:PROTOCOL,
        status: conflict ? 'denied' : 'completed',
        idempotency
      });
    } catch (err) {
      const clientError = [
        'INVALID_IDEMPOTENCY_KEY',
        'IDEMPOTENCY_USER_REQUIRED',
        'INVALID_IDEMPOTENCY_STATUS'
      ].includes(err.message);
      return sendJson(res, clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/workflows/save' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      if (
        body.state &&
        typeof body.state === 'object' &&
        !Array.isArray(body.state) &&
        Object.prototype.hasOwnProperty.call(body.state, 'sensitive_state')
      ) {
        throw new Error('SENSITIVE_STATE_DIRECT_WRITE_FORBIDDEN');
      }

      const workflow = await saveWorkflowState({
        supabase:getSupabaseClient(),
        userId:user.id,
        workflowKey:body.workflow_key,
        boundary:body.boundary,
        state:body.state,
        status:body.status,
        expectedVersion:body.expected_version
      });
      return sendJson(res, 200, { protocol:PROTOCOL, status:'completed', workflow });
    } catch (err) {
      const conflict = ['WORKFLOW_VERSION_CONFLICT','WORKFLOW_BOUNDARY_CONFLICT'].includes(err.message);
      const clientError = [
        'INVALID_WORKFLOW_KEY','INVALID_WORKFLOW_STATUS','INVALID_WORKFLOW_VERSION',
        'WORKFLOW_BOUNDARY_REQUIRED','WORKFLOW_STATE_INVALID','SENSITIVE_STATE_DIRECT_WRITE_FORBIDDEN'
      ].includes(err.message);
      return sendJson(res, conflict ? 409 : clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/workflows/load' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      const workflow = await loadWorkflowState({
        supabase:getSupabaseClient(),
        userId:user.id,
        workflowKey:body.workflow_key
      });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:workflow ? 'completed' : 'not_found',
        workflow
      });
    } catch (err) {
      const clientError = err.message === 'INVALID_WORKFLOW_KEY';
      return sendJson(res, clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/workflows/transition' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      const result = await transitionSensitiveWorkflowState({
        supabase:getSupabaseClient(),
        userId:user.id,
        workflowKey:body.workflow_key,
        toState:body.to_state,
        expectedVersion:body.expected_version,
        boundary:body.boundary,
        reason:body.reason
      });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:'completed',
        ...result
      });
    } catch (err) {
      const conflict = [
        'WORKFLOW_VERSION_CONFLICT',
        'SENSITIVE_WORKFLOW_BOUNDARY_CONFLICT',
        'SENSITIVE_WORKFLOW_STATUS_BLOCKED'
      ].includes(err.message);
      const notFound = err.message === 'WORKFLOW_NOT_FOUND';
      const clientError = [
        'INVALID_SENSITIVE_WORKFLOW_STATE',
        'SENSITIVE_WORKFLOW_TRANSITION_NOT_ALLOWED',
        'SENSITIVE_WORKFLOW_VERSION_REQUIRED',
        'SENSITIVE_WORKFLOW_USER_REQUIRED',
        'INVALID_WORKFLOW_KEY'
      ].includes(err.message);
      return sendJson(res, conflict ? 409 : notFound ? 404 : clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/workflows/status' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      const workflow = await setWorkflowStatus({
        supabase:getSupabaseClient(),
        userId:user.id,
        workflowKey:body.workflow_key,
        status:body.status,
        expectedVersion:body.expected_version
      });
      return sendJson(res, 200, { protocol:PROTOCOL, status:'completed', workflow });
    } catch (err) {
      const conflict = err.message === 'WORKFLOW_VERSION_CONFLICT';
      const notFound = err.message === 'WORKFLOW_NOT_FOUND';
      const clientError = [
        'INVALID_WORKFLOW_KEY','INVALID_WORKFLOW_STATUS','INVALID_WORKFLOW_VERSION',
        'WORKFLOW_VERSION_REQUIRED'
      ].includes(err.message);
      return sendJson(res, conflict ? 409 : notFound ? 404 : clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/documents/find' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      const documents = await findOwnedDocuments({
        supabase:getSupabaseClient(),
        userId:user.id,
        projectId:body.project_id || null,
        limit:body.limit
      });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:'completed',
        documents
      });
    } catch (err) {
      const clientError = ['DOCUMENT_USER_REQUIRED'].includes(err.message);
      return sendJson(res, clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/documents/read' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      const document = await loadOwnedDocument({
        supabase:getSupabaseClient(),
        userId:user.id,
        documentId:body.document_id
      });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:document ? 'completed' : 'not_found',
        document
      });
    } catch (err) {
      const clientError = ['DOCUMENT_ID_REQUIRED','DOCUMENT_USER_REQUIRED'].includes(err.message);
      return sendJson(res, clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/documents/workflow-suggestions' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      const result = await suggestDocumentWorkflow({
        supabase:getSupabaseClient(),
        userId:user.id,
        documentId:body.document_id,
        caseId:body.case_id
      });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:result ? 'completed' : 'not_found',
        workflow:result
      });
    } catch (err) {
      const conflict = err.message === 'DOCUMENT_CASE_PROJECT_CONFLICT';
      const clientError = [
        'DOCUMENT_ID_REQUIRED','DOCUMENT_USER_REQUIRED',
        'FUNDING_CASE_ID_REQUIRED','WORKFLOW_USER_REQUIRED'
      ].includes(err.message);
      return sendJson(res, conflict ? 409 : clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/events/apply' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    const supabase = getSupabaseClient();
    const eventAuditAction = {
      id:body.event?.id || null,
      type:'assistant_event',
      target:body.workflow_key || null,
      risk:'low',
      requires_confirmation:false
    };

    await appendAssistantAuditBestEffort({
      supabase,
      userId:user.id,
      action:eventAuditAction,
      eventType:'event_received',
      outcome:body.event?.type || 'unknown',
      sessionId:body.session_id,
      boundary:body.event?.boundary,
      resourceId:body.event?.resource_id,
      metadata:{ workflow_key:body.workflow_key || null }
    });

    try {
      const result = await applyAssistantEvent({
        supabase,
        userId:user.id,
        workflowKey:body.workflow_key,
        event:body.event,
        expectedVersion:body.expected_version
      });

      const persistenceNotifications = result.replayed
        ? notificationsFromAssistantEvent({
            event:result.event,
            workflow:result.workflow,
            suggestions:[]
          })
        : result.notifications;

      const persistence = await persistAssistantNotifications({
        supabase,
        userId:user.id,
        notifications:persistenceNotifications
      });

      let agentInboxResult = { queued:false, skipped:true };
      try {
        const agentInboxItem = deriveAgentInboxItem({
          event:result.event,
          workflow:result.workflow,
          userId:user.id
        });
        const sourceOwned = await verifyAgentInboxItemOwnership({
          supabase,
          userId:user.id,
          event:result.event,
          item:agentInboxItem
        });
        agentInboxResult = sourceOwned
          ? await enqueueAgentInboxItem({ supabase, item:agentInboxItem })
          : { queued:false, skipped:true, reason:'source_not_owned_or_not_reviewable' };
      } catch (agentInboxError) {
        console.warn('[assistant-agent-inbox]', agentInboxError.message);
      }

      await appendAssistantAuditBestEffort({
        supabase,
        userId:user.id,
        action:eventAuditAction,
        eventType:result.replayed ? 'event_replayed' : 'event_applied',
        outcome:result.replayed ? 'replayed' : 'applied',
        sessionId:body.session_id,
        boundary:result.event?.boundary,
        resourceId:result.event?.resource_id,
        metadata:{
          event_type:result.event?.type || null,
          workflow_key:body.workflow_key || null,
          workflow_version:result.workflow?.version ?? null,
          notifications_persisted:persistence.persisted,
          agent_inbox_queued:Boolean(agentInboxResult.queued)
        }
      });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:'completed',
        ...result
      });
    } catch (err) {
      await appendAssistantAuditBestEffort({
        supabase,
        userId:user.id,
        action:eventAuditAction,
        eventType:'event_denied',
        outcome:err.message,
        sessionId:body.session_id,
        boundary:body.event?.boundary,
        resourceId:body.event?.resource_id,
        metadata:{
          event_type:body.event?.type || null,
          workflow_key:body.workflow_key || null
        }
      });
      const conflict = [
        'ASSISTANT_EVENT_BOUNDARY_CONFLICT',
        'WORKFLOW_VERSION_CONFLICT'
      ].includes(err.message);
      const notFound = err.message === 'WORKFLOW_NOT_FOUND';
      const clientError = [
        'INVALID_ASSISTANT_EVENT',
        'FORBIDDEN_EVENT_FIELD',
        'ASSISTANT_EVENT_ID_REQUIRED',
        'ASSISTANT_EVENT_NOT_ALLOWED',
        'ASSISTANT_EVENT_BOUNDARY_REQUIRED',
        'WORKFLOW_USER_REQUIRED',
        'INVALID_WORKFLOW_KEY',
        'INVALID_WORKFLOW_VERSION',
        'WORKFLOW_EVENT_STATUS_BLOCKED'
      ].includes(err.message);
      return sendJson(res, conflict ? 409 : notFound ? 404 : clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }


  if (path === '/assistant/approvals' && req.method === 'GET') {
    try {
      const requestUrl=new URL(req.url||'/api/v3/assistant/approvals','http://localhost');
      const approvals=await listUserHumanApprovals({
        supabase:getSupabaseClient(),
        userId:user.id,
        limit:requestUrl.searchParams.get('limit')||25
      });
      return sendJson(res,200,{
        protocol:PROTOCOL,
        status:'completed',
        human_approvals:approvals,
        policy:{execution_authorized:false,auto_execute:false}
      });
    } catch (err) {
      const clientError=err.message==='HUMAN_APPROVAL_USER_REQUIRED';
      return sendJson(res,clientError?422:503,{
        protocol:PROTOCOL,status:'denied',error:err.message
      });
    }
  }

  if (path === '/assistant/approvals' && req.method === 'POST') {
    let body;
    try { body=await parseBody(req); }
    catch (err) { return sendJson(res,400,{error:'Invalid JSON body',detail:err.message}); }
    const supabase=getSupabaseClient();
    const auditAction=body.action||{
      id:body.idempotency_key||null,
      type:'human_approval_request',
      target:body.workflow_key||null,
      risk:'high',
      requires_confirmation:true
    };
    try {
      const result=await requestHumanApproval({
        supabase,
        userId:user.id,
        workflowKey:body.workflow_key,
        boundary:body.boundary,
        expectedVersion:body.expected_version,
        action:body.action,
        idempotencyKey:body.idempotency_key
      });
      await appendAssistantAuditBestEffort({
        supabase,userId:user.id,action:auditAction,
        eventType:result.replayed?'replayed':'write_succeeded',
        outcome:result.replayed?'human_approval_replayed':'human_approval_requested',
        idempotencyKey:body.idempotency_key,
        boundary:body.boundary,
        resourceId:result.approval?.id||null,
        metadata:{workflow_key:body.workflow_key||null,human_approval:true,execution_authorized:false}
      });
      return sendJson(res,200,{protocol:PROTOCOL,status:'completed',...result});
    } catch (err) {
      await appendAssistantAuditBestEffort({
        supabase,userId:user.id,action:auditAction,
        eventType:'denied',outcome:err.message,
        idempotencyKey:body.idempotency_key,boundary:body.boundary,
        metadata:{workflow_key:body.workflow_key||null,human_approval:true}
      });
      const conflict=[
        'WORKFLOW_VERSION_CONFLICT',
        'HUMAN_APPROVAL_BOUNDARY_CONFLICT',
        'HUMAN_APPROVAL_WORKFLOW_STATUS_BLOCKED',
        'HUMAN_APPROVAL_IDEMPOTENCY_CONFLICT'
      ].includes(err.message);
      const notFound=err.message==='WORKFLOW_NOT_FOUND';
      const clientError=[
        'HUMAN_APPROVAL_USER_REQUIRED','HUMAN_APPROVAL_BOUNDARY_REQUIRED',
        'HUMAN_APPROVAL_VERSION_REQUIRED','HUMAN_APPROVAL_IDEMPOTENCY_KEY_INVALID',
        'HUMAN_APPROVAL_CONFIRMATION_REQUIRED','HUMAN_APPROVAL_RISK_NOT_ELIGIBLE',
        'INVALID_WORKFLOW_KEY','INVALID_ASSISTANT_ACTION'
      ].includes(err.message);
      return sendJson(res,conflict?409:notFound?404:clientError?422:503,{
        protocol:PROTOCOL,status:'denied',error:err.message
      });
    }
  }

  if (path === '/assistant/escalations' && req.method === 'GET') {
    try {
      const requestUrl = new URL(req.url || '/api/v3/assistant/escalations', 'http://localhost');
      const activeOnly = ['1','true','yes'].includes(
        String(requestUrl.searchParams.get('active') || '').toLowerCase()
      );
      const escalations = await listUserHumanEscalations({
        supabase:getSupabaseClient(),
        userId:user.id,
        activeOnly,
        limit:requestUrl.searchParams.get('limit') || 25
      });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:'completed',
        human_escalations:escalations,
        policy:{
          human_review_only:true,
          execution_authorized:false,
          auto_execute:false
        }
      });
    } catch (err) {
      const clientError = err.message === 'HUMAN_ESCALATION_USER_REQUIRED';
      return sendJson(res, clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/escalations' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    const supabase = getSupabaseClient();
    const auditAction = {
      id:body.idempotency_key || null,
      type:'human_escalation',
      target:body.workflow_key || null,
      risk:'medium',
      requires_confirmation:false
    };

    try {
      const result = await createHumanEscalation({
        supabase,
        userId:user.id,
        workflowKey:body.workflow_key,
        boundary:body.boundary,
        expectedVersion:body.expected_version,
        reasonCode:body.reason_code,
        summary:body.summary,
        idempotencyKey:body.idempotency_key
      });

      await appendAssistantAuditBestEffort({
        supabase,
        userId:user.id,
        action:auditAction,
        eventType:result.replayed ? 'replayed' : 'write_succeeded',
        outcome:result.replayed ? 'human_escalation_replayed' : 'human_escalation_queued',
        idempotencyKey:body.idempotency_key,
        boundary:body.boundary,
        resourceId:result.escalation?.id || null,
        metadata:{
          workflow_key:body.workflow_key || null,
          reason_code:body.reason_code || null,
          human_review_only:true,
          execution_triggered:false
        }
      });

      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:'completed',
        ...result
      });
    } catch (err) {
      await appendAssistantAuditBestEffort({
        supabase,
        userId:user.id,
        action:auditAction,
        eventType:'denied',
        outcome:err.message,
        idempotencyKey:body.idempotency_key,
        boundary:body.boundary,
        metadata:{
          workflow_key:body.workflow_key || null,
          reason_code:body.reason_code || null
        }
      });

      const conflict = [
        'WORKFLOW_VERSION_CONFLICT',
        'HUMAN_ESCALATION_BOUNDARY_CONFLICT',
        'HUMAN_ESCALATION_WORKFLOW_STATUS_BLOCKED'
      ].includes(err.message);
      const notFound = err.message === 'WORKFLOW_NOT_FOUND';
      const clientError = [
        'HUMAN_ESCALATION_USER_REQUIRED',
        'HUMAN_ESCALATION_BOUNDARY_REQUIRED',
        'HUMAN_ESCALATION_VERSION_REQUIRED',
        'HUMAN_ESCALATION_IDEMPOTENCY_KEY_INVALID',
        'HUMAN_ESCALATION_REASON_INVALID',
        'INVALID_WORKFLOW_KEY'
      ].includes(err.message);

      return sendJson(res, conflict ? 409 : notFound ? 404 : clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/inbox' && req.method === 'GET') {
    try {
      const agentInbox = await buildAgentInbox({
        supabase:getSupabaseClient(),
        userId:user.id
      });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:'completed',
        agent_inbox:agentInbox
      });
    } catch (err) {
      const clientError = err.message === 'AGENT_INBOX_USER_REQUIRED';
      return sendJson(res, clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/drafts' && req.method === 'GET') {
    try {
      const result = await listOwnedDrafts({
        supabase:getSupabaseClient(),
        userId:user.id
      });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:'completed',
        draft_center:result
      });
    } catch (err) {
      const clientError = err.message === 'DRAFT_CENTER_USER_REQUIRED';
      return sendJson(res, clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/plan' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    const result = planRegisteredAction({
      type:body.type,
      target:body.target,
      form:body.form,
      language:body.language
    });
    const plannedAction = Array.isArray(result.actions) ? result.actions[0] : {
      id:null,
      type:body.type || 'unknown',
      target:body.target || body.form || null,
      risk:null,
      requires_confirmation:false
    };
    await appendAssistantAuditBestEffort({
      supabase:getSupabaseClient(),
      userId:user.id,
      action:plannedAction,
      eventType:result.status === 'denied' ? 'denied' : 'planned',
      outcome:result.status,
      sessionId:body.session_id,
      boundary:body.boundary,
      metadata:{ code:result.context?.code || null }
    });
    return sendJson(res, result.status === 'denied' ? 422 : 200, result);
  }

  return sendJson(res, 404, { error:'Assistant route not found' });
}

module.exports = { assistantRouter };

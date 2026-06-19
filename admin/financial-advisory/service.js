/**
 * Financial Advisory Module — Client-side Supabase Service
 * Directly uses Supabase RLS for access control.
 */

(function (root) {
  'use strict';

  const TIMEOUT_MS = 15000;

  function getSb() {
    const sb = (typeof getSupabase === 'function') ? getSupabase() : window.supabaseClient;
    if (!sb) throw new Error('Supabase client not initialized');
    return sb;
  }

  function withTimeout(promise, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' timeout')), TIMEOUT_MS))
    ]);
  }

  async function getSessionUser() {
    const sb = getSb();
    // Use session bridge from parent dashboard if available (avoids iframe storage issues).
    if (window.__ADMIN_SESSION && typeof sb.auth.setSession === 'function') {
      try {
        await sb.auth.setSession(window.__ADMIN_SESSION);
        const { data: { session }, error } = await withTimeout(sb.auth.getSession(), 'getSession');
        if (!error && session) return session.user;
      } catch (e) {
        console.warn('[AdvisoryService] session bridge failed:', e.message);
      }
    }
    const { data: { session }, error } = await withTimeout(sb.auth.getSession(), 'getSession');
    if (error || !session) throw new Error('Session required');
    return session.user;
  }

  async function getUserRole() {
    const user = await getSessionUser();
    const sb = getSb();

    // Owner fallback first to avoid depending on admin_roles query.
    if (window.__ENV?.ADMIN_EMAIL && user.email === window.__ENV.ADMIN_EMAIL) {
      return { role: 'manager', user };
    }

    try {
      const { data: advRole } = await withTimeout(
        sb.from('advisory_roles').select('role').eq('user_id', user.id).maybeSingle(),
        'advisory_roles'
      );
      if (advRole?.role) return { role: advRole.role, user };
    } catch (e) {
      console.warn('[AdvisoryService] advisory_roles check failed:', e.message);
    }

    try {
      const { data: adminRole } = await withTimeout(
        sb.from('admin_roles').select('role').eq('user_id', user.id).maybeSingle(),
        'admin_roles'
      );
      if (adminRole?.role === 'super_admin' || adminRole?.role === 'admin') return { role: 'manager', user };
    } catch (e) {
      console.warn('[AdvisoryService] admin_roles check failed:', e.message);
    }

    return { role: null, user };
  }

  function requireRole(minRole) {
    const levels = { viewer: 1, advisor: 2, manager: 3 };
    return async function () {
      const { role } = await getUserRole();
      if (!role || levels[role] < levels[minRole]) throw new Error('Insufficient permissions');
      return role;
    };
  }

  async function logActivity(entityType, entityId, action, metadata) {
    const user = await getSessionUser();
    const sb = getSb();
    await sb.from('advisory_activity_logs').insert([{
      entity_type: entityType,
      entity_id: entityId,
      action,
      actor_id: user.id,
      actor_email: user.email,
      metadata: metadata || {}
    }]);
  }

  // ========== Dashboard ==========
  async function getDashboardStats() {
    const sb = getSb();
    const queries = [
      { key: 'clients', q: sb.from('advisory_clients').select('*', { count: 'exact', head: true }) },
      { key: 'projects', q: sb.from('advisory_projects').select('*', { count: 'exact', head: true }) },
      { key: 'studies', q: sb.from('advisory_feasibility_studies').select('*', { count: 'exact', head: true }) },
      { key: 'models', q: sb.from('advisory_financial_models').select('*', { count: 'exact', head: true }) },
      { key: 'activity', q: sb.from('advisory_activity_logs').select('*').order('created_at', { ascending: false }).limit(20) },
      { key: 'recentClients', q: sb.from('advisory_clients').select('id, name, company_name, status, created_at').order('created_at', { ascending: false }).limit(6) },
      { key: 'activeProjects', q: sb.from('advisory_projects').select('id, name, status, budget, client_id, advisory_clients(name)').in('status', ['lead','active','on_hold']).order('created_at', { ascending: false }).limit(6) }
    ];

    const results = await Promise.all(queries.map(item =>
      withTimeout(item.q, 'query:' + item.key)
        .then(res => ({ key: item.key, ok: true, res }))
        .catch(err => ({ key: item.key, ok: false, err }))
    ));

    const stats = {
      counts: { clients: 0, projects: 0, studies: 0, models: 0 },
      recentActivity: [],
      recentClients: [],
      activeProjects: [],
      errors: []
    };

    for (const r of results) {
      if (!r.ok) {
        stats.errors.push({ key: r.key, message: r.err?.message || String(r.err) });
        continue;
      }
      const { res } = r;
      if (res.error) {
        stats.errors.push({ key: r.key, message: res.error.message || String(res.error) });
      }
      if (r.key === 'clients') stats.counts.clients = res.count || 0;
      else if (r.key === 'projects') stats.counts.projects = res.count || 0;
      else if (r.key === 'studies') stats.counts.studies = res.count || 0;
      else if (r.key === 'models') stats.counts.models = res.count || 0;
      else if (r.key === 'activity') stats.recentActivity = res.data || [];
      else if (r.key === 'recentClients') stats.recentClients = res.data || [];
      else if (r.key === 'activeProjects') stats.activeProjects = res.data || [];
    }

    return stats;
  }

  // ========== Clients ==========
  async function listClients(filters) {
    const sb = getSb();
    let q = sb.from('advisory_clients').select('*');
    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.assigned_to) q = q.eq('assigned_to', filters.assigned_to);
    if (filters?.search) q = q.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%`);
    q = q.order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function getClient(id) {
    const sb = getSb();
    const { data, error } = await sb.from('advisory_clients').select('*, advisory_projects(*)').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async function createClient(payload) {
    await requireRole('advisor')();
    const user = await getSessionUser();
    const sb = getSb();
    const { data, error } = await sb.from('advisory_clients').insert([{ ...payload, created_by: user.id }]).select().single();
    if (error) throw error;
    await logActivity('client', data.id, 'client_created', { name: data.name });
    return data;
  }

  async function updateClient(id, payload) {
    await requireRole('advisor')();
    const user = await getSessionUser();
    const sb = getSb();
    const { data, error } = await sb.from('advisory_clients').update({ ...payload, updated_by: user.id }).eq('id', id).select().single();
    if (error) throw error;
    await logActivity('client', id, 'client_updated', { name: data.name });
    return data;
  }

  async function deleteClient(id) {
    await requireRole('manager')();
    const sb = getSb();
    const { error } = await sb.from('advisory_clients').delete().eq('id', id);
    if (error) throw error;
    await logActivity('client', id, 'client_deleted', {});
  }

  // ========== Projects ==========
  async function listProjects(filters) {
    const sb = getSb();
    let q = sb.from('advisory_projects').select('*, advisory_clients(id, name, company_name)');
    if (filters?.client_id) q = q.eq('client_id', filters.client_id);
    if (filters?.status) q = q.eq('status', filters.status);
    q = q.order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function getProject(id) {
    const sb = getSb();
    const { data, error } = await sb.from('advisory_projects')
      .select('*, advisory_clients(*), advisory_feasibility_studies(*), advisory_financial_models(*)')
      .eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async function createProject(payload) {
    await requireRole('advisor')();
    const user = await getSessionUser();
    const sb = getSb();
    const { data, error } = await sb.from('advisory_projects').insert([{ ...payload, created_by: user.id }]).select().single();
    if (error) throw error;
    await logActivity('project', data.id, 'project_created', { name: data.name, client_id: data.client_id });
    return data;
  }

  async function updateProject(id, payload) {
    await requireRole('advisor')();
    const user = await getSessionUser();
    const sb = getSb();
    const { data, error } = await sb.from('advisory_projects').update({ ...payload, updated_by: user.id }).eq('id', id).select().single();
    if (error) throw error;
    await logActivity('project', id, 'project_updated', { name: data.name });
    return data;
  }

  async function deleteProject(id) {
    await requireRole('manager')();
    const sb = getSb();
    const { error } = await sb.from('advisory_projects').delete().eq('id', id);
    if (error) throw error;
    await logActivity('project', id, 'project_deleted', {});
  }

  // ========== Feasibility Studies ==========
  async function listStudies(filters) {
    const sb = getSb();
    let q = sb.from('advisory_feasibility_studies').select('*, advisory_clients(id, name), advisory_projects(id, name)');
    if (filters?.client_id) q = q.eq('client_id', filters.client_id);
    if (filters?.project_id) q = q.eq('project_id', filters.project_id);
    if (filters?.status) q = q.eq('status', filters.status);
    q = q.order('updated_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function getStudy(id) {
    const sb = getSb();
    const { data, error } = await sb.from('advisory_feasibility_studies')
      .select('*, advisory_clients(*), advisory_projects(*)').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async function createStudy(payload) {
    await requireRole('advisor')();
    const user = await getSessionUser();
    const sb = getSb();
    const { data, error } = await sb.from('advisory_feasibility_studies').insert([{ ...payload, created_by: user.id }]).select().single();
    if (error) throw error;
    await logActivity('study', data.id, 'study_created', { title: data.title });
    return data;
  }

  async function updateStudy(id, payload) {
    await requireRole('advisor')();
    const user = await getSessionUser();
    const sb = getSb();
    const { data, error } = await sb.from('advisory_feasibility_studies').update({ ...payload, updated_by: user.id }).eq('id', id).select().single();
    if (error) throw error;
    await logActivity('study', id, 'study_updated', { title: data.title });
    return data;
  }

  async function deleteStudy(id) {
    await requireRole('manager')();
    const sb = getSb();
    const { error } = await sb.from('advisory_feasibility_studies').delete().eq('id', id);
    if (error) throw error;
    await logActivity('study', id, 'study_deleted', {});
  }

  // ========== Financial Models ==========
  async function listModels(filters) {
    const sb = getSb();
    let q = sb.from('advisory_financial_models').select('*, advisory_clients(id, name), advisory_projects(id, name)');
    if (filters?.client_id) q = q.eq('client_id', filters.client_id);
    if (filters?.project_id) q = q.eq('project_id', filters.project_id);
    if (filters?.status) q = q.eq('status', filters.status);
    q = q.order('updated_at', { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function getModel(id) {
    const sb = getSb();
    const { data, error } = await sb.from('advisory_financial_models')
      .select('*, advisory_clients(*), advisory_projects(*)').eq('id', id).single();
    if (error) throw error;
    return data;
  }

  async function createModel(payload) {
    await requireRole('advisor')();
    const user = await getSessionUser();
    const sb = getSb();
    const { data, error } = await sb.from('advisory_financial_models').insert([{ ...payload, created_by: user.id }]).select().single();
    if (error) throw error;
    await logActivity('model', data.id, 'model_created', { name: data.name });
    return data;
  }

  async function updateModel(id, payload) {
    await requireRole('advisor')();
    const user = await getSessionUser();
    const sb = getSb();
    const { data, error } = await sb.from('advisory_financial_models').update({ ...payload, updated_by: user.id }).eq('id', id).select().single();
    if (error) throw error;
    await logActivity('model', id, 'model_updated', { name: data.name });
    return data;
  }

  async function deleteModel(id) {
    await requireRole('manager')();
    const sb = getSb();
    const { error } = await sb.from('advisory_financial_models').delete().eq('id', id);
    if (error) throw error;
    await logActivity('model', id, 'model_deleted', {});
  }

  // ========== Documents ==========
  async function listDocuments(entityType, entityId) {
    const sb = getSb();
    const { data, error } = await sb.from('advisory_documents')
      .select('*, profiles(email)')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function uploadDocument(entityType, entityId, file) {
    await requireRole('advisor')();
    const user = await getSessionUser();
    const sb = getSb();
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${entityType}/${entityId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { data: uploadData, error: uploadError } = await sb.storage
      .from('advisory-documents')
      .upload(path, file, { contentType: file.type || 'application/octet-stream' });
    if (uploadError) throw uploadError;
    const { data, error } = await sb.from('advisory_documents').insert([{
      entity_type: entityType,
      entity_id: entityId,
      file_name: file.name,
      storage_path: uploadData.path,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      uploaded_by: user.id
    }]).select().single();
    if (error) throw error;
    await logActivity(entityType, entityId, 'document_uploaded', { document_id: data.id, file_name: file.name });
    return data;
  }

  async function deleteDocument(id) {
    await requireRole('advisor')();
    const sb = getSb();
    const { data: doc, error: docErr } = await sb.from('advisory_documents').select('*').eq('id', id).single();
    if (docErr) throw docErr;
    await sb.storage.from('advisory-documents').remove([doc.storage_path]);
    const { error } = await sb.from('advisory_documents').delete().eq('id', id);
    if (error) throw error;
    await logActivity(doc.entity_type, doc.entity_id, 'document_deleted', { document_id: id, file_name: doc.file_name });
  }

  async function getSignedUrl(storagePath) {
    const sb = getSb();
    const { data, error } = await sb.storage.from('advisory-documents').createSignedUrl(storagePath, 3600);
    if (error) throw error;
    return data.signedUrl;
  }

  // ========== Notes ==========
  async function listNotes(entityType, entityId) {
    const sb = getSb();
    const { data, error } = await sb.from('advisory_notes')
      .select('*, profiles(email)')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function createNote(entityType, entityId, content) {
    await requireRole('advisor')();
    const user = await getSessionUser();
    const sb = getSb();
    const { data, error } = await sb.from('advisory_notes').insert([{
      entity_type: entityType,
      entity_id: entityId,
      content,
      created_by: user.id
    }]).select().single();
    if (error) throw error;
    await logActivity(entityType, entityId, 'note_created', { note_id: data.id });
    return data;
  }

  async function updateNote(id, content) {
    await requireRole('advisor')();
    const user = await getSessionUser();
    const sb = getSb();
    const { data, error } = await sb.from('advisory_notes').update({ content, updated_by: user.id }).eq('id', id).select().single();
    if (error) throw error;
    await logActivity(data.entity_type, data.entity_id, 'note_updated', { note_id: id });
    return data;
  }

  async function deleteNote(id) {
    await requireRole('advisor')();
    const sb = getSb();
    const { data: note, error: noteErr } = await sb.from('advisory_notes').select('*').eq('id', id).single();
    if (noteErr) throw noteErr;
    const { error } = await sb.from('advisory_notes').delete().eq('id', id);
    if (error) throw error;
    await logActivity(note.entity_type, note.entity_id, 'note_deleted', { note_id: id });
  }

  // ========== Activity ==========
  async function listActivity(filters) {
    const sb = getSb();
    let q = sb.from('advisory_activity_logs').select('*');
    if (filters?.entity_type && filters?.entity_id) {
      q = q.eq('entity_type', filters.entity_type).eq('entity_id', filters.entity_id);
    }
    const { data, error } = await q.order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  }

  root.AdvisoryService = {
    getUserRole,
    requireRole,
    getDashboardStats,
    listClients, getClient, createClient, updateClient, deleteClient,
    listProjects, getProject, createProject, updateProject, deleteProject,
    listStudies, getStudy, createStudy, updateStudy, deleteStudy,
    listModels, getModel, createModel, updateModel, deleteModel,
    listDocuments, uploadDocument, deleteDocument, getSignedUrl,
    listNotes, createNote, updateNote, deleteNote,
    listActivity
  };
})(window);

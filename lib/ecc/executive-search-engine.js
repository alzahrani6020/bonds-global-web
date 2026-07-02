/**
 * BONDS Executive Command Center — Executive Search Engine (Phase E.1)
 *
 * Cross-project keyword search across projects, memoranda, AI reviews,
 * lifecycle timeline, tasks, and approvals. Ranks by relevance without
 * introducing new calculations.
 */

const { listUserProjects } = require('./portfolio-status-aggregator');

const ARABIC_STOP = new Set(['في','من','إلى','الى','على','الذي','التي','ما','هو','هي','أن','ان','كان','قد','لا','أو','او','مع','عن','هذا','هذه','كل','بعد','قبل','بين','تحت','فوق','لكن','ثم','تم','تمت','يجب','ال','لل','ل']);
const ENGLISH_STOP = new Set(['the','a','an','is','are','was','were','in','on','at','to','for','of','and','or','with','about','this','that','it','from','by','as','be','has','have','had','not','but','what','all','any','can','will','would','should']);

function normalizeText(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // remove Arabic diacritics
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTokens(query) {
  const normalized = normalizeText(query);
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 1 && !ARABIC_STOP.has(t) && !ENGLISH_STOP.has(t));
}

function containsPhrase(text, phrase) {
  return normalizeText(text).includes(normalizeText(phrase));
}

function scoreText(text, tokens, query) {
  const normalized = normalizeText(text);
  if (!normalized || !tokens.length) return 0;
  let score = 0;
  tokens.forEach(token => {
    const re = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = (normalized.match(re) || []).length;
    score += matches;
  });
  if (containsPhrase(normalized, query)) score += tokens.length * 3;
  return score;
}

function stringifyJsonb(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (e) {
    return '';
  }
}

async function fetchUserProjects(supabase, userId) {
  return listUserProjects(supabase, userId, { limit: 200 });
}

async function fetchInstances(supabase, projectIds) {
  if (!projectIds.length) return [];
  const { data, error } = await supabase
    .from('enterprise_lifecycle_instances')
    .select('id, entity_id, current_stage, status, workflow_code')
    .eq('entity_type', 'project')
    .in('entity_id', projectIds);
  if (error) {
    console.warn('[ECC Search] instances fetch failed:', error.message);
    return [];
  }
  return data || [];
}

async function queryTable(supabase, table, columns, filterField, filterValues) {
  if (!filterValues.length) return [];
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .in(filterField, filterValues);
  if (error) {
    console.warn(`[ECC Search] ${table} fetch failed:`, error.message);
    return [];
  }
  return data || [];
}

function buildProjectResults(projects, tokens, query) {
  return projects
    .map(p => {
      const text = [p.name, p.sector, p.sub_sector, p.activity, p.city, p.country_code, p.status].join(' ');
      const score = scoreText(text, tokens, query);
      if (score <= 0) return null;
      return {
        source: 'project',
        projectId: p.id,
        projectName: p.name,
        title: p.name,
        snippet: `${p.sector || ''} · ${p.activity || ''} · ${p.city || ''}`,
        score,
        url: `/v3/project?id=${encodeURIComponent(p.id)}`,
        data: { sector: p.sector, activity: p.activity, city: p.city, country: p.country_code, status: p.status },
        occurredAt: p.created_at
      };
    })
    .filter(Boolean);
}

function buildMemorandaResults(memoranda, projectMap, tokens, query) {
  return memoranda
    .map(m => {
      const text = [m.title, stringifyJsonb(m.content), m.status, m.type].join(' ');
      const score = scoreText(text, tokens, query);
      if (score <= 0) return null;
      return {
        source: 'memorandum',
        projectId: m.project_id,
        projectName: projectMap[m.project_id]?.name || 'Unknown',
        title: m.title,
        snippet: `${m.type} · ${m.status} · ثقة ${m.confidence_score || 0}`,
        score,
        url: `/v3/project?id=${encodeURIComponent(m.project_id)}`,
        data: { type: m.type, status: m.status, confidence: m.confidence_score },
        occurredAt: m.created_at
      };
    })
    .filter(Boolean);
}

function buildReviewResults(reviews, projectMap, tokens, query) {
  return reviews
    .map(r => {
      const text = [r.verdict, stringifyJsonb(r.issues), stringifyJsonb(r.suggestions)].join(' ');
      const score = scoreText(text, tokens, query);
      if (score <= 0) return null;
      return {
        source: 'ai_review',
        projectId: r.project_id,
        projectName: projectMap[r.project_id]?.name || 'Unknown',
        title: `مراجعة AI — ${r.verdict}`,
        snippet: `verdict: ${r.verdict} · confidence: ${r.confidence_score || 0}`,
        score,
        url: `/v3/project?id=${encodeURIComponent(r.project_id)}`,
        data: { verdict: r.verdict, confidence: r.confidence_score },
        occurredAt: r.reviewed_at
      };
    })
    .filter(Boolean);
}

function buildTimelineResults(timeline, instanceMap, projectMap, tokens, query) {
  return timeline
    .map(t => {
      const text = [t.title, t.description, t.entry_type].join(' ');
      const score = scoreText(text, tokens, query);
      if (score <= 0) return null;
      const projectId = instanceMap[t.instance_id]?.entity_id;
      return {
        source: 'timeline',
        projectId,
        projectName: projectId ? projectMap[projectId]?.name : 'Unknown',
        title: t.title,
        snippet: `${t.entry_type}${t.description ? ' · ' + t.description.slice(0, 120) : ''}`,
        score,
        url: projectId ? `/v3/project?id=${encodeURIComponent(projectId)}` : '',
        data: { entryType: t.entry_type },
        occurredAt: t.occurred_at
      };
    })
    .filter(Boolean);
}

function buildTaskResults(tasks, instanceMap, projectMap, tokens, query) {
  return tasks
    .map(t => {
      const text = [t.title, t.title_ar, t.title_en, t.status, t.priority].join(' ');
      const score = scoreText(text, tokens, query);
      if (score <= 0) return null;
      const projectId = instanceMap[t.instance_id]?.entity_id;
      return {
        source: 'task',
        projectId,
        projectName: projectId ? projectMap[projectId]?.name : 'Unknown',
        title: t.title_en || t.title_ar || t.title,
        snippet: `${t.status} · ${t.priority}`,
        score,
        url: projectId ? `/v3/project?id=${encodeURIComponent(projectId)}` : '',
        data: { status: t.status, priority: t.priority },
        occurredAt: t.created_at
      };
    })
    .filter(Boolean);
}

function buildApprovalResults(approvals, instanceMap, projectMap, tokens, query) {
  return approvals
    .map(a => {
      const text = [a.transition_id, a.stage_id, a.status, a.approval_type].join(' ');
      const score = scoreText(text, tokens, query);
      if (score <= 0) return null;
      const projectId = instanceMap[a.instance_id]?.entity_id;
      return {
        source: 'approval',
        projectId,
        projectName: projectId ? projectMap[projectId]?.name : 'Unknown',
        title: `موافقة ${a.status}`,
        title_en: `Approval ${a.status}`,
        snippet: `${a.transition_id || a.stage_id} · ${a.approval_type}`,
        score,
        url: projectId ? `/v3/project?id=${encodeURIComponent(projectId)}` : '',
        data: { status: a.status, approvalType: a.approval_type },
        occurredAt: a.created_at
      };
    })
    .filter(Boolean);
}

async function executiveSearch({ userId, supabase, query, options = {} }) {
  if (!supabase) throw new Error('Supabase client is required');
  if (!userId) throw new Error('userId is required');
  if (!query || !query.trim()) throw new Error('query is required');

  const tokens = extractTokens(query);
  if (!tokens.length) {
    return {
      query,
      tokens: [],
      results: [],
      grouped: {},
      meta: { generatedAt: new Date().toISOString(), totalResults: 0, sourcesSearched: 0 }
    };
  }

  const projects = await fetchUserProjects(supabase, userId);
  const projectIds = projects.map(p => p.id);
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]));

  const instances = await fetchInstances(supabase, projectIds);
  const instanceIds = instances.map(i => i.id);
  const instanceMap = Object.fromEntries(instances.map(i => [i.id, i]));

  const [
    memoranda,
    reviews,
    timeline,
    tasks,
    approvals
  ] = await Promise.all([
    queryTable(supabase, 'investment_memoranda', 'id, project_id, title, content, type, status, confidence_score, created_at', 'project_id', projectIds),
    queryTable(supabase, 'ai_investment_reviews', 'id, project_id, verdict, issues, suggestions, confidence_score, reviewed_at', 'project_id', projectIds),
    queryTable(supabase, 'enterprise_lifecycle_timeline', 'id, instance_id, entry_type, title, description, occurred_at', 'instance_id', instanceIds),
    queryTable(supabase, 'enterprise_lifecycle_tasks', 'id, instance_id, title, title_ar, title_en, status, priority, created_at', 'instance_id', instanceIds),
    queryTable(supabase, 'enterprise_lifecycle_approvals', 'id, instance_id, transition_id, stage_id, status, approval_type, created_at', 'instance_id', instanceIds)
  ]);

  const grouped = {
    projects: buildProjectResults(projects, tokens, query),
    memoranda: buildMemorandaResults(memoranda, projectMap, tokens, query),
    ai_reviews: buildReviewResults(reviews, projectMap, tokens, query),
    timeline: buildTimelineResults(timeline, instanceMap, projectMap, tokens, query),
    tasks: buildTaskResults(tasks, instanceMap, projectMap, tokens, query),
    approvals: buildApprovalResults(approvals, instanceMap, projectMap, tokens, query)
  };

  const allResults = Object.values(grouped).flat();
  allResults.sort((a, b) => b.score - a.score);

  const limit = options.limit || 50;
  const topResults = allResults.slice(0, limit);

  return {
    query,
    tokens,
    results: topResults,
    grouped,
    meta: {
      generatedAt: new Date().toISOString(),
      totalResults: allResults.length,
      sourcesSearched: 6,
      limit
    }
  };
}

module.exports = { executiveSearch };

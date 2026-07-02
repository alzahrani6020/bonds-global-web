/**
 * BONDS Executive Command Center — Portfolio Status Aggregator (Phase E.1)
 *
 * Aggregates single-project status across all projects owned by a user
 * into an executive portfolio overview. Reuses project-status-aggregator.
 */

const { aggregateProjectStatus } = require('./project-status-aggregator');
const { getUserRole } = require('./role-guard');

function normalizeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function listUserProjects(supabase, userId, { limit = 50, status } = {}) {
  if (!supabase || !userId) return [];
  let query = supabase
    .from('bonds_projects')
    .select('id, name, project_number, sector, sub_sector, activity, city, country_code, currency, status, capital, revenue, annual_profit, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) {
    console.warn('[ECC Portfolio] project list failed:', error.message);
    return [];
  }
  return data || [];
}

async function aggregatePortfolioStatus({ userId, supabase, options = {} }) {
  if (!supabase) throw new Error('Supabase client is required');
  if (!userId) throw new Error('userId is required');

  const [projectList, userRole] = await Promise.all([
    listUserProjects(supabase, userId, options),
    getUserRole(supabase, userId)
  ]);
  if (!projectList.length) {
    return {
      summary: {
        totalProjects: 0,
        healthy: 0,
        attention: 0,
        atRisk: 0,
        averageReadiness: 0,
        averageConfidence: 0,
        totalCapital: 0,
        totalRevenue: 0
      },
      projects: [],
      alerts: [],
      upcomingActions: [],
      sectors: {},
      stages: {},
      meta: {
        generatedAt: new Date().toISOString(),
        enginesUsed: ['investment-intelligence', 'enterprise-intelligence', 'enterprise-lifecycle', 'digital-twin', 'confidence'],
        aggregatedCount: 0,
        failedCount: 0,
        role: userRole
      }
    };
  }

  const projectStatuses = [];
  for (const project of projectList) {
    try {
      const status = await aggregateProjectStatus({
        projectId: project.id,
        supabase,
        userId,
        options: { skipAi: true }
      });
      projectStatuses.push({ projectId: project.id, project, status });
    } catch (err) {
      console.warn('[ECC Portfolio] aggregation failed for project', project.id, err.message);
      projectStatuses.push({
        projectId: project.id,
        project,
        status: null,
        error: err.message
      });
    }
  }

  const validStatuses = projectStatuses.filter(s => s.status);

  const summary = {
    totalProjects: projectList.length,
    healthy: validStatuses.filter(s => s.status.health.projectHealth === 'healthy').length,
    attention: validStatuses.filter(s => s.status.health.projectHealth === 'attention').length,
    atRisk: validStatuses.filter(s => s.status.health.projectHealth === 'at_risk').length,
    averageReadiness: validStatuses.length
      ? Math.round(validStatuses.reduce((sum, s) => sum + normalizeNumber(s.status.health.readinessScore), 0) / validStatuses.length)
      : 0,
    averageConfidence: validStatuses.length
      ? Math.round(validStatuses.reduce((sum, s) => sum + normalizeNumber(s.status.health.confidence), 0) / validStatuses.length)
      : 0,
    totalCapital: validStatuses.reduce((sum, s) => sum + normalizeNumber(s.status.financial.capital), 0),
    totalRevenue: validStatuses.reduce((sum, s) => sum + normalizeNumber(s.status.financial.revenue), 0)
  };

  const sectors = {};
  const stages = {};
  for (const s of validStatuses) {
    const sector = s.status.project.sector || 'Unknown';
    sectors[sector] = (sectors[sector] || 0) + 1;
    const stage = s.status.lifecycle?.currentStage || 'idea';
    stages[stage] = (stages[stage] || 0) + 1;
  }

  const alerts = validStatuses
    .flatMap(s => (s.status.mission.criticalAlerts || []).map(a => ({
      projectId: s.projectId,
      projectName: s.status.project.name,
      ...a
    })))
    .sort((a, b) => {
      const prio = { critical: 0, high: 1, medium: 2, low: 3 };
      return (prio[a.priority] || 4) - (prio[b.priority] || 4);
    })
    .slice(0, 20);

  const upcomingActions = validStatuses
    .filter(s => s.status.mission.nextBestAction)
    .map(s => ({
      projectId: s.projectId,
      projectName: s.status.project.name,
      stage: s.status.lifecycle?.currentStage || 'idea',
      ...s.status.mission.nextBestAction
    }))
    .sort((a, b) => {
      const prio = { critical: 0, high: 1, medium: 2, low: 3 };
      return (prio[a.priority] || 4) - (prio[b.priority] || 4);
    })
    .slice(0, 20);

  const projects = validStatuses.map(s => ({
    id: s.projectId,
    name: s.status.project.name,
    number: s.status.project.number,
    sector: s.status.project.sector,
    activity: s.status.project.activity,
    city: s.status.project.city,
    country: s.status.project.country,
    stage: s.status.lifecycle?.currentStage || 'idea',
    health: s.status.health.projectHealth,
    readinessScore: s.status.health.readinessScore,
    confidence: s.status.health.confidence,
    riskLevel: s.status.health.riskLevel,
    nextBestAction: s.status.mission.nextBestAction,
    alertCount: (s.status.mission.criticalAlerts || []).length,
    capital: s.status.financial.capital,
    revenue: s.status.financial.revenue
  }));

  return {
    summary,
    projects,
    alerts,
    upcomingActions,
    sectors,
    stages,
    meta: {
      generatedAt: new Date().toISOString(),
      enginesUsed: ['investment-intelligence', 'enterprise-intelligence', 'enterprise-lifecycle', 'digital-twin', 'confidence'],
      aggregatedCount: validStatuses.length,
      failedCount: projectStatuses.length - validStatuses.length,
      role: userRole
    }
  };
}

module.exports = { aggregatePortfolioStatus, listUserProjects };

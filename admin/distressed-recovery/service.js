/**
 * RecoveryService — Client-side CRUD for Distressed Assets Recovery module.
 * Connects directly to Supabase to avoid adding Vercel functions.
 */
(function (global) {
  'use strict';

  const SUPABASE_URL = window.__ENV?.SUPABASE_URL || window.SUPABASE_CONFIG?.url;
  const SUPABASE_ANON_KEY = window.__ENV?.SUPABASE_ANON_KEY || window.SUPABASE_CONFIG?.anonKey;

  let supabase = null;
  function getClient() {
    if (!supabase) {
      if (typeof window.createBondsSupabaseClient === 'function') {
        supabase = window.createBondsSupabaseClient();
      } else if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      }
    }
    return supabase;
  }

  function currentUser() {
    const client = getClient();
    return client?.auth?.getUser().then(({ data }) => data?.user || null);
  }

  async function ensureAuth() {
    const client = getClient();
    if (!client) throw new Error('Supabase غير مهيأ');
    const { data: { session } } = await client.auth.getSession();
    if (!session) throw new Error('يجب تسجيل الدخول');
    return session;
  }

  async function checkAccess() {
    await ensureAuth();
    const client = getClient();
    const { data: roles } = await client.from('recovery_roles').select('role');
    if (!roles || roles.length === 0) {
      // Fall back to advisory admin / site admin
      const [{ data: adv }, { data: admins }] = await Promise.all([
        client.from('advisory_roles').select('role').eq('role', 'admin').limit(1),
        client.from('admin_roles').select('role').in('role', ['super_admin','admin']).limit(1)
      ]);
      if ((adv && adv.length > 0) || (admins && admins.length > 0)) return { role: 'admin' };
      throw new Error('ليس لديك صلاحية الوصول');
    }
    return roles[0];
  }

  function uid() {
    return getClient().auth.getUser().then(({ data }) => data?.user?.id);
  }

  async function logAction(action, details, assetId, planId) {
    const client = getClient();
    const userId = await uid();
    await client.from('recovery_activity_logs').insert({
      action,
      details,
      asset_id: assetId || null,
      plan_id: planId || null,
      created_by: userId
    });
  }

  const ASSET_CATEGORIES = {
    real_estate: 'عقار',
    equipment: 'معدات',
    vehicle: 'مركبة',
    inventory: 'مخزون',
    receivable: 'ذمم مدينة',
    investment: 'استثمار',
    other: 'أخرى'
  };

  const ASSET_STATUSES = {
    identified: 'تم التحديد',
    valuation: 'التقييم',
    planning: 'التخطيط',
    active_rescue: 'إنقاذ نشط',
    restructuring: 'إعادة هيكلة',
    recovered: 'تم الإنقاذ',
    liquidated: 'تصفية',
    write_off: 'شطب'
  };

  const PRIORITIES = { low: 'منخفض', medium: 'متوسط', high: 'عالي', critical: 'حرج' };

  const STRATEGIES = {
    restructure: 'إعادة هيكلة',
    refinance: 'إعادة تمويل',
    sell: 'بيع',
    lease: 'إيجار',
    operational_turnaround: 'تحول تشغيلي',
    legal_action: 'إجراء قانوني',
    liquidation: 'تصفية',
    write_off: 'شطب'
  };

  const REASON_CATEGORIES = {
    market_decline: 'تراجع السوق',
    cash_flow: 'ضعف السيولة',
    operational: 'تشغيلي',
    legal: 'قانوني',
    fraud: 'احتيال',
    natural_disaster: 'كارثة طبيعية',
    macro: 'ماكرو اقتصادي',
    other: 'أخرى'
  };

  const service = {
    ASSET_CATEGORIES,
    ASSET_STATUSES,
    PRIORITIES,
    STRATEGIES,
    REASON_CATEGORIES,

    async init() {
      await checkAccess();
    },

    async getCurrentUser() {
      return currentUser();
    },

    // Assets
    async getAssets(opts = {}) {
      const client = getClient();
      let q = client.from('recovery_assets').select('*', { count: 'exact' });
      if (opts.status) q = q.eq('status', opts.status);
      if (opts.priority) q = q.eq('priority', opts.priority);
      if (opts.category) q = q.eq('category', opts.category);
      if (opts.country) q = q.eq('country_code', opts.country);
      if (opts.search) q = q.or(`name.ilike.%${opts.search}%,asset_code.ilike.%${opts.search}%,owner_name.ilike.%${opts.search}%`);
      q = q.order(opts.orderBy || 'updated_at', { ascending: opts.ascending === true });
      if (opts.limit) q = q.limit(opts.limit);
      const { data, error, count } = await q;
      if (error) throw error;
      return { data: data || [], count };
    },

    async getAsset(id) {
      const client = getClient();
      const { data, error } = await client.from('recovery_assets').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async saveAsset(asset) {
      await ensureAuth();
      const client = getClient();
      const userId = await uid();
      const payload = { ...asset };
      if (!payload.asset_code && !payload.id) {
        payload.asset_code = 'RA-' + Math.floor(10000 + Math.random() * 90000);
      }
      if (!payload.id) payload.assigned_manager = payload.assigned_manager || userId;
      if (payload.id) {
        const { data, error } = await client.from('recovery_assets').update(payload).eq('id', payload.id).select().single();
        if (error) throw error;
        await logAction('تحديث أصل', { asset_id: data.id, name: data.name }, data.id);
        return data;
      }
      const { data, error } = await client.from('recovery_assets').insert(payload).select().single();
      if (error) throw error;
      await logAction('إضافة أصل', { asset_id: data.id, name: data.name }, data.id);
      return data;
    },

    async deleteAsset(id) {
      await ensureAuth();
      const client = getClient();
      await logAction('حذف أصل', { asset_id: id }, id);
      const { error } = await client.from('recovery_assets').delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    // Valuations
    async getValuations(assetId) {
      const client = getClient();
      const { data, error } = await client.from('recovery_asset_valuations')
        .select('*').eq('asset_id', assetId).order('valuation_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async saveValuation(val) {
      await ensureAuth();
      const client = getClient();
      const userId = await uid();
      const payload = { ...val, created_by: userId };
      if (payload.id) {
        const { data, error } = await client.from('recovery_asset_valuations').update(payload).eq('id', payload.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await client.from('recovery_asset_valuations').insert(payload).select().single();
      if (error) throw error;
      await logAction('إضافة تقييم', { valuation_id: data.id }, payload.asset_id);
      return data;
    },

    async deleteValuation(id) {
      await ensureAuth();
      const client = getClient();
      const { error } = await client.from('recovery_asset_valuations').delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    // Distress reasons
    async getReasons(assetId) {
      const client = getClient();
      const { data, error } = await client.from('recovery_distress_reasons')
        .select('*').eq('asset_id', assetId).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async saveReason(reason) {
      await ensureAuth();
      const client = getClient();
      if (reason.id) {
        const { data, error } = await client.from('recovery_distress_reasons').update(reason).eq('id', reason.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await client.from('recovery_distress_reasons').insert(reason).select().single();
      if (error) throw error;
      await logAction('إضافة سبب تعثر', { reason_id: data.id }, reason.asset_id);
      return data;
    },

    async deleteReason(id) {
      await ensureAuth();
      const client = getClient();
      const { error } = await client.from('recovery_distress_reasons').delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    // Plans
    async getPlans(assetId) {
      const client = getClient();
      let q = client.from('recovery_plans').select('*, recovery_plan_stages(*)');
      if (assetId) q = q.eq('asset_id', assetId);
      const { data, error } = await q.order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async getPlan(id) {
      const client = getClient();
      const { data, error } = await client.from('recovery_plans')
        .select('*, recovery_plan_stages(*)').eq('id', id).single();
      if (error) throw error;
      return data;
    },

    async savePlan(plan, stages = []) {
      await ensureAuth();
      const client = getClient();
      const userId = await uid();
      const payload = { ...plan, created_by: userId };
      let result;
      if (payload.id) {
        const { data, error } = await client.from('recovery_plans').update(payload).eq('id', payload.id).select().single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await client.from('recovery_plans').insert(payload).select().single();
        if (error) throw error;
        result = data;
      }
      // Sync stages
      if (stages.length > 0) {
        const rows = stages.map((s, i) => ({
          ...s,
          plan_id: result.id,
          stage_order: s.stage_order ?? i
        }));
        const existingIds = rows.filter(r => r.id).map(r => r.id);
        // Delete removed stages
        const { data: existing } = await client.from('recovery_plan_stages').select('id').eq('plan_id', result.id);
        const toDelete = (existing || []).filter(e => !existingIds.includes(e.id)).map(e => e.id);
        if (toDelete.length) await client.from('recovery_plan_stages').delete().in('id', toDelete);
        // Upsert
        const { error: stageErr } = await client.from('recovery_plan_stages').upsert(rows, { onConflict: 'id' });
        if (stageErr) throw stageErr;
      }
      await logAction(payload.id ? 'تحديث خطة' : 'إضافة خطة', { plan_id: result.id }, result.asset_id, result.id);
      return this.getPlan(result.id);
    },

    async deletePlan(id) {
      await ensureAuth();
      const client = getClient();
      const plan = await this.getPlan(id);
      await logAction('حذف خطة', { plan_id: id }, plan?.asset_id, id);
      const { error } = await client.from('recovery_plans').delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    async updateStageStatus(stageId, status) {
      await ensureAuth();
      const client = getClient();
      const completedAt = status === 'completed' ? new Date().toISOString() : null;
      const { data, error } = await client.from('recovery_plan_stages')
        .update({ status, completed_at: completedAt }).eq('id', stageId).select().single();
      if (error) throw error;
      return data;
    },

    // Costs
    async getCosts(assetId) {
      const client = getClient();
      const { data, error } = await client.from('recovery_costs')
        .select('*').eq('asset_id', assetId).order('incurred_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async saveCost(cost) {
      await ensureAuth();
      const client = getClient();
      const userId = await uid();
      const payload = { ...cost, created_by: userId };
      if (payload.id) {
        const { data, error } = await client.from('recovery_costs').update(payload).eq('id', payload.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await client.from('recovery_costs').insert(payload).select().single();
      if (error) throw error;
      await logAction('إضافة تكلفة', { cost_id: data.id, amount: cost.amount }, cost.asset_id, cost.plan_id);
      return data;
    },

    async deleteCost(id) {
      await ensureAuth();
      const client = getClient();
      const { error } = await client.from('recovery_costs').delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    // Investors
    async getInvestors() {
      const client = getClient();
      const { data, error } = await client.from('recovery_investors').select('*').order('name');
      if (error) throw error;
      return data || [];
    },

    async saveInvestor(inv) {
      await ensureAuth();
      const client = getClient();
      if (inv.id) {
        const { data, error } = await client.from('recovery_investors').update(inv).eq('id', inv.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await client.from('recovery_investors').insert(inv).select().single();
      if (error) throw error;
      return data;
    },

    async deleteInvestor(id) {
      await ensureAuth();
      const client = getClient();
      const { error } = await client.from('recovery_investors').delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    // Offers
    async getOffers(assetId) {
      const client = getClient();
      let q = client.from('recovery_investor_offers').select('*, recovery_investors(*)');
      if (assetId) q = q.eq('asset_id', assetId);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async saveOffer(offer) {
      await ensureAuth();
      const client = getClient();
      if (offer.id) {
        const { data, error } = await client.from('recovery_investor_offers').update(offer).eq('id', offer.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await client.from('recovery_investor_offers').insert(offer).select().single();
      if (error) throw error;
      await logAction('إضافة عرض مستثمر', { offer_id: data.id }, offer.asset_id, offer.plan_id);
      return data;
    },

    async deleteOffer(id) {
      await ensureAuth();
      const client = getClient();
      const { error } = await client.from('recovery_investor_offers').delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    // Documents
    async getDocuments(assetId) {
      const client = getClient();
      const { data, error } = await client.from('recovery_documents')
        .select('*').eq('asset_id', assetId).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async uploadDocument(file, meta = {}) {
      await ensureAuth();
      const client = getClient();
      const userId = await uid();
      const ext = file.name.split('.').pop();
      const path = `${meta.asset_id || 'general'}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upError } = await client.storage.from('recovery-documents').upload(path, file);
      if (upError) throw upError;
      const { data: urlData } = client.storage.from('recovery-documents').getPublicUrl(path);
      const doc = {
        asset_id: meta.asset_id || null,
        plan_id: meta.plan_id || null,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: path,
        public_url: urlData?.publicUrl || null,
        uploaded_by: userId
      };
      const { data, error } = await client.from('recovery_documents').insert(doc).select().single();
      if (error) throw error;
      await logAction('رفع مستند', { document_id: data.id, file_name: file.name }, doc.asset_id, doc.plan_id);
      return data;
    },

    async deleteDocument(id) {
      await ensureAuth();
      const client = getClient();
      const { data: doc } = await client.from('recovery_documents').select('storage_path').eq('id', id).single();
      if (doc?.storage_path) await client.storage.from('recovery-documents').remove([doc.storage_path]);
      const { error } = await client.from('recovery_documents').delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    // Notes
    async getNotes(assetId) {
      const client = getClient();
      const { data, error } = await client.from('recovery_notes')
        .select('*').eq('asset_id', assetId).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async saveNote(note) {
      await ensureAuth();
      const client = getClient();
      const userId = await uid();
      const payload = { ...note, created_by: userId };
      if (payload.id) {
        const { data, error } = await client.from('recovery_notes').update(payload).eq('id', payload.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await client.from('recovery_notes').insert(payload).select().single();
      if (error) throw error;
      return data;
    },

    async deleteNote(id) {
      await ensureAuth();
      const client = getClient();
      const { error } = await client.from('recovery_notes').delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    // Activity
    async getActivity(limit = 50) {
      const client = getClient();
      const { data, error } = await client.from('recovery_activity_logs')
        .select('*, recovery_assets(name)').order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return data || [];
    },

    // Dashboard stats
    async getDashboardStats() {
      const client = getClient();
      const [assets, plans, investors, costs, recentAssets] = await Promise.all([
        client.from('recovery_assets').select('id', { count: 'exact', head: true }),
        client.from('recovery_plans').select('id', { count: 'exact', head: true }),
        client.from('recovery_investors').select('id', { count: 'exact', head: true }),
        client.from('recovery_costs').select('amount'),
        client.from('recovery_assets').select('id, name, status, distressed_value').order('updated_at', { ascending: false }).limit(5)
      ]);
      if (assets.error) throw assets.error;
      const totalCosts = (costs.data || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
      return {
        counts: {
          assets: assets.count || 0,
          plans: plans.count || 0,
          investors: investors.count || 0,
          totalCosts
        },
        recentAssets: recentAssets.data || []
      };
    },

    // Reports
    async getStatusReport() {
      const client = getClient();
      const { data: assets, error } = await client.from('recovery_assets').select('*');
      if (error) throw error;
      const byStatus = {};
      const byCategory = {};
      let totalOriginal = 0, totalDistressed = 0;
      for (const a of assets || []) {
        byStatus[a.status] = (byStatus[a.status] || 0) + 1;
        byCategory[a.category] = (byCategory[a.category] || 0) + 1;
        totalOriginal += Number(a.original_value) || 0;
        totalDistressed += Number(a.distressed_value) || 0;
      }
      return { totalAssets: assets?.length || 0, byStatus, byCategory, totalOriginal, totalDistressed };
    },

    async getFinancialReport() {
      const client = getClient();
      const { data: costs, error } = await client.from('recovery_costs').select('cost_type, amount');
      if (error) throw error;
      const { data: offers } = await client.from('recovery_investor_offers').select('offer_value, status');
      const byType = {};
      let totalCosts = 0;
      for (const c of costs || []) {
        byType[c.cost_type] = (byType[c.cost_type] || 0) + (Number(c.amount) || 0);
        totalCosts += Number(c.amount) || 0;
      }
      const totalOffers = (offers || []).reduce((s, o) => s + (Number(o.offer_value) || 0), 0);
      const acceptedOffers = (offers || []).filter(o => o.status === 'accepted').reduce((s, o) => s + (Number(o.offer_value) || 0), 0);
      return { totalCosts, byType, totalOffers, acceptedOffers };
    }
  };

  global.RecoveryService = service;
})(window);

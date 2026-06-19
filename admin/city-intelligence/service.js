/**
 * CityIntelligenceService — Client-side CRUD for City Intelligence module.
 */
(function (global) {
  'use strict';

  const SUPABASE_URL = window.__ENV?.SUPABASE_URL || window.SUPABASE_CONFIG?.url;
  const SUPABASE_ANON_KEY = window.__ENV?.SUPABASE_ANON_KEY || window.SUPABASE_CONFIG?.anonKey;

  let supabase = null;
  function getClient() {
    if (!supabase) {
      if (window.BondsAuth && typeof window.BondsAuth.getSupabase === 'function') {
        supabase = window.BondsAuth.getSupabase();
      } else if (typeof window.createBondsSupabaseClient === 'function') {
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
    const { data: roles } = await client.from('city_roles').select('role');
    if (!roles || roles.length === 0) {
      const [{ data: cityAdmins }, { data: adv }, { data: admins }] = await Promise.all([
        client.from('city_roles').select('role').in('role', ['admin','analyst']).limit(1),
        client.from('advisory_roles').select('role').eq('role', 'admin').limit(1),
        client.from('admin_roles').select('role').in('role', ['super_admin','admin']).limit(1)
      ]);
      if ((cityAdmins && cityAdmins.length > 0) || (adv && adv.length > 0) || (admins && admins.length > 0)) {
        return { role: 'admin' };
      }
      throw new Error('ليس لديك صلاحية الوصول');
    }
    return roles[0];
  }

  async function uid() {
    return getClient().auth.getUser().then(({ data }) => data?.user?.id);
  }

  async function logAction(action, details, cityId, districtId) {
    const client = getClient();
    const userId = await uid();
    await client.from('city_activity_logs').insert({
      action,
      details,
      city_id: cityId || null,
      district_id: districtId || null,
      created_by: userId
    });
  }

  const INDICATOR_KEYS = {
    population: 'السكان',
    income: 'الدخل',
    urban_growth: 'النمو العمراني',
    government_projects: 'المشاريع الحكومية',
    competition: 'المنافسة',
    land_price: 'أسعار الأراضي',
    rent: 'الإيجارات',
    commercial_density: 'الكثافة التجارية'
  };

  const service = {
    INDICATOR_KEYS,

    async init() { await checkAccess(); },
    async getCurrentUser() { return currentUser(); },

    // Cities
    async getCities() {
      const client = getClient();
      let { data, error } = await client.from('cities').select('*').eq('status', 'active').order('name');
      // Fallback if the status column is missing in an older schema
      if (error && error.message && error.message.toLowerCase().includes('status')) {
        const res = await client.from('cities').select('*').order('name');
        data = res.data;
        error = res.error;
      }
      if (error) throw error;
      return data || [];
    },
    async getCity(id) {
      const client = getClient();
      const { data, error } = await client.from('cities').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    async saveCity(city) {
      await ensureAuth();
      const client = getClient();
      if (city.id) {
        const { data, error } = await client.from('cities').update(city).eq('id', city.id).select().single();
        if (error) throw error;
        await logAction('تحديث مدينة', { city_id: data.id }, data.id);
        return data;
      }
      const { data, error } = await client.from('cities').insert(city).select().single();
      if (error) throw error;
      await logAction('إضافة مدينة', { city_id: data.id }, data.id);
      return data;
    },
    async deleteCity(id) {
      await ensureAuth();
      const client = getClient();
      await logAction('حذف مدينة', { city_id: id }, id);
      const { error } = await client.from('cities').delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    // Districts
    async getDistricts(cityId) {
      const client = getClient();
      let q = client.from('districts').select('*').eq('status', 'active');
      if (cityId) q = q.eq('city_id', cityId);
      let { data, error } = await q.order('investment_score', { ascending: false });
      // Fallback if the status column is missing in an older schema
      if (error && error.message && error.message.toLowerCase().includes('status')) {
        q = client.from('districts').select('*');
        if (cityId) q = q.eq('city_id', cityId);
        const res = await q.order('investment_score', { ascending: false });
        data = res.data;
        error = res.error;
      }
      if (error) throw error;
      return data || [];
    },
    async getDistrict(id) {
      const client = getClient();
      const { data, error } = await client.from('districts').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    async saveDistrict(district) {
      await ensureAuth();
      const client = getClient();
      if (district.id) {
        const { data, error } = await client.from('districts').update(district).eq('id', district.id).select().single();
        if (error) throw error;
        await logAction('تحديث حي', { district_id: data.id }, data.city_id, data.id);
        return data;
      }
      const { data, error } = await client.from('districts').insert(district).select().single();
      if (error) throw error;
      await logAction('إضافة حي', { district_id: data.id }, data.city_id, data.id);
      return data;
    },
    async deleteDistrict(id) {
      await ensureAuth();
      const client = getClient();
      const d = await this.getDistrict(id);
      await logAction('حذف حي', { district_id: id }, d?.city_id, id);
      const { error } = await client.from('districts').delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    // Indicator values
    async getIndicatorValues(filters = {}) {
      const client = getClient();
      let q = client.from('city_indicator_values').select('*');
      if (filters.cityId) q = q.eq('city_id', filters.cityId);
      if (filters.districtId) q = q.eq('district_id', filters.districtId);
      if (filters.key) q = q.eq('indicator_key', filters.key);
      const { data, error } = await q.order('year', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async saveIndicatorValue(val) {
      await ensureAuth();
      const client = getClient();
      const userId = await uid();
      const payload = { ...val, created_by: userId };
      if (payload.id) {
        const { data, error } = await client.from('city_indicator_values').update(payload).eq('id', payload.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await client.from('city_indicator_values').insert(payload).select().single();
      if (error) throw error;
      await logAction('إضافة مؤشر', { indicator: val.indicator_key }, val.city_id, val.district_id);
      return data;
    },
    async deleteIndicatorValue(id) {
      await ensureAuth();
      const client = getClient();
      const { error } = await client.from('city_indicator_values').delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    // Projects
    async getProjects(cityId) {
      const client = getClient();
      let q = client.from('city_projects').select('*');
      if (cityId) q = q.eq('city_id', cityId);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async saveProject(project) {
      await ensureAuth();
      const client = getClient();
      const userId = await uid();
      const payload = { ...project, created_by: userId };
      if (payload.id) {
        const { data, error } = await client.from('city_projects').update(payload).eq('id', payload.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await client.from('city_projects').insert(payload).select().single();
      if (error) throw error;
      await logAction('إضافة مشروع', { project_id: data.id }, data.city_id, data.district_id);
      return data;
    },
    async deleteProject(id) {
      await ensureAuth();
      const client = getClient();
      const { error } = await client.from('city_projects').delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    // Competitors
    async getCompetitors(cityId) {
      const client = getClient();
      let q = client.from('city_competitors').select('*');
      if (cityId) q = q.eq('city_id', cityId);
      const { data, error } = await q.order('name');
      if (error) throw error;
      return data || [];
    },
    async saveCompetitor(comp) {
      await ensureAuth();
      const client = getClient();
      const userId = await uid();
      const payload = { ...comp, created_by: userId };
      if (payload.id) {
        const { data, error } = await client.from('city_competitors').update(payload).eq('id', payload.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await client.from('city_competitors').insert(payload).select().single();
      if (error) throw error;
      await logAction('إضافة منافس', { competitor_id: data.id }, data.city_id, data.district_id);
      return data;
    },
    async deleteCompetitor(id) {
      await ensureAuth();
      const client = getClient();
      const { error } = await client.from('city_competitors').delete().eq('id', id);
      if (error) throw error;
      return true;
    },

    // Reports
    async getReports(cityId) {
      const client = getClient();
      let q = client.from('city_reports').select('*');
      if (cityId) q = q.eq('city_id', cityId);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async saveReport(report) {
      await ensureAuth();
      const client = getClient();
      const userId = await uid();
      const payload = { ...report, created_by: userId };
      if (payload.id) {
        const { data, error } = await client.from('city_reports').update(payload).eq('id', payload.id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await client.from('city_reports').insert(payload).select().single();
      if (error) throw error;
      await logAction('إضافة تقرير', { report_id: data.id }, data.city_id);
      return data;
    },
    async deleteReport(id) {
      await ensureAuth();
      const client = getClient();
      const { error } = await client.from('city_reports').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    async uploadReportPdf(file, cityId) {
      await ensureAuth();
      const client = getClient();
      const userId = await uid();
      const ext = file.name.split('.').pop();
      const path = `${cityId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upError } = await client.storage.from('city-intelligence-reports').upload(path, file);
      if (upError) throw upError;
      const { data: urlData } = client.storage.from('city-intelligence-reports').getPublicUrl(path);
      return { path, publicUrl: urlData?.publicUrl };
    },

    // Activity
    async getActivity(limit = 50) {
      const client = getClient();
      const { data, error } = await client.from('city_activity_logs')
        .select('*, cities(name), districts(name)')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },

    // Role management
    async searchUsers(query = '') {
      const client = getClient();
      const { data, error } = await client.rpc('city_search_users', { search_query: query });
      if (error) throw error;
      return data || [];
    },
    async getCityRoles() {
      const client = getClient();
      const { data, error } = await client.rpc('city_list_city_roles');
      if (error) throw error;
      return data || [];
    },
    async assignCityRole(userId, role) {
      await ensureAuth();
      const client = getClient();
      const { data, error } = await client.from('city_roles')
        .upsert({ user_id: userId, role }, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      await logAction('تعيين دور City Intelligence', { target_user: userId, role });
      return data;
    },
    async removeCityRole(userId) {
      await ensureAuth();
      const client = getClient();
      const { error } = await client.from('city_roles').delete().eq('user_id', userId);
      if (error) throw error;
      await logAction('إزالة دور City Intelligence', { target_user: userId });
      return true;
    }
  };

  global.CityIntelligenceService = service;
})(window);

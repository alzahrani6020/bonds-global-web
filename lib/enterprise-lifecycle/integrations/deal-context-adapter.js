/**
 * Deal Context Integration Adapter
 *
 * Feeds the open bonds_deals workspace linked to a project into lifecycle guards
 * (guard_deal_room_active, guard_nda_signed, guard_vdr_access, guard_due_diligence_complete).
 */

const { buildDealLifecycleContext } = require('../../deals/deal-access');

const OPEN_DEAL_STATUSES = ['active', 'on_hold'];

class DealContextAdapter {
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  async enrich({ instance, context }) {
    if (!this.supabase || !instance || instance.entity_type !== 'project') return context;

    try {
      const { data: deals, error } = await this.supabase
        .from('bonds_deals')
        .select('id,deal_number,title,stage,status')
        .eq('project_id', instance.entity_id)
        .in('status', OPEN_DEAL_STATUSES)
        .order('updated_at', { ascending: false })
        .limit(1);
      const deal = !error && Array.isArray(deals) ? deals[0] : null;
      if (!deal) return context;

      const [members, dueDiligence, documents, readyVersions] = await Promise.all([
        this.supabase.from('bonds_deal_members').select('side,status,user_id,nda_status,access_expires_at').eq('deal_id', deal.id),
        this.supabase.from('bonds_deal_due_diligence_items').select('status,risk_rating').eq('deal_id', deal.id),
        this.supabase.from('bonds_deal_documents').select('id,name,category,status').eq('deal_id', deal.id),
        this.supabase.from('bonds_deal_document_versions').select('document_id').eq('deal_id', deal.id).eq('upload_status', 'ready')
      ]);

      const readyDocumentIds = new Set(
        readyVersions.error ? [] : (readyVersions.data || []).map(row => row.document_id)
      );
      const evidencedDocuments = documents.error
        ? []
        : (documents.data || []).filter(document => readyDocumentIds.has(document.id));

      const fragment = buildDealLifecycleContext({
        deal,
        members: members.error ? [] : members.data || [],
        dueDiligence: dueDiligence.error ? [] : dueDiligence.data || [],
        documents: evidencedDocuments
      });

      const next = {
        ...context,
        deal: fragment.deal,
        documents: { ...(context.documents || {}), ...fragment.documents }
      };
      if (fragment.vdr) next.vdr = { ...(context.vdr || {}), ...fragment.vdr };
      if (fragment.dueDiligence) next.dueDiligence = { ...(context.dueDiligence || {}), ...fragment.dueDiligence };
      return next;
    } catch (err) {
      console.warn('[DealContextAdapter] enrich failed:', err.message);
      return context;
    }
  }
}

module.exports = { DealContextAdapter, OPEN_DEAL_STATUSES };

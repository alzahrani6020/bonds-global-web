'use strict';

const { detectGapOrDefect }=require('./gap-defect-detector');
const { aggregateEvidence }=require('./evidence-aggregator');
const { classifyProposalRisk }=require('./proposal-risk-classifier');

function analyzeProposal({proposal,learningEvents=[]}){
  if(!proposal||typeof proposal!=='object')throw new Error('LEARNING_PROPOSAL_REQUIRED');
  const diagnosis=detectGapOrDefect(proposal.event_type);
  const evidence=aggregateEvidence({proposal,events:learningEvents});
  const risk=classifyProposalRisk({
    eventType:proposal.event_type,
    diagnosis
  });

  return {
    version:1,
    proposal_id:proposal.id||null,
    fingerprint:proposal.fingerprint||null,
    event_type:proposal.event_type,
    status:proposal.status,
    diagnosis,
    evidence,
    risk,
    policy:{
      analysis_only:true,
      execution_authorized:false,
      auto_execute:false,
      code_mutation:false,
      status_change:false
    }
  };
}

async function analyzeProposedEvolution({supabase,limit=50}){
  if(!supabase||typeof supabase.from!=='function')throw new Error('LEARNING_PROPOSAL_STORE_UNAVAILABLE');
  const bounded=Math.max(1,Math.min(200,Number(limit)||50));

  const proposalsResult=await supabase
    .from('evolution_proposals')
    .select('*')
    .eq('status','proposed')
    .order('updated_at',{ascending:false})
    .limit(bounded);
  if(proposalsResult.error)throw new Error('LEARNING_PROPOSAL_READ_FAILED');

  const proposals=proposalsResult.data||[];
  const analyses=[];

  for(const proposal of proposals){
    const eventsResult=await supabase
      .from('bonds_learning_events')
      .select('event_type,action,metadata,created_at')
      .eq('event_type',proposal.event_type)
      .order('created_at',{ascending:false})
      .limit(200);
    if(eventsResult.error)throw new Error('LEARNING_EVIDENCE_READ_FAILED');

    const analysis=analyzeProposal({
      proposal,
      learningEvents:eventsResult.data||[]
    });
    analyses.push(analysis);

    const nextMetadata={
      ...(proposal.metadata||{}),
      learning_analysis:analysis,
      learning_analysis_version:1
    };
    const updateResult=await supabase
      .from('evolution_proposals')
      .update({metadata:nextMetadata})
      .eq('id',proposal.id)
      .eq('execution_authorized',false);
    if(updateResult.error)throw new Error('LEARNING_PROPOSAL_ANALYSIS_PERSIST_FAILED');
  }

  return {
    version:1,
    analyzed:analyses.length,
    proposals:analyses,
    policy:{
      analysis_only:true,
      execution_authorized:false,
      auto_execute:false
    }
  };
}

module.exports={ analyzeProposal, analyzeProposedEvolution };

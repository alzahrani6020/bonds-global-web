(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BondsAssistantControlCenter=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const FEATURES=Object.freeze({
    global:'assistant',
    readOnly:'assistant.read_only'
  });
  const MODES=Object.freeze({
    normal:'normal',
    readOnly:'read_only_emergency',
    fullStop:'full_stop'
  });

  function switchActive(row,nowMs=Date.now()){
    if(!row||row.disabled!==true)return false;
    if(!row.expires_at)return true;
    const expiresAt=new Date(row.expires_at).getTime();
    if(!Number.isFinite(expiresAt))return true;
    return expiresAt>nowMs;
  }

  function rowFor(rows,feature){
    return (Array.isArray(rows)?rows:[]).find(row=>row&&row.feature===feature)||null;
  }

  function deriveMode(rows,nowMs=Date.now()){
    const globalRow=rowFor(rows,FEATURES.global);
    const readOnlyRow=rowFor(rows,FEATURES.readOnly);
    if(switchActive(globalRow,nowMs)){
      return {
        mode:MODES.fullStop,
        feature:FEATURES.global,
        expires_at:globalRow.expires_at||null,
        reason:globalRow.reason||null
      };
    }
    if(switchActive(readOnlyRow,nowMs)){
      return {
        mode:MODES.readOnly,
        feature:FEATURES.readOnly,
        expires_at:readOnlyRow.expires_at||null,
        reason:readOnlyRow.reason||null
      };
    }
    return {mode:MODES.normal,feature:null,expires_at:null,reason:null};
  }

  function cleanReason(value){
    return String(value||'').trim().slice(0,500);
  }

  function normalizeExpiry(value){
    if(!value)return null;
    const date=new Date(value);
    if(!Number.isFinite(date.getTime()))throw new Error('INVALID_EXPIRY');
    if(date.getTime()<=Date.now())throw new Error('EXPIRY_MUST_BE_FUTURE');
    return date.toISOString();
  }

  function buildTransition(mode,{reason='',expiresAt=null}={}){
    const normalizedMode=String(mode||'').trim();
    const safeReason=cleanReason(reason);
    const expiry=normalizeExpiry(expiresAt);

    if(normalizedMode===MODES.fullStop){
      if(safeReason.length<8)throw new Error('REASON_REQUIRED');
      return [{
        feature:FEATURES.global,
        disabled:true,
        reason:safeReason,
        expires_at:expiry
      }];
    }

    if(normalizedMode===MODES.readOnly){
      if(safeReason.length<8)throw new Error('REASON_REQUIRED');
      return [
        {
          feature:FEATURES.readOnly,
          disabled:true,
          reason:safeReason,
          expires_at:expiry
        },
        {
          feature:FEATURES.global,
          disabled:false,
          reason:null,
          expires_at:null
        }
      ];
    }

    if(normalizedMode===MODES.normal){
      return [
        {
          feature:FEATURES.readOnly,
          disabled:false,
          reason:null,
          expires_at:null
        },
        {
          feature:FEATURES.global,
          disabled:false,
          reason:null,
          expires_at:null
        }
      ];
    }

    throw new Error('INVALID_ASSISTANT_CONTROL_MODE');
  }

  function requiredPhrase(mode){
    if(mode===MODES.normal)return 'NORMAL';
    if(mode===MODES.readOnly)return 'READ_ONLY';
    if(mode===MODES.fullStop)return 'FULL_STOP';
    return '';
  }

  return {
    FEATURES,
    MODES,
    switchActive,
    deriveMode,
    buildTransition,
    requiredPhrase
  };
});

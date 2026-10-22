'use strict';

const { EVENT_TYPES } = require('../../lib/dual-core/event-taxonomy');
const {
  sanitizeMetadata,
  learningActionForType,
  publishAssistantOutcomeBestEffort
} = require('../../lib/dual-core/assistant-outcome-bridge');

describe('assistant outcome bridge', () => {
  test('sanitizes metadata to a strict allow-list', () => {
    expect(sanitizeMetadata({
      service_code:'svc-1',
      workflow_key:'wf-1',
      secret:'must-not-leak',
      raw_prompt:'must-not-leak'
    })).toEqual({
      service_code:'svc-1',
      workflow_key:'wf-1'
    });
  });

  test('maps user correction to modified learning action', () => {
    expect(learningActionForType(EVENT_TYPES.USER_CORRECTED)).toBe('modified');
    expect(learningActionForType(EVENT_TYPES.CAPABILITY_FAILED)).toBe('observed');
  });

  test('records capability failure through Core B consumer', async () => {
    const inserts=[];
    const supabase={
      from:jest.fn(()=>({
        insert:row=>{
          inserts.push(row);
          return {
            select:()=>({
              single:async()=>({data:{id:'x',...row},error:null})
            })
          };
        }
      }))
    };

    const result=await publishAssistantOutcomeBestEffort({
      supabase,
      type:EVENT_TYPES.CAPABILITY_FAILED,
      userId:'11111111-1111-1111-1111-111111111111',
      metadata:{
        service_code:'svc-1',
        error_code:'TOOL_FAILED',
        secret:'hidden'
      }
    });

    expect(result.ok).toBe(true);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].event_type).toBe(EVENT_TYPES.CAPABILITY_FAILED);
    expect(inserts[0].metadata.secret).toBeUndefined();
    expect(inserts[0].metadata.service_code).toBe('svc-1');
  });

  test('is best-effort and never throws into Core A', async () => {
    const supabase={
      from:jest.fn(()=>({
        insert:()=>({
          select:()=>({
            single:async()=>({data:null,error:{message:'db unavailable'}})
          })
        })
      }))
    };
    await expect(publishAssistantOutcomeBestEffort({
      supabase,
      type:EVENT_TYPES.CAPABILITY_FAILED,
      metadata:{service_code:'svc-1'}
    })).resolves.toEqual(expect.objectContaining({ok:false}));
  });
});

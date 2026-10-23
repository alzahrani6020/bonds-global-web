/** @jest-environment node */

const {
  normalizeParallelRequests,
  preflightParallelServices,
  executeParallelServices,
  parallelRequestContext
} = require('../../lib/services/parallel-tool-execution');

describe('Assistant parallel tool execution', () => {
  test('requires every task to be explicitly independent', () => {
    expect(() => normalizeParallelRequests([
      { service_code:'financial_analysis', body:{} }
    ])).toThrow('PARALLEL_TASK_NOT_DECLARED_INDEPENDENT');
  });

  test('bounds one parallel batch without limiting model token or context settings', () => {
    const requests = Array.from({ length: 9 }, (_, index) => ({
      id:`task-${index}`,
      service_code:'service-a',
      independent:true,
      body:{}
    }));
    expect(() => normalizeParallelRequests(requests))
      .toThrow('PARALLEL_REQUEST_LIMIT_EXCEEDED');
  });

  test('does not reuse a caller service token across concurrent tasks', () => {
    const child = parallelRequestContext({
      headers:{
        'x-bonds-service-token':'single-use-token',
        'x-request-id':'parent'
      }
    }, 'task-a');

    expect(child.headers['x-bonds-service-token']).toBeUndefined();
    expect(child.headers['x-request-id']).toBe('parent:task-a');
  });

  test('preflights the complete plan before any execution and rejects unsafe side effects', async () => {
    const executeServiceFn = jest.fn();
    const loadProfileFn = jest.fn().mockResolvedValue({
      profile:{ execution_mode:'capability_plan', primary_action:'unsafe_write' }
    });
    const getCapabilityFn = jest.fn().mockReturnValue({
      active:true,
      sideEffect:'database_write'
    });

    await expect(executeParallelServices({
      req:{ headers:{} },
      user:{ id:'user-1' },
      supabase:{},
      requests:[
        { id:'a', service_code:'service-a', independent:true, body:{} }
      ],
      loadProfileFn,
      getCapabilityFn,
      executeServiceFn
    })).rejects.toThrow('PARALLEL_SIDE_EFFECT_NOT_SAFE');

    expect(executeServiceFn).not.toHaveBeenCalled();
  });

  test('starts independent service executions concurrently and preserves input order', async () => {
    const started = [];
    let release;
    const gate = new Promise(resolve => { release = resolve; });

    const loadProfileFn = jest.fn().mockResolvedValue({
      profile:{ execution_mode:'capability_plan', primary_action:'financial_analysis_run' }
    });
    const getCapabilityFn = jest.fn().mockReturnValue({
      active:true,
      sideEffect:'compute'
    });
    const executeServiceFn = jest.fn(async ({ serviceCode }) => {
      started.push(serviceCode);
      await gate;
      return {
        httpStatus:200,
        body:{ ok:true, executed:true, service_code:serviceCode }
      };
    });

    const pending = executeParallelServices({
      req:{ headers:{} },
      user:{ id:'user-1' },
      supabase:{},
      requests:[
        { id:'first', service_code:'service-a', independent:true, body:{} },
        { id:'second', service_code:'service-b', independent:true, body:{} }
      ],
      loadProfileFn,
      getCapabilityFn,
      executeServiceFn
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(started).toEqual(['service-a','service-b']);
    release();

    const result = await pending;
    expect(result.httpStatus).toBe(200);
    expect(result.body.mode).toBe('parallel_independent');
    expect(result.body.succeeded).toBe(2);
    expect(result.body.failed).toBe(0);
    expect(result.body.results.map(item => item.id)).toEqual(['first','second']);
  });

  test('isolates one independent task failure without cancelling siblings', async () => {
    const loadProfileFn = jest.fn().mockResolvedValue({
      profile:{ execution_mode:'capability_plan', primary_action:'financial_analysis_run' }
    });
    const getCapabilityFn = jest.fn().mockReturnValue({
      active:true,
      sideEffect:'compute'
    });
    const executeServiceFn = jest.fn(async ({ serviceCode }) => {
      if (serviceCode === 'service-b') throw new Error('boom');
      return {
        httpStatus:200,
        body:{ ok:true, executed:true, service_code:serviceCode }
      };
    });

    const result = await executeParallelServices({
      req:{ headers:{} },
      user:{ id:'user-1' },
      supabase:{},
      requests:[
        { id:'first', service_code:'service-a', independent:true, body:{} },
        { id:'second', service_code:'service-b', independent:true, body:{} }
      ],
      loadProfileFn,
      getCapabilityFn,
      executeServiceFn
    });

    expect(result.httpStatus).toBe(200);
    expect(result.body.ok).toBe(false);
    expect(result.body.executed).toBe(true);
    expect(result.body.succeeded).toBe(1);
    expect(result.body.failed).toBe(1);
    expect(result.body.results[1].result.error.code).toBe('PARALLEL_TASK_EXECUTION_FAILED');
  });

  test('accepts registered read/compute side effects only', async () => {
    const plan = await preflightParallelServices({
      requests:[
        { service_code:'service-a', independent:true, body:{} }
      ],
      supabase:{},
      loadProfileFn:async()=>({
        profile:{ execution_mode:'capability_plan', primary_action:'funding_status' }
      }),
      getCapabilityFn:()=>({ active:true, sideEffect:'database_read' })
    });

    expect(plan[0].side_effect).toBe('database_read');
  });
});

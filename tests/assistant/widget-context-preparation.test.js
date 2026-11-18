/** @jest-environment node */
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('v3/components/ai-chat-widget.js','utf8');

function extract(start, end, context) {
  return vm.runInNewContext('(' + source.slice(source.indexOf(start), source.indexOf(end,source.indexOf(start))).trim() + ')', context);
}

describe('widget context handoff and bounded preparation', () => {
  afterEach(() => jest.useRealTimers());
  test('does not replay protected state from a server workflow into a general save', () => {
    const merge = extract('function mergeGuestStateIntoWorkflow(', 'async function resumePersistentCaseState', {
      sanitizeAssistantContextState:v => v, contextBoundaryKey:() => 'b', hasMeaningfulAssistantState:() => true
    });
    const server = Object.freeze({ sensitive_state:'confirmed',goal_workflow:{status:'active'},updated_at:'2026-11-17T00:00:00Z' });
    const result = merge(server, {goal:'New goal', updated_at:'2026-11-18T00:00:00Z'}, 'b');
    expect(result.changed).toBe(true);
    expect(result.state).not.toHaveProperty('sensitive_state');
    expect(result.state.goal_workflow).toEqual({status:'active'});
    expect(server.sensitive_state).toBe('confirmed');
  });
  test.each(['timeout','user'])('unblocks preparation on %s and does not resume after abort', async mode => {
    jest.useFakeTimers();
    let finishProfile;
    const state = {};
    const loading = jest.fn();
    const resume = jest.fn();
    const prepare = extract('async function prepareMessageContext()', 'async function sendMessage(text)', {
      AbortController,setTimeout,clearTimeout,state,setLoading:loading,
      loadVerifiedServiceProfile:() => new Promise(resolve => { finishProfile=resolve; }),
      resumePersistentCaseState:resume
    });
    const pending = prepare();
    expect(loading).toHaveBeenCalledWith(true);
    if (mode === 'user') { state.abortReason='user'; state.abortController.abort(); }
    else await jest.advanceTimersByTimeAsync(5000);
    expect(await pending).toBe(mode !== 'user');
    expect(state.abortController).toBeNull();
    expect(loading).toHaveBeenLastCalledWith(false);
    finishProfile(); await Promise.resolve();
    expect(resume).not.toHaveBeenCalled();
  });
});

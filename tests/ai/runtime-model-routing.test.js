  });

  test('runtime routing refuses use before persistent initialization', () => {
    const { controller } = setup();
    const runtime = new PersistentRuntimeModelRouting({
      lifecycleController:controller(),
      stateStore:new MemoryModelRoutingStateStore()
    });

    expect(() => runtime.selection('request-1'))
      .toThrow('RUNTIME_MODEL_ROUTING_NOT_INITIALIZED');
  });

  test('runtime router resolves champion model descriptor into provider router options', async () => {
    const { controller, modelRegistry } = setup();
    const runtime = new PersistentRuntimeModelRouting({
      lifecycleController:controller(),
      stateStore:new MemoryModelRoutingStateStore(),
      modelRegistry
    });

    await runtime.initialize();
    const routed = runtime.createRouter({ requestKey:'request-1' });

    expect(routed.selection).toMatchObject({
      model_id:'champion',
      role:'champion',
      canary:false
    });
    expect(routed.identity).toMatchObject({
      provider_id:'BONDS_NATIVE',
      model_id:'champion'
    });
  });

  test('100 percent canary routes runtime provider to challenger canonical model', async () => {
    const { controller, modelRegistry } = setup();
    const runtime = new PersistentRuntimeModelRouting({
      lifecycleController:controller(),
      stateStore:new MemoryModelRoutingStateStore(),
      modelRegistry
    });

    await runtime.initialize();
    await runtime.startCanary('challenger');

    const routed = runtime.createRouter({
      requestKey:'any-request',
      providerOverrides:{
        ollamaBaseUrl:'http://127.0.0.1:11434'
      }
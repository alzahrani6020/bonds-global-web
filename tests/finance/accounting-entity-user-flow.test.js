'use strict';

const fs = require('fs');
const path = require('path');
const {
  normalizeEntityName,
  normalizeCurrency,
  normalizeIdempotencyKey,
  AccountingEntityUserService
} = require('../../lib/finance/accounting/accounting-entity-user-service');

function chain(result) {
  const api = {
    select: jest.fn(() => api),
    eq: jest.fn(() => api),
    in: jest.fn(() => api),
    contains: jest.fn(() => api),
    insert: jest.fn(() => api),
    delete: jest.fn(() => api),
    single: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
  };
  return api;
}

describe('governed accounting entity user flow', () => {
  test('normalizes entity name and base currency deterministically', () => {
    expect(normalizeEntityName('  شركة   الاختبار  ')).toBe('شركة الاختبار');
    expect(normalizeCurrency('sar')).toBe('SAR');
    expect(() => normalizeEntityName('')).toThrow('ACCOUNTING_ENTITY_NAME_REQUIRED');
    expect(() => normalizeCurrency('SA')).toThrow('ACCOUNTING_ENTITY_CURRENCY_INVALID');
    expect(normalizeIdempotencyKey('req-123')).toBe('req-123');
    expect(normalizeIdempotencyKey('')).toBeNull();
    expect(() => normalizeIdempotencyKey('bad key')).toThrow('ACCOUNTING_ENTITY_IDEMPOTENCY_KEY_INVALID');
  });

  test('creates entity with created_by and verifies seeded owner membership', async () => {
    const entity = {
      id:'entity-1',
      name:'شركة الاختبار',
      base_currency:'SAR',
      status:'active',
      organization_id:null,
      metadata:{created_via:'services.accounting.entities'}
    };
    const membership = {
      accounting_entity_id:'entity-1',
      user_id:'user-1',
      role:'owner',
      status:'active'
    };

    const entityChain = chain({data:entity,error:null});
    const membershipChain = chain({data:membership,error:null});
    const supabase = {
      from: jest.fn(table => {
        if (table === 'accounting_entities') return entityChain;
        if (table === 'accounting_entity_members') return membershipChain;
        throw new Error('unexpected table ' + table);
      })
    };

    const service = new AccountingEntityUserService(supabase);
    const created = await service.createForUser('user-1', {
      name:'شركة الاختبار',
      base_currency:'sar'
    });

    expect(entityChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      name:'شركة الاختبار',
      base_currency:'SAR',
      status:'active',
      created_by:'user-1'
    }));
    expect(membershipChain.eq).toHaveBeenCalledWith('user_id','user-1');
    expect(created.role).toBe('owner');
  });

  test('replays an existing entity for the same idempotency key without another insert', async () => {
    const entity = {
      id:'entity-existing',
      name:'شركة الاختبار',
      base_currency:'SAR',
      status:'active',
      metadata:{creation_request_id:'req-1'}
    };
    const membership = {
      accounting_entity_id:'entity-existing',
      user_id:'user-1',
      role:'owner',
      status:'active'
    };
    const entityChain = chain({data:entity,error:null});
    const membershipChain = chain({data:membership,error:null});
    const supabase = {
      from: jest.fn(table => table === 'accounting_entities' ? entityChain : membershipChain)
    };

    const service = new AccountingEntityUserService(supabase);
    const replay = await service.createForUser('user-1', {
      name:'شركة الاختبار',
      base_currency:'SAR'
    }, 'req-1');

    expect(entityChain.contains).toHaveBeenCalledWith('metadata', { creation_request_id:'req-1' });
    expect(entityChain.insert).not.toHaveBeenCalled();
    expect(replay.id).toBe('entity-existing');
    expect(replay.idempotent_replay).toBe(true);
  });

  test('fails closed when owner membership trigger did not seed', async () => {
    const entityChain = chain({
      data:{id:'entity-2',name:'X',base_currency:'SAR',status:'active'},
      error:null
    });
    const membershipChain = chain({data:null,error:null});
    const supabase = {
      from: jest.fn(table =>
        table === 'accounting_entities' ? entityChain : membershipChain
      )
    };

    const service = new AccountingEntityUserService(supabase);
    await expect(service.createForUser('user-2',{name:'X'}))
      .rejects.toThrow('ACCOUNTING_ENTITY_OWNER_MEMBERSHIP_NOT_SEEDED');
    expect(entityChain.delete).toHaveBeenCalled();
    expect(entityChain.eq).toHaveBeenCalledWith('id','entity-2');
    expect(entityChain.eq).toHaveBeenCalledWith('created_by','user-2');
  });

  test('lists only active memberships and active accounting entities for user', async () => {
    const memberships = chain({
      data:[
        {accounting_entity_id:'e1',role:'owner',status:'active'},
        {accounting_entity_id:'e2',role:'accountant',status:'active'}
      ],
      error:null
    });
    const entities = chain({
      data:[
        {id:'e1',name:'One',base_currency:'SAR',status:'active'},
        {id:'e2',name:'Two',base_currency:'USD',status:'active'}
      ],
      error:null
    });
    const supabase = {
      from: jest.fn(table =>
        table === 'accounting_entity_members' ? memberships : entities
      )
    };

    const service = new AccountingEntityUserService(supabase);
    const rows = await service.listForUser('user-1');

    expect(rows).toEqual([
      expect.objectContaining({id:'e1',role:'owner'}),
      expect.objectContaining({id:'e2',role:'accountant'})
    ]);
    expect(memberships.eq).toHaveBeenCalledWith('user_id','user-1');
    expect(memberships.eq).toHaveBeenCalledWith('status','active');
    expect(entities.eq).toHaveBeenCalledWith('status','active');
  });

  test('services API exposes accounting entity route behind existing authenticated user boundary', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../v3/api/services.js'),
      'utf8'
    );
    expect(source).toContain("if (path === '/services/accounting/entities')");
    expect(source).toContain("if (!user) return sendJson(res, 401, { error: 'Unauthorized' });");
    expect(source).toContain('AccountingEntityUserService');

    const apiIndex = fs.readFileSync(
      path.join(__dirname, '../../v3/api/index.js'),
      'utf8'
    );
    expect(apiIndex).toContain("path.startsWith('/services/accounting/')");
  });

  test('recovers a logical duplicate from the database business identity constraint', async () => {
    const conflict = { data:null, error:{ code:'23505', message:'duplicate key' } };
    const businessEntity = {
      id:'entity-business',
      name:'ثقه',
      base_currency:'SAR',
      status:'active',
      metadata:{}
    };
    const membership = {
      accounting_entity_id:'entity-business',
      user_id:'user-1',
      role:'owner',
      status:'active'
    };
    const insertChain = chain(conflict);
    const businessChain = chain({data:businessEntity,error:null});
    const membershipChain = chain({data:membership,error:null});
    let entityCalls = 0;
    const supabase = {
      from: jest.fn(table => {
        if (table === 'accounting_entity_members') return membershipChain;
        entityCalls += 1;
        return entityCalls === 1 ? insertChain : businessChain;
      })
    };
    const service = new AccountingEntityUserService(supabase);
    const result = await service.createForUser('user-1',{name:'ثقه',base_currency:'SAR'});
    expect(result.id).toBe('entity-business');
    expect(result.business_identity_replay).toBe(true);
    expect(businessChain.eq).toHaveBeenCalledWith('normalized_name','ثقه');
  });
});

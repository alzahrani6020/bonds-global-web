# Financial Operations Core — Wave 6

## Scope

Wave 6 closes the first remaining post-Wave-5 gap: governed Asset / Collateral Registry.

It deliberately reuses `public.bonds_assets` as the canonical asset master. No parallel asset registry is introduced.

## Changes

- Links `bonds_assets` to `accounting_entities`.
- Adds governed acquisition/lifecycle fields needed by later fixed-asset accounting.
- Adds an assignment guard that validates accounting-entity membership for authenticated assignments.
- Adds `asset_collateral_assignments` for collateral relationships.
- Enforces composite `(accounting_entity_id, asset_id)` integrity to prevent cross-entity collateral linkage.
- Keeps collateral writes server-mediated: no direct anon/authenticated CRUD.
- Adds a minimal service-role store for asset creation and collateral assignment.

## Explicit non-goals

This wave does not implement:
- depreciation posting;
- fixed-asset schedules;
- impairment accounting;
- cost-center allocation;
- property evidence/document workflows;
- ZATCA or Ejar integrations.

Those remain separate future waves.

## Invariants

1. `bonds_assets` remains the canonical asset master.
2. Accounting-linked assets must reference an existing accounting entity.
3. Collateral assignments cannot cross accounting entities.
4. Collateral values and secured amounts cannot be negative.
5. Currency codes must be three uppercase letters.
6. Direct anon/authenticated CRUD is not granted on collateral assignments.
7. AI does not create accounting or collateral classifications.

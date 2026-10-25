# Financial Operations Core — Wave 10

## Scope

Wave 10 exposes the verified accounting operations through the existing service execution boundary.

## Canonical path

`POST /api/v3/services/execute`

Service code:

`accounting_operations`

The requested operation is supplied as `action`. The router accepts it only when the action is present in `service_capability_map` for `accounting_operations`.

## Supported actions

- `accounting_dimension_create`
- `accounting_period_transition`
- `accounting_asset_create`
- `accounting_collateral_assign`
- `accounting_depreciation_policy_configure`
- `accounting_depreciation_post`

## Authorization

Every write:

1. requires an authenticated user;
2. resolves governance through the existing service execution gateway;
3. verifies active membership in `accounting_entity_members`;
4. accepts only `owner/admin/accountant` at the runtime boundary;
5. delegates stricter operation-specific rules to existing database workflows, including period close role rules.

No user-supplied role or actor id is trusted.

## Architecture

- existing `financial-engine` manifest remains the internal capability registry;
- existing accounting stores remain the execution implementation;
- existing `/services/execute` remains the only execution API;
- no parallel accounting endpoint, ledger, or asset registry is created.

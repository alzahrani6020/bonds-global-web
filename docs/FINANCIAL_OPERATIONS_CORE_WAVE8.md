# Financial Operations Core — Wave 8

## Scope

Wave 8 adds a governed accounting-period close workflow on top of the existing `accounting_periods` table.

## Reuse

- Existing period master: `accounting_periods`
- Existing period states: `open / soft_closed / closed`
- Existing posting guard: `accounting_assert_open_period()`
- Existing accounting entity membership: `accounting_entity_members`

No parallel period table or posting engine is introduced.

## Governance

- `accountant`, `admin`, `owner`: may soft-close an open period.
- `admin`, `owner`: may finally close a period.
- `admin`, `owner`: may reopen a soft-closed or closed period.
- Reopen requires an explicit reason.
- Direct anon/authenticated access to the transition RPC is revoked.
- The server passes the actor user id; the database validates active membership and role.

## Pre-close gates

Soft-close and final close reject when:

1. Draft journals remain in the period.
2. A journal is linked to the period but its effective date is outside the period range.
3. Accepted/unposted financial events remain in the period.
4. Pending subledger entries remain in the period.

## Audit

Every successful transition is written to `accounting_period_close_events` with:

- action
- from/to status
- actor user
- actor role
- reason
- metadata
- timestamp

## Non-goals

- year-end retained earnings closing entries
- consolidation close
- tax close
- period overlap redesign
- cost centers / segments

Those remain separate future waves.

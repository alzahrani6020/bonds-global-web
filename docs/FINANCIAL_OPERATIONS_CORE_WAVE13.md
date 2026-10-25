# Financial Operations Core — Wave 13

## Scope

Wave 13 adds governed fiscal year-end close and reopen.

It extends the canonical accounting core. It does not create a parallel ledger,
journal, period engine, account master, dimension master, or HTTP endpoint.

## Explicit policy

Each Accounting Entity may configure one active year-end policy containing:

- retained earnings account;
- retained earnings dimensions;
- fiscal year-end month;
- fiscal year-end day.

The retained earnings account must be an active postable equity or contra-equity
account in the same Accounting Entity.

No retained earnings account or fiscal calendar is inferred.

## Year-end close

The governed close workflow:

1. requires owner/admin authorization;
2. locks the fiscal-year close identity;
3. validates the configured fiscal year-end date;
4. validates complete, contiguous period coverage;
5. requires all prior periods in the fiscal year to be closed;
6. requires the closing period to be open and to end on the fiscal year-end;
7. computes posted temporary-account balances by account and dimensions;
8. creates opposite-side closing lines for revenue/expense temporary accounts;
9. transfers net income/loss to the configured retained earnings account;
10. posts the balanced closing entry through `accounting_commit_posting()`;
11. closes the final period through `accounting_transition_period()`;
12. records an audited year-end close run.

Temporary account types:

- revenue
- contra_revenue
- expense
- contra_expense

## Reopen

A closed fiscal year cannot be reopened through the generic period transition.

The dedicated reopen workflow:

1. requires owner/admin authorization and an explicit reason;
2. marks the close run as reopening inside the same transaction;
3. reopens the closing period through the canonical period transition;
4. posts an exact reversal of the closing journal through
   `accounting_commit_posting()`;
5. links the reversal journal to the original closing journal;
6. marks the original close event/subledger/journal as reversed;
7. records the reopened year-end run state.

Any failure rolls back the entire reopen transaction.

## Idempotency

Close and reopen use SHA-256 request identities through
`extensions.digest(...)`.

A completed year-end close is replay-safe for the same fiscal year.

## Service execution

Wave 13 adds three actions to the existing `accounting_operations` service:

- `accounting_year_end_policy_configure`
- `accounting_year_end_close`
- `accounting_year_end_reopen`

All continue to execute through:

`POST /api/v3/services/execute`

## Deferred

Outside Wave 13:

- dimension-based financial statements;
- automated fiscal-year schedule creation;
- statutory consolidation/elimination;
- multi-entity group close.

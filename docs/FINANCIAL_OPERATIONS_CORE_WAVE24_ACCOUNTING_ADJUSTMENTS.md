# Financial Operations Core — Wave 24 Accounting Adjustments

## Scope
Wave 24 activates the published `accounting_adjustments` service without creating a parallel ledger or posting RPC.

## Canonical execution
- Capability: `accounting_adjustment_post`
- Capability ID: `BONDS-CAP-FIN-045`
- Posting: existing `accounting_commit_posting(jsonb,jsonb)`
- Supported adjustment types: accrual, deferral, reclassification, correction, reversal.
- Accounting Entity access remains mandatory.
- Balanced journal validation remains mandatory.
- Existing postable account codes are required; accounts are never invented.

## Reversal governance
A reversal requires a posted source journal from the same Accounting Entity. Its lines are reversed deterministically. The source journal ID is written into the canonical financial-event payload and into `accounting_journal_entries.reversal_of` atomically by the existing canonical posting RPC. A unique partial index prevents more than one reversal journal for the same source journal and entity.

## Non-goals
Wave 24 does not:
- modify or delete a posted journal;
- create a second ledger;
- add an alternative posting RPC;
- infer missing accounts;
- bypass Accounting Entity membership or open-period controls.

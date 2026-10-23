# BONDS Independent Runtime Source Staging

Status: ISOLATED / FAIL-CLOSED / NOT ACTIVE IN PRODUCTION

This directory contains BONDS-owned source copies adapted from selected AFAQ-GIE runtime components. It is intentionally outside the production import graph.

Source snapshot:
- Repository: `alzahrani6020/AFAQ-GIE`
- Commit: `b1fec7fa400c57f32c2022a21cf74039379fc3cf`

## Imported runtime families

1. Web acquisition
   - public URL fetch
   - bounded crawling
   - content extraction
   - browser execution
   - API-surface discovery
   - acquisition strategy
   - platform/network modeling
   - evidence verification
   - continuous source observation

2. Intelligence / reasoning
   - research evidence analysis and synthesis
   - project/instruction understanding
   - mission modeling
   - causal/hypothesis reasoning
   - scenario/forecast/uncertainty logic
   - research portfolio and opportunity/goal formation

3. Engine adapters
   - governed browser adapter
   - resilient web acquisition adapter
   - research intelligence adapter
   - causal/forecast adapter
   - continuous observatory adapter
   - mission modeling adapter
   - portfolio/goal adapter

## BONDS components intentionally NOT copied from AFAQ

BONDS already owns these responsibilities and remains authoritative:
- Capability Registry
- Governed Action Fabric / executor
- authorization and audit
- Service Token handling
- AI inference routing
- financial engines/calculators
- service execution routing

AFAQ mutation, self-development, self-healing, training/promotion, developer-agent and repository-governance stacks are not imported.

## Independence boundary

- No submodule, symlink, package dependency, runtime import, API call, or network call to AFAQ-GIE.
- AFAQ namespace references in executable imports were renamed to BONDS.
- The AFAQ `current_authority` dependency was removed.
- `bonds_runtime_governance.py` is deliberately fail-closed and grants no authority.
- Production activation must replace the staging governance shim with an adapter to the existing BONDS governed execution boundary.
- Source provenance comments may name AFAQ-GIE; these are audit metadata only, not runtime dependencies.

## Activation rule

Nothing under this directory may be added to the production import graph until:
1. dependency audit passes;
2. BONDS-specific tests pass;
3. governance adapter is bound to BONDS;
4. capability registrations are explicit;
5. side-effect actions are separately authorized;
6. production smoke proves the exact deployed SHA.

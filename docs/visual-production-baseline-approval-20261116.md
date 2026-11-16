# BONDS production visual reference — user-approved on 2026-11-16

## Decision
The user explicitly approved the **currently published** `https://bonds-global.com` visual design as the canonical visual reference for desktop, tablet, mobile, Arabic and English. Preserve the deployed appearance; do not redesign to make old screenshots pass.

## Verified provenance at approval
- Domain queried: `bonds-global.com`
- Vercel project: `bonds-global-web`
- Deployment: `dpl_2Ddwcif8u1EwA2hqD21uEuD46vzv`
- Deployment Git SHA reported by Vercel: `dea2b14e792b840542d1f42b95d4b02e1d702fee`
- Deployment state reported by Vercel: `READY`
- This is a **reference to a deployed build**, not proof that reference screenshots have been captured.

## Acceptance rules (do not skip)
1. Obtain authenticated, reproducible visual snapshots from the pinned production deployment using the same viewport sizes, browser build, language, clock, cookie state, font loading and image readiness as the regression suite.
2. Capture the actual approved page (including its Riyadh skyline hero image) and verify the HTTP response origin and deployed SHA before comparison; retain source provenance and checksums.
3. Compare the new snapshots to existing baselines and review all changed regions, including desktop English and tablet Arabic/English; do **not** suppress the home page comparisons, raise pixel tolerance, or modify references merely to pass CI.
4. Only after visual review, replace baseline files in a separate reviewed change and repeat the full visual suite against the candidate code.
5. Keep functional, security, RLS, access-control, financial and operational acceptance gates unchanged. This decision does not approve the Makkin migration or production deployment.

## Current state
Visual reference approval: **CONFIRMED by user**.
Production screenshot capture, comparison, and baseline-file update: **NOT VERIFIED / NOT EXECUTED**.
PR #1111: **DRAFT / DO NOT MERGE OR DEPLOY** until original full program acceptance.

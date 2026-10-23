# BONDS Capability Import Staging

Status: ISOLATED / NON-RUNTIME / NO ACTIVATION

This directory is an isolated import staging area inside BONDS. Nothing here is imported by application/runtime code.

Source repository: `alzahrani6020/AFAQ-GIE`
Source snapshot: `b1fec7fa400c57f32c2022a21cf74039379fc3cf`
Target baseline: `10e2de3489befa22df9820bac2c78c5f430e0756`

## Purpose

Prepare BONDS-owned copies/definitions for the open assistant capability fabric, including:
- open-domain understanding and reasoning
- research, retrieval, crawling and browser/computer use
- capability discovery and provider resolution
- planning, dynamic replanning and multi-engine fusion
- evidence verification and research synthesis
- data/analytics intelligence
- continuous knowledge observation and frontier discovery
- API/integration, communications, marketing and publishing references
- social/messaging/email capability references

## Isolation rules

1. AFAQ is read-only source material.
2. No runtime import, package dependency, submodule, symlink or API dependency points back to AFAQ.
3. Names copied into this staging area are normalized to BONDS ownership.
4. Runtime-proven source definitions remain untrusted in BONDS until BONDS-specific integration tests pass.
5. Design-only/source-blocked engines stay reference-only and MUST NOT be registered as executable capabilities.
6. Activation requires a separate BONDS integration PR through the existing Capability Registry, Governed Action Fabric, authorization and audit gates.
7. Existing BONDS financial engines remain authoritative for financial calculations.
8. External side-effect actions such as publishing, messaging, email sending or account mutation require explicit provider credentials, user authorization, confirmation where required, idempotency and audit.

## Files

- `runtime-proven-engines.json`: source engines proven operational in AFAQ and selected for BONDS adaptation.
- `design-reference-engines.json`: useful engines that are not proven operational in the source and must remain non-executable references.
- `capability-packages.json`: selected package definitions relevant to the BONDS open assistant.
- `IMPORT_POLICY.json`: immutable staging policy.

This staging directory intentionally does not modify or import any production BONDS code.

# Provider-Agnostic AI/API Onboarding

This contract keeps authorization and performance separate.

## Mandatory governance

Every registered service remains subject to identity, permissions, entitlements, feature flags, audit, and service-token validation when the service requires a token.

A service token may constrain issuer, audience, subject, scope, expiry, revocation state, and replay behavior. It must not define provider choice, model choice, throughput, context window, concurrency, payload complexity, or compute capacity.

## Performance policy

Application-level rate limits and retry ceilings are optional. If a service manifest omits `limits`, the governance gateway does not impose a synthetic requests-per-minute ceiling.

Provider, model, endpoint, context size, concurrency, batching, streaming, and scaling policy are runtime concerns and can evolve independently from the authorization contract.

Infrastructure or provider-native protections may still be used where operationally necessary, but they are not part of the service-token authorization contract.

## Onboarding rule

To add a new AI or API service:

1. Register its `service_code`, governance requirements, security posture, observability, data policy, workflows, and capabilities.
2. Add a service-token policy only when the service requires governed machine-to-machine authorization.
3. Bind the token audience to the service identity.
4. Do not encode provider/model/performance ceilings into the token.
5. Add operational limits only when intentionally required for that specific service.

The machine-readable source of truth is `services/manifests/service-onboarding.contract.json`.

# Deployment Topology

## Production

Bonds Global is deployed from the repository root of `alzahrani6020/bonds-global-web`.

- Vercel project: `bonds-global-web`
- Production branch: `main`
- Project root: repository root
- Root package: `/package.json`
- Active Vercel configuration: `/vercel.json`
- CI working root: repository root

The root Vercel configuration serves the public site, APIs, and the V3 surfaces. In particular, routes under `/v3/*`, `/en/v3/*`, and `/api/v3/*` are routed by the root `vercel.json`.

## V3

`/v3` is a nested application/runtime package within the same production repository and deployment topology. It has its own `package.json` and `vercel.json` so it can be developed or deployed independently when explicitly intended, but that nested configuration is not the active configuration for the current Bonds production project.

Do not assume that running Vercel from `/v3` targets the production `bonds-global-web` project. An independent V3 deployment requires an explicitly linked Vercel project and separate release decision.

## CI

GitHub Actions installs and tests from the repository root. Individual service tests may set their own `working-directory`, but there is no repository-wide CI switch to `/v3`.

## Operational rule

For the current production site:

1. Treat the repository root as the production root.
2. Treat `/vercel.json` as the active deployment configuration.
3. Treat `/v3/vercel.json` as nested/standalone-capable configuration, not the current production config.
4. Do not consolidate or delete the V3 package merely because both root and V3 contain package/Vercel files.

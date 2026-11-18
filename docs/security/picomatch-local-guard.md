# Local tooling mitigation for GHSA-fc5q-39xc-vjpf

The installed picomatch 2.3.2 and 4.0.7 copies are development dependencies.
An unbounded repeated extglob containing a wildcard, such as `+(*a)`, can
generate a regular expression that blocks its Node process. The upstream
advisory reported no patched release when this mitigation was prepared.

The repository-owned postinstall checks the reviewed upstream parser's SHA-256
before inserting a linear input guard into both parser entry points. It rejects
wildcards or nested unbounded extglobs inside unbounded repeated groups before
regular-expression compilation. Bracketed and escaped literal stars and normal
tooling patterns remain supported. Dangerous patterns fail closed rather than
being silently rewritten to different matching semantics.

The exact package versions, paths and original hashes are in
`scripts/security/picomatch-guard.js`. Reapplication is idempotent. Verification
reconstructs the original bytes, checks their hash, and requires an exact match
to the canonical patched source. Unknown upgrades, missing packages during the
full audit, modified patches, and omitted patches block the security gate.
Production installs omitting development dependencies have no copies to patch.

The audit job intentionally installs with scripts disabled, then explicitly
applies and verifies this patch. npm audit still reports the original upstream
versions. Advisory evaluation recognizes only this advisory on these verified
development copies; production highs and other newly discovered highs remain
blocked. The vulnerability advisory baseline is unchanged.

`tests/security/picomatch-guard.test.js` reproduces the unpatched denial of
service in an isolated child with a hard timeout, then verifies rejection by all
three installed copies and by both parser entry points. It also checks ordinary
glob compatibility, source tampering, and the audit rule's scope restrictions.
The guard is included in the critical security suite.

This is a local mitigation, not an upstream package update or a claim that every
glob-related vulnerability is fixed. Some previously accepted risky extglobs now
throw a SyntaxError. CI and the staged Vercel build must pass before release.
When upstream publishes a reviewed fix, replace this mitigation through a
dependency update and rerun the same exploit, compatibility and release checks.

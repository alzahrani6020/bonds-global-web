# Independence Checklist

- [x] Source copied into BONDS repository staging.
- [x] No Git submodule or symlink to AFAQ.
- [x] No runtime network call to AFAQ.
- [x] AFAQ namespaces renamed in copied executable source.
- [x] `current_authority.resolver` removed from copied web runtime.
- [x] Local fail-closed BONDS governance shim added.
- [x] Existing BONDS financial/action/token/inference ownership preserved.
- [x] Imported source remains outside production runtime imports.
- [ ] Bind staged governance calls to the real BONDS Governed Action Fabric.
- [ ] Register selected capabilities in the BONDS Capability Registry.
- [ ] Add BONDS-specific unit/integration tests.
- [ ] Run CI after integration.
- [ ] Verify exact production deployment SHA after activation.

A checked staging item means the copy boundary is established; it does not mean the capability is production-active.

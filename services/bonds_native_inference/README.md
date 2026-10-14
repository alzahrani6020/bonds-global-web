# Bonds Native Inference

## Architecture state

Bonds Native is the approved inference path for Bonds analysis.

Production is intended to use:

- `BONDS_INFERENCE_MODE=REMOTE_BONDS_NATIVE`
- Remote URL: `https://native.bonds-global.com`
- Provider: `BondsNativeProvider`
- Windows host runtime: `BondsNativeRuntime`
- Cloudflare tunnel: `bonds-native`

Do not treat this document as proof of live health. Live readiness must be established from runtime probes.

A healthy production response from `/api/health` must include:

```json
{
  "status": "ok",
  "checks": {
    "supabase": "ok",
    "native": "ok"
  },
  "inference": {
    "mode": "REMOTE_BONDS_NATIVE",
    "provider": "BondsNativeProvider",
    "reachable": true
  }
}
```

## Readiness verification

Use the read-only readiness probe on the Windows host:

```powershell
.\services\bonds_native_inference\windows\verify-readiness.ps1
```

It verifies three independent layers:

1. Local Native health: `http://127.0.0.1:8765/health`
2. Remote Native path: `https://native.bonds-global.com/health`
3. Production application health: `https://bonds-global.com/api/health`

The probe does not restart or mutate services. It returns non-zero unless all three layers are healthy and classifies common failures such as tunnel/origin failure, authentication failure, timeout, and application health failure.

## Windows startup

Current `main` behavior registers the Native runtime and tunnel under the current Windows user with an Interactive `AtLogOn` trigger:

```powershell
.\services\bonds_native_inference\windows\install-startup.ps1 -ModelPath "<absolute GGUF path>"
```

This is the current baseline, not the final no-login target. Migration to boot-level/non-interactive startup must be tested independently before the old tasks are disabled.

Runtime logs are stored under `%ProgramData%\BondsNative`:

- `native-runtime.log`
- `native-runtime.stdout.log`
- `native-runtime.stderr.log`
- `cloudflared.log`
- `cloudflared.stdout.log`
- `cloudflared.stderr.log`

The existing local startup verifier remains available:

```powershell
.\services\bonds_native_inference\windows\verify-startup.ps1
```

`verify-startup.ps1` validates local runtime startup only. Use `verify-readiness.ps1` for local + remote + production readiness.

## Architecture decision

Keep the current `server.py` + `threading.Lock` single-flight runtime until measured production evidence justifies a concurrency architecture change.

Measured host behavior previously showed:

- stable model residency after load;
- no repeated model load during warm/concurrent requests;
- no crash or OOM in measured runs;
- generation throughput broadly stable;
- concurrency cost primarily visible as lock wait / serialization.

Do not introduce Qwen, a new inference fallback, llama-server, Semaphore-based masking, asyncio workarounds, queue brokers, or other runtime architecture changes without a measured failure that requires them.

## Canonical production model

The canonical Bonds Native artifact is defined in `canonical-model.json`.

Current approved artifact:

- source: `lmstudio-community/gemma-4-E4B-it-GGUF`
- source revision: `99210a71094c6aa8559f764e0cadedd7d89de94d`
- upstream model: `google/gemma-4-E4B-it`
- artifact: `gemma-4-E4B-it-Q4_K_M.gguf`
- SHA-256: `0ffb122c8b6921f13cbc34186e052524d0b5803b17f4867b7197a561400b3770`
- license: `Apache-2.0`
- storage: outside Git under the host model store
- runtime: `n_ctx=4096`, `n_threads=10`, `n_gpu_layers=-1`, `max_tokens=512`, `temperature=0.2`

Provision it on the Windows host with:

```powershell
.\services\bonds_native_inference\windows\provision-canonical-model.ps1
```

The provisioning script pins the Hugging Face repository revision and verifies the complete GGUF SHA-256 before writing the sidecar. The startup installer independently verifies the canonical filename and SHA-256 and exports `BONDS_NATIVE_MODEL_SHA256` at machine scope.

Tracking issue: #79.

## Configuration policy

Repository examples define safe development defaults only.

For Bonds analysis, the intended policy is:

```text
BONDS_AI_PROVIDER=native-only
BONDS_OPENAI_FALLBACK=false
```

Production configuration must be verified independently; documentation must not be used as evidence that a live environment has a particular value.

## Validation boundary

The following claims require live verification and must not be inferred from task/process state alone:

- Windows runtime health;
- Cloudflare tunnel reachability;
- Vercel-to-Native reachability;
- production `/api/health`;
- authenticated application flow through `POST /api/v3/ai/analyze`.

A scheduled task or process showing `Running` is not equivalent to service readiness.

Do not expose a public generation endpoint solely for diagnostics.

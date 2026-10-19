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

## Boot-level Windows services

The legacy `install-startup.ps1` path remains available for rollback and existing hosts, but the durable no-login target is Windows Service Control Manager (SCM).

Install the native service dependency first:

```powershell
python -m pip install -r .\requirements-native-inference.txt
```

Prepare the runtime service without changing the active runtime:

```powershell
.\services\bonds_native_inference\windows\install-runtime-service.ps1 -ModelPath "C:\ProgramData\BondsNative\models\gemma-4-E4B-it-Q4_K_M.gguf"
```

Activate only after preparation:

```powershell
.\services\bonds_native_inference\windows\install-runtime-service.ps1 -ModelPath "C:\ProgramData\BondsNative\models\gemma-4-E4B-it-Q4_K_M.gguf" -Activate
```

The installer:

- verifies the canonical filename and SHA-256;
- stages runtime code under `%ProgramData%\BondsNative\runtime\` so service execution is not tied to a Git checkout or interactive user profile;
- installs `BondsNativeRuntimeService` with Automatic startup;
- configures SCM recovery restarts;
- probes authenticated local health before disabling the legacy `BondsNativeRuntime` scheduled task;
- restores the legacy task automatically if cutover health fails.

### Cloudflare Tunnel service

For locally-managed tunnels, prepare the official `cloudflared` Windows service without changing the active tunnel:

```powershell
.\services\bonds_native_inference\windows\install-cloudflared-service.ps1
```

Then perform the health-checked cutover:

```powershell
.\services\bonds_native_inference\windows\install-cloudflared-service.ps1 -Activate
```

The installer copies the executable, config, and tunnel credential into `%ProgramData%\BondsNative\cloudflared\`, validates ingress, configures Automatic startup and SCM recovery, confirms remote Native health, and only then disables the legacy `BondsNativeTunnel` task.

Legacy duplicate `cloudflared` processes are not killed by default. After service health is verified, they can be removed explicitly with:

```powershell
.\services\bonds_native_inference\windows\install-cloudflared-service.ps1 -Activate -CleanupLegacyProcesses
```

## Hardware-independent Native nodes

Production routing supports an ordered set of Native nodes. The first healthy node is primary; later nodes are standby targets.

Preferred configuration:

```text
BONDS_INFERENCE_MODE=REMOTE_BONDS_NATIVE
BONDS_NATIVE_REMOTE_URLS=https://native-a.bonds-global.com,https://native-b.bonds-global.com
```

`BONDS_NATIVE_NODES` is accepted as an alias. The historical `BONDS_NATIVE_REMOTE_URL` remains supported for single-node compatibility.

The router:

- fails over on connection/timeout failures and server-side 5xx failures;
- does not fail over on authentication or client request errors;
- opens a per-node circuit after repeated failures and temporarily bypasses the unhealthy node;
- preserves node order, enabling Primary/Standby operation before any Active/Active rollout.

For a hardware migration, never shut down the old node first. Provision the replacement node with the canonical artifact, verify model SHA-256, local health, remote tunnel health, and production readiness, add it to `BONDS_NATIVE_REMOTE_URLS`, then move primary order only after verification. The old node may remain as standby until the new host has completed a burn-in period.

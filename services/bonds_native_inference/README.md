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

## Service health supervisor

In production the three components run as Windows services (`BondsNativeRuntimeService`, `BondsTokenRuntimeService`, `Cloudflared`; LocalSystem, auto start, SCM restart-on-crash). SCM only reacts to a **crashed** process; it cannot detect a service that is running but not answering. `windows/service-supervisor.ps1` closes that gap and **replaces the legacy `watchdog.ps1`** (which manages the retired `BondsNativeRuntime` / `BondsNativeTunnel` scheduled tasks and must not be enabled next to the services).

```powershell
# Report-only check of all three layers (never restarts anything; exit 1 if unhealthy)
.\services\bonds_native_inference\windows\service-supervisor.ps1 -Once

# Install as a SYSTEM scheduled task (elevated PowerShell). Runs at boot, also on battery.
.\services\bonds_native_inference\windows\install-service-supervisor.ps1 -RemoveLegacyWatchdog
```

Probes: Native `GET 127.0.0.1:8765/health` (authenticated, `runtime.available`), token runtime `GET 127.0.0.1:8771/health` (HTTP 200/401 proves it is serving; no secret needed), tunnel `GET https://native.bonds-global.com/health`.

Safeguards: 3 consecutive failures before a restart; startup grace after restart/boot/wake (180s Native, 60s others); 300s cooldown per service; at most 6 restarts/hour per service (then it gives up and alerts); the tunnel is restarted only when the local runtime is healthy **and** the internet is reachable; stuck services are force-killed after 30s. Pause recovery for maintenance by creating `%ProgramData%\BondsNative\supervisor.paused`. Optional alerts: set machine env `BONDS_SUPERVISOR_ALERT_WEBHOOK` to a Slack/Discord-compatible webhook.

Outputs under `%ProgramData%\BondsNative`: `service-supervisor.log` (rotated at 5 MB, logs only non-healthy events) and `service-supervisor-heartbeat.json`.

Host power: this is a laptop. Sleep/Modern Standby on battery suspends all three services and drops the tunnel; keep `standby-timeout-dc` at `0` (see `powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE`) or keep the machine on AC.

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
- runtime: `n_ctx=8192`, `n_threads=10`, `n_gpu_layers=-1`, `max_tokens=512`, `temperature=0.2`

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

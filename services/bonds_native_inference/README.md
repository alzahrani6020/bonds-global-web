# Bonds Native Inference

## Production state

Bonds Native is active in production through the remote Native path:

- Vercel: `BONDS_INFERENCE_MODE=REMOTE_BONDS_NATIVE`
- Remote URL: `https://native.bonds-global.com`
- Production timeout: `120000` ms
- Provider: `BondsNativeProvider`
- Windows host runtime: `BondsNativeRuntime`
- Windows Cloudflare tunnel: `BondsNativeTunnel`

`/api/health` performs a server-to-server Native health probe whenever production is configured for `REMOTE_BONDS_NATIVE`. A healthy production response must include:

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

## Windows startup

Install once from an elevated PowerShell window:

```powershell
.\services\bonds_native_inference\windows\install-startup.ps1 -ModelPath "<absolute GGUF path>"
```

The installer registers both tasks under the current Windows user with an Interactive logon trigger.

Runtime logs are stored under `%ProgramData%\BondsNative`:

- `native-runtime.log`
- `native-runtime.stdout.log`
- `native-runtime.stderr.log`
- `cloudflared.log`
- `cloudflared.stdout.log`
- `cloudflared.stderr.log`

Verify startup with:

```powershell
.\services\bonds_native_inference\windows\verify-startup.ps1
```

## Architecture decision

Keep the current `server.py` + `threading.Lock` single-flight runtime.

Measured host behavior showed:

- stable model residency after load;
- no repeated model load during warm/concurrent requests;
- no crash or OOM in the measured runs;
- generation throughput remained broadly stable;
- concurrency cost appeared primarily as lock wait / serialization.

The current evidence does not justify adding Qwen, a new inference fallback, llama-server, Semaphore-based masking, or asyncio workarounds.

Revisit the runtime architecture only if canonical-model production measurements show an unacceptable service-level impact from serialized wait time.

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

## Validation boundary

Current production evidence proves:

- Native runtime health on the Windows host;
- authenticated tunnel reachability;
- Vercel production-to-Native server-to-server reachability;
- production `/api/health` and `/api/v3` availability.

The authenticated application flow through `POST /api/v3/ai/analyze` remains a user-authenticated application check. It must not be replaced with a public generation endpoint just for diagnostics.

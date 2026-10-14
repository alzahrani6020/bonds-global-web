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

## Canonical model gate

The currently validated host model is provisional. Production architecture must not treat it as the canonical Bonds model until the following are defined and recorded:

- model source and version;
- license;
- provenance;
- expected SHA-256;
- provisioning procedure;
- runtime parameters.

Tracking issue: #79.

## Validation boundary

Current production evidence proves:

- Native runtime health on the Windows host;
- authenticated tunnel reachability;
- Vercel production-to-Native server-to-server reachability;
- production `/api/health` and `/api/v3` availability.

The authenticated application flow through `POST /api/v3/ai/analyze` remains a user-authenticated application check. It must not be replaced with a public generation endpoint just for diagnostics.

# Bonds inference engine staging candidate

**Status: experimental; NOT installed, NOT production-approved.**

This isolated folder deliberately does not modify `server.py`, `native_generator.py`, Windows scheduled tasks, `8765`, `8771`, `BondsNativeTunnel`, GitHub Actions, Vercel, or production traffic.

## Why and constraints

Existing `services/bonds_native_inference/README.md` explicitly requires measured justification before migrating to llama-server. Observed slow synchronous inference and 524 motivate a controlled A/B experiment, but do **not** prove Vulkan is superior or that switching the engine fixes the Cloudflare 125-second synchronous read timeout.

The staging engine archive is pinned to upstream **b11669** (NOT `v0.7.0`), because the verified official CPU/Vulkan Windows binaries and checksums are available for this build. This build is an experiment candidate, not an approved permanent version. Promotion requires explicit review of release provenance, compatibility, security, and results. No build toolchain or Python changes.

## Preflight

Run only on an authorized **Windows staging host** with verified Intel Arc Vulkan driver and adequate disk/RAM. Check that no existing production process uses the selected port, verify the exact canonical model artifact and its sha256 via `canonical-model.json`. Source payload must be safely redacted of customer data and secrets. Verify process owners and system resource headroom. Never run on production without an approved maintenance plan.

## Manual A/B experiment (no service installation)

From this folder in Windows PowerShell:

```powershell
.\install-engine.ps1 -Profile cpu
.\install-engine.ps1 -Profile vulkan
.\start-engine.ps1 -Profile cpu -ModelPath 'X:\models\gemma-4-E4B-it-Q4_K_M.gguf' -GpuLayers 0 -Port 18965
```

In another shell, after load and readiness (example: `Invoke-RestMethod http://127.0.0.1:18965/health`), run:

```powershell
.\benchmark.ps1 -Profile cpu -Port 18965 -PayloadPath '.\private-production-equivalent-payload.json' -Runs 10 -Warmups 2
```

Stop foreground process, verify no listener/child remains; restart with `-Profile vulkan -GpuLayers <measured-safe-count>` and the same model/context/prompt/sampling, then repeat. `start-engine.ps1` does not register startup tasks. Never store real payloads, tokens, or model files inside Git; benchmark outputs go to `%LOCALAPPDATA%\BondsInferenceStaging\logs`.

The `benchmark.ps1` fixture uses the OpenAI-compatible chat endpoint and enforces `max_tokens=900`. Copy all other request parameters exactly from production; record hardware/driver/version, input/output tokens, model loading and resident RSS/VRAM separately. Its JSONL captures end-to-end elapsed time, token counts, errors; it does **not** yet measure true TTFT, prompt evaluation time, GPU use, RAM/VRAM, queue delay, or independent failure recovery. Do not claim those metrics have been measured.

## Decision gates

1. Verified exact SHA256 for archive and GGUF; no unknown replacement binaries.
2. CPU and Vulkan with equivalent request shape and context; repeat cold/warm runs, compare median/tail latency and output token throughput.
3. Separate GPU-utilization observation from genuine CPU/Vulkan performance improvement.
4. Stable full-model load and pressure tests, concurrency=1 first; expand only after measurement.
5. Model and engine lifecycle must be managed by an independently supervised Windows service **after** choice of supervisor is verified. A foreground script is **not** durable service management.
6. Confirm reboot/no-login activation, single-process ownership, crash recovery, port confinement, restricted tokens/config/log access, long-run load, and rollback **before** production cutover.
7. If verified production-equivalent P95 is not comfortably below the Cloudflare read window, deploy a durable job-status/polling design independently; this staging engine alone does not solve 524.

## Rollback plan

Because this stage does not modify production, rollback here means stop foreground candidate, verify loopback port closed, and leave original `8765`/`8771` and tunnel untouched. Later production rollback must be implemented and demonstrated with an immutable prior engine release plus an atomic routing reversal and active-request drain; it is **not yet implemented**.

## Fail-closed policy

Do not expose staging to network; bind to `127.0.0.1` only. Do not change system PATH, machine-scoped environment variables, service registration, firewall, tunnels, or Vercel from these scripts. Promotion is blocked until contract compatibility and authorization are verified, including converting the old custom `/generate` request/response format to the new engine's API without leaking secrets or raw prompts in logs.

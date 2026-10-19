# Bonds inference staging candidate

**Status: experimental; not installed; not production-approved.**

This directory is an isolated A/B harness for a pinned llama.cpp Windows CPU/Vulkan candidate. It does not modify the production runtime, ports 8765/8771, scheduled tasks, Cloudflare tunnel, Vercel configuration, or production traffic.

## Contract source

Model identity and runtime parity are read directly from ../canonical-model.json. The staging harness does not carry a second model SHA or a second max-token/context/thread configuration.

The engine candidate is pinned to llama.cpp b11669. CPU and Vulkan archive SHA256 values are pinned in manifest.json and must be verified before extraction.

## Safe execution boundary

Run only on an authorized nonproduction Windows host. The engine binds to 127.0.0.1 and defaults to port 18965. start-engine.ps1 rejects production ports 8765 and 8771. No startup task or Windows service is registered.

Example commands:

    .\install-engine.ps1 -Profile cpu
    .\install-engine.ps1 -Profile vulkan
    .\start-engine.ps1 -Profile cpu -ModelPath 'X:\models\gemma-4-E4B-it-Q4_K_M.gguf'

For Vulkan, use the same canonical model and explicitly record the effective GPU layer configuration. If omitted, the harness uses the current canonical n_gpu_layers value.

## Benchmark parity

benchmark.ps1 calls the OpenAI-compatible /v1/chat/completions endpoint and requires the payload max_tokens to match canonical-model.json. If temperature is supplied, it must also match the canonical value.

Use the same redacted prompt/messages and all other sampling parameters across CPU and Vulkan. Do not store customer data, secrets, tokens, model files, or private payloads in Git.

The benchmark records end-to-end elapsed time, token counts, HTTP status, and errors. It does not by itself prove TTFT, GPU utilization, RAM/VRAM behavior, reboot recovery, multi-user concurrency, or production latency.

## Promotion gates

Do not promote this candidate to production unless all of the following are independently verified on an authorized Windows staging host:

1. Archive provenance and SHA256 verification succeeds.
2. Canonical GGUF filename and SHA256 verification succeeds.
3. CPU/Vulkan use identical model, context, max tokens, temperature, prompt, and sampling parameters.
4. P50/P95 latency, tokens/sec, memory, VRAM, GPU offload, and failure rate are measured.
5. Current custom /generate client/server contract has an explicit compatibility adapter or migration plan.
6. Durable Windows supervision, no-login reboot recovery, least privilege, process-tree cleanup, and rollback are implemented and tested.
7. If production-equivalent P95 is not comfortably below the synchronous edge timeout, the request path must be redesigned rather than assuming an engine swap fixes it.

No production readiness is asserted by merging these staging files.

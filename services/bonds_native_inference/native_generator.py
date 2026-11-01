from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping

IDENTITY = "Bonds Native Inference"
BACKEND = "llama_cpp"


class NativeInferenceUnavailable(RuntimeError):
    pass


class NativeModelIntegrityError(RuntimeError):
    pass


class NativeRuntimeBusy(RuntimeError):
    pass


class NativeContextOverflow(RuntimeError):
    pass


class NativeClientCancelled(RuntimeError):
    """The caller disconnected, so queued or in-flight work was abandoned."""


@dataclass(frozen=True)
class NativeModel:
    path: Path
    sha256: str
    size_bytes: int


_LLM: Any | None = None
_LLM_KEY: tuple[Any, ...] | None = None
_LLM_LOCK = threading.Lock()
_MODEL_CACHE: dict[tuple[str, int, int, str], NativeModel] = {}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_model_path(root: str | Path) -> Path | None:
    configured = os.environ.get("BONDS_NATIVE_MODEL_PATH", "").strip()
    if configured:
        path = Path(configured).expanduser().resolve()
        return path if path.is_file() else None

    model_root = Path(root).resolve() / "models"
    if not model_root.is_dir():
        return None
    candidates = sorted(p for p in model_root.glob("*.gguf") if p.is_file())
    if len(candidates) > 1:
        raise NativeInferenceUnavailable(
            "multiple GGUF models found; set BONDS_NATIVE_MODEL_PATH explicitly"
        )
    return candidates[0] if candidates else None


def expected_sha256(path: Path) -> str:
    configured = os.environ.get("BONDS_NATIVE_MODEL_SHA256", "").strip().lower()
    if configured:
        return configured
    sidecar = path.with_suffix(path.suffix + ".sha256")
    if sidecar.is_file():
        return sidecar.read_text(encoding="utf-8").strip().split()[0].lower()
    return ""


def inspect_model(root: str | Path, verify: bool = False) -> NativeModel | None:
    path = resolve_model_path(root)
    if path is None:
        return None
    expected = expected_sha256(path)
    actual = _sha256(path) if verify else ""
    if verify and expected and actual.lower() != expected:
        raise NativeModelIntegrityError(
            f"GGUF SHA256 mismatch for {path.name}: expected {expected}, got {actual}"
        )
    return NativeModel(path=path, sha256=actual, size_bytes=path.stat().st_size)


def gpu_offload_supported() -> bool:
    try:
        from llama_cpp import llama_cpp
        return bool(llama_cpp.llama_supports_gpu_offload())
    except (ImportError, AttributeError, OSError):
        return False


def status(root: str | Path) -> dict[str, Any]:
    backend_available = importlib.util.find_spec("llama_cpp") is not None
    try:
        model = inspect_model(root, verify=False)
        error = None
    except Exception as exc:
        model = None
        error = f"{type(exc).__name__}: {exc}"
    return {
        "service": IDENTITY,
        "backend": BACKEND,
        "backend_available": backend_available,
        "model_available": model is not None,
        "model_path": str(model.path) if model else None,
        "gpu_offload_supported": gpu_offload_supported() if backend_available else False,
        "external_provider_dependency": False,
        "external_daemon_required": False,
        "network_required_for_generation": False,
        "available": bool(backend_available and model is not None and error is None),
        "error": error,
    }


def _verified_model(root: str | Path) -> NativeModel:
    path = resolve_model_path(root)
    if path is None:
        raise NativeInferenceUnavailable("no GGUF model is configured")
    stat = path.stat()
    expected = expected_sha256(path)
    key = (str(path), stat.st_size, stat.st_mtime_ns, expected)
    cached = _MODEL_CACHE.get(key)
    if cached is not None:
        return cached
    model = inspect_model(root, verify=True)
    if model is None:
        raise NativeInferenceUnavailable("GGUF model disappeared before load")
    _MODEL_CACHE.clear()
    _MODEL_CACHE[key] = model
    return model


def _positive_int(value: Any, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def _float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _resident_llm(model: NativeModel, n_ctx: int, n_threads: int, n_gpu_layers: int):
    global _LLM, _LLM_KEY
    key = (str(model.path), model.sha256, n_ctx, n_threads, n_gpu_layers)
    if _LLM is not None and _LLM_KEY == key:
        return _LLM, True, 0.0

    from llama_cpp import Llama

    started = time.perf_counter()
    llm = Llama(
        model_path=str(model.path),
        n_ctx=n_ctx,
        n_threads=n_threads,
        n_gpu_layers=n_gpu_layers,
        verbose=False,
    )
    load_seconds = max(0.0, time.perf_counter() - started)
    _LLM = llm
    _LLM_KEY = key
    return llm, False, load_seconds


_CANCEL_POLL_SECONDS = 0.25


def _acquire_llm_lock(timeout_seconds: float, cancel_check: Callable[[], bool] | None) -> bool:
    """Acquire the single-flight lock; stop waiting early if the caller left."""
    if cancel_check is None:
        return _LLM_LOCK.acquire(timeout=timeout_seconds)
    deadline = time.perf_counter() + timeout_seconds
    while True:
        remaining = deadline - time.perf_counter()
        if remaining <= 0:
            return False
        if _LLM_LOCK.acquire(timeout=min(remaining, _CANCEL_POLL_SECONDS)):
            return True
        if cancel_check():
            raise NativeClientCancelled("client disconnected while queued")


def _stream_completion(
    llm: Any,
    messages: list[dict[str, str]],
    max_tokens: int,
    temperature: float,
    cancel_check: Callable[[], bool],
) -> dict[str, Any]:
    """Run a streaming completion, aborting between tokens when the caller left.

    Returns the same shape as the non-streaming call. llama.cpp emits one chunk
    per token, so the chunk count is used as completion_tokens (flagged as an
    estimate); prompt/total token counts are not available in this mode.
    """
    parts: list[str] = []
    finish_reason = None
    chunks = 0
    stream = llm.create_chat_completion(
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        stream=True,
    )
    try:
        for chunk in stream:
            choice = (chunk.get("choices") or [{}])[0]
            piece = (choice.get("delta") or {}).get("content")
            if piece:
                parts.append(piece)
                chunks += 1
            if choice.get("finish_reason"):
                finish_reason = choice.get("finish_reason")
            if cancel_check():
                raise NativeClientCancelled("client disconnected during generation")
    finally:
        close = getattr(stream, "close", None)
        if callable(close):
            close()
    return {
        "choices": [
            {"message": {"content": "".join(parts)}, "finish_reason": finish_reason}
        ],
        "usage": {
            "prompt_tokens": None,
            "completion_tokens": chunks,
            "total_tokens": None,
            "completion_tokens_estimated": True,
        },
    }


def generate(
    root: str | Path,
    prompt: str,
    *,
    context: Mapping[str, Any] | None = None,
    options: Mapping[str, Any] | None = None,
    cancel_check: Callable[[], bool] | None = None,
) -> dict[str, Any]:
    request_started = time.perf_counter()
    if importlib.util.find_spec("llama_cpp") is None:
        raise NativeInferenceUnavailable("llama-cpp-python is not installed")

    opts = dict(options or {})
    n_ctx = _positive_int(opts.get("n_ctx") or os.environ.get("BONDS_NATIVE_N_CTX"), 4096)
    n_threads = _positive_int(
        opts.get("n_threads") or os.environ.get("BONDS_NATIVE_N_THREADS"),
        max(1, os.cpu_count() or 1),
    )
    max_tokens = _positive_int(
        opts.get("max_tokens") or os.environ.get("BONDS_NATIVE_MAX_TOKENS"), 512
    )
    gpu_supported = gpu_offload_supported()
    raw_layers = opts.get("n_gpu_layers")
    if raw_layers is None:
        raw_layers = os.environ.get("BONDS_NATIVE_N_GPU_LAYERS")
    try:
        n_gpu_layers = int(raw_layers) if raw_layers not in (None, "") else (-1 if gpu_supported else 0)
    except (TypeError, ValueError):
        n_gpu_layers = -1 if gpu_supported else 0
    if not gpu_supported:
        n_gpu_layers = 0

    temperature = max(0.0, _float(opts.get("temperature"), 0.2))
    system = str(opts.get("system") or (
        "You are Bonds Intelligence, a precise investment and decision-support assistant. "
        "Separate facts from inference and recommendations. Never invent missing evidence. "
        "Answer in the user's language."
    )).strip()
    context_text = json.dumps(dict(context or {}), ensure_ascii=False, separators=(",", ":"))
    messages = [{"role": "system", "content": system}]
    user_text = str(prompt).strip()
    if context_text and context_text != "{}":
        user_text = f"Context:\n{context_text}\n\n{user_text}"
    messages.append({"role": "user", "content": user_text})

    lock_timeout_seconds = _float(opts.get("lock_timeout_seconds"), 0.0) or _float(
        os.environ.get("BONDS_NATIVE_LOCK_TIMEOUT_SECONDS"), 30.0
    )
    lock_timeout_seconds = max(1.0, min(120.0, lock_timeout_seconds))

    lock_wait_started = time.perf_counter()
    acquired = _acquire_llm_lock(lock_timeout_seconds, cancel_check)
    lock_wait_seconds = max(0.0, time.perf_counter() - lock_wait_started)
    if not acquired:
        raise NativeRuntimeBusy(
            f"model busy beyond the {lock_timeout_seconds:.1f}s lock deadline"
        )
    try:
        if cancel_check is not None and cancel_check():
            raise NativeClientCancelled("client disconnected before generation started")
        model = _verified_model(root)
        llm, cache_hit, load_seconds = _resident_llm(
            model, n_ctx=n_ctx, n_threads=n_threads, n_gpu_layers=n_gpu_layers
        )

        generation_started = time.perf_counter()
        try:
            if cancel_check is None:
                response = llm.create_chat_completion(
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature,
                )
            else:
                response = _stream_completion(
                    llm, messages, max_tokens, temperature, cancel_check
                )
        except ValueError as exc:
            raise NativeContextOverflow(str(exc)) from exc
        generation_seconds = max(0.0, time.perf_counter() - generation_started)
    finally:
        _LLM_LOCK.release()

    choices = response.get("choices") or []
    first = choices[0] if choices else {}
    message = first.get("message") or {}
    text = str(message.get("content") or "").strip()
    if not text:
        raise RuntimeError("native generator returned empty text")

    usage = dict(response.get("usage") or {})
    completion_tokens = usage.get("completion_tokens")
    tokens_per_second = (
        float(completion_tokens) / generation_seconds
        if completion_tokens is not None and generation_seconds > 0
        else None
    )
    request_total_seconds = max(0.0, time.perf_counter() - request_started)
    return {
        "text": text,
        "backend": BACKEND,
        "generator_identity": IDENTITY,
        "model_path": str(model.path),
        "model_sha256": model.sha256,
        "model_size_bytes": model.size_bytes,
        "n_ctx": n_ctx,
        "n_threads": n_threads,
        "n_gpu_layers": n_gpu_layers,
        "gpu_offload_supported": gpu_supported,
        "temperature": temperature,
        "finish_reason": first.get("finish_reason"),
        "usage": usage,
        "completion_tokens": completion_tokens,
        "generation_seconds": generation_seconds,
        "lock_wait_seconds": lock_wait_seconds,
        "lock_timeout_seconds": lock_timeout_seconds,
        "request_total_seconds": request_total_seconds,
        "tokens_per_second": tokens_per_second,
        "model_resident": True,
        "model_cache_hit": cache_hit,
        "model_load_seconds": load_seconds,
        "external_provider_dependency": False,
    }

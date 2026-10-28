from __future__ import annotations

import sys
import threading
import time
import types
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest import mock

from services.bonds_native_inference import native_generator as ng


class _Tracker:
    def __init__(self):
        self.lock = threading.Lock()
        self.constructor_active = 0
        self.constructor_max = 0
        self.constructor_calls = 0
        self.generate_active = 0
        self.generate_max = 0
        self.generate_calls = 0

    def enter_constructor(self):
        with self.lock:
            self.constructor_active += 1
            self.constructor_calls += 1
            self.constructor_max = max(self.constructor_max, self.constructor_active)

    def exit_constructor(self):
        with self.lock:
            self.constructor_active -= 1

    def enter_generate(self):
        with self.lock:
            self.generate_active += 1
            self.generate_calls += 1
            self.generate_max = max(self.generate_max, self.generate_active)

    def exit_generate(self):
        with self.lock:
            self.generate_active -= 1


def _fake_llama_module(tracker: _Tracker):
    module = types.ModuleType("llama_cpp")

    class FakeLlama:
        def __init__(self, **kwargs):
            tracker.enter_constructor()
            try:
                time.sleep(0.02)
                self.kwargs = kwargs
            finally:
                tracker.exit_constructor()

        def create_chat_completion(self, **kwargs):
            tracker.enter_generate()
            try:
                time.sleep(0.03)
                return {
                    "choices": [
                        {
                            "message": {"content": "ok"},
                            "finish_reason": "stop",
                        }
                    ],
                    "usage": {
                        "prompt_tokens": 3,
                        "completion_tokens": 4,
                        "total_tokens": 7,
                    },
                }
            finally:
                tracker.exit_generate()

    module.Llama = FakeLlama
    return module


class NativeGeneratorConcurrencyTests(unittest.TestCase):
    def setUp(self):
        ng._LLM = None
        ng._LLM_KEY = None
        ng._MODEL_CACHE.clear()
        self.model = ng.NativeModel(
            path=Path("/tmp/bonds-test.gguf"),
            sha256="abc123",
            size_bytes=123,
        )

    def tearDown(self):
        ng._LLM = None
        ng._LLM_KEY = None
        ng._MODEL_CACHE.clear()

    def test_same_resident_llm_is_single_flight_and_telemetry_is_preserved(self):
        tracker = _Tracker()
        fake_module = _fake_llama_module(tracker)
        start = threading.Barrier(5)

        def task():
            start.wait()
            return ng.generate(
                "/tmp",
                "hello",
                options={"n_threads": 1, "max_tokens": 8},
            )

        with (
            mock.patch.object(ng.importlib.util, "find_spec", return_value=object()),
            mock.patch.object(ng, "gpu_offload_supported", return_value=False),
            mock.patch.object(ng, "_verified_model", return_value=self.model),
            mock.patch.dict(sys.modules, {"llama_cpp": fake_module}),
        ):
            with ThreadPoolExecutor(max_workers=5) as pool:
                results = list(pool.map(lambda _: task(), range(5)))

        self.assertEqual(tracker.constructor_calls, 1)
        self.assertEqual(tracker.constructor_max, 1)
        self.assertEqual(tracker.generate_calls, 5)
        self.assertEqual(tracker.generate_max, 1)

        load_times = [result["model_load_seconds"] for result in results]
        self.assertEqual(sum(value > 0 for value in load_times), 1)
        self.assertEqual(sum(value == 0 for value in load_times), 4)
        self.assertGreaterEqual(sum(result["lock_wait_seconds"] > 0.01 for result in results), 4)

        for result in results:
            self.assertEqual(result["completion_tokens"], 4)
            self.assertEqual(result["usage"]["completion_tokens"], 4)
            self.assertGreater(result["generation_seconds"], 0)
            self.assertGreaterEqual(
                result["request_total_seconds"],
                result["lock_wait_seconds"] + result["generation_seconds"],
            )
            self.assertAlmostEqual(
                result["tokens_per_second"],
                4.0 / result["generation_seconds"],
                places=7,
            )
            self.assertTrue(result["model_resident"])
            self.assertIn("model_cache_hit", result)

    def test_lazy_model_verification_is_serialized_by_same_lock(self):
        tracker = _Tracker()
        fake_module = _fake_llama_module(tracker)
        verify_lock = threading.Lock()
        verify_active = 0
        verify_max = 0
        barrier = threading.Barrier(3)

        def verified_model(root):
            nonlocal verify_active, verify_max
            with verify_lock:
                verify_active += 1
                verify_max = max(verify_max, verify_active)
            try:
                time.sleep(0.02)
                return self.model
            finally:
                with verify_lock:
                    verify_active -= 1

        def task():
            barrier.wait()
            return ng.generate(
                "/tmp",
                "hello",
                options={"n_threads": 1, "max_tokens": 8},
            )

        with (
            mock.patch.object(ng.importlib.util, "find_spec", return_value=object()),
            mock.patch.object(ng, "gpu_offload_supported", return_value=False),
            mock.patch.object(ng, "_verified_model", side_effect=verified_model),
            mock.patch.dict(sys.modules, {"llama_cpp": fake_module}),
        ):
            with ThreadPoolExecutor(max_workers=3) as pool:
                list(pool.map(lambda _: task(), range(3)))

        self.assertEqual(verify_max, 1)
        self.assertEqual(tracker.constructor_calls, 1)
        self.assertEqual(tracker.generate_max, 1)

    def test_replacement_is_serialized_when_llm_key_changes(self):
        tracker = _Tracker()
        fake_module = _fake_llama_module(tracker)
        barrier = threading.Barrier(2)

        def task(n_ctx):
            barrier.wait()
            return ng.generate(
                "/tmp",
                "hello",
                options={"n_threads": 1, "max_tokens": 8, "n_ctx": n_ctx},
            )

        with (
            mock.patch.object(ng.importlib.util, "find_spec", return_value=object()),
            mock.patch.object(ng, "gpu_offload_supported", return_value=False),
            mock.patch.object(ng, "_verified_model", return_value=self.model),
            mock.patch.dict(sys.modules, {"llama_cpp": fake_module}),
        ):
            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(task, (1024, 2048)))

        self.assertEqual(tracker.constructor_calls, 2)
        self.assertEqual(tracker.constructor_max, 1)
        self.assertEqual(tracker.generate_max, 1)
        self.assertEqual({result["n_ctx"] for result in results}, {1024, 2048})
        self.assertEqual(sum(result["model_load_seconds"] > 0 for result in results), 2)

    def test_generate_fails_fast_with_busy_when_lock_deadline_expires(self):
        tracker = _Tracker()
        fake_module = _fake_llama_module(tracker)
        ng._LLM_LOCK.acquire()
        try:
            with (
                mock.patch.object(ng.importlib.util, "find_spec", return_value=object()),
                mock.patch.object(ng, "gpu_offload_supported", return_value=False),
                mock.patch.object(ng, "_verified_model", return_value=self.model),
                mock.patch.dict(sys.modules, {"llama_cpp": fake_module}),
            ):
                with self.assertRaises(ng.NativeRuntimeBusy):
                    ng.generate(
                        "/tmp",
                        "hello",
                        options={
                            "n_threads": 1,
                            "max_tokens": 8,
                            "lock_timeout_seconds": 0.2,
                        },
                    )
        finally:
            ng._LLM_LOCK.release()
        self.assertEqual(tracker.generate_calls, 0)

    def test_generate_maps_context_overflow_value_error(self):
        tracker = _Tracker()
        fake_module = _fake_llama_module(tracker)

        class OverflowLlama(fake_module.Llama):
            def create_chat_completion(self, **kwargs):
                tracker.enter_generate()
                try:
                    raise ValueError("Requested tokens exceed context window")
                finally:
                    tracker.exit_generate()

        fake_module.Llama = OverflowLlama

        with (
            mock.patch.object(ng.importlib.util, "find_spec", return_value=object()),
            mock.patch.object(ng, "gpu_offload_supported", return_value=False),
            mock.patch.object(ng, "_verified_model", return_value=self.model),
            mock.patch.dict(sys.modules, {"llama_cpp": fake_module}),
        ):
            with self.assertRaises(ng.NativeContextOverflow):
                ng.generate(
                    "/tmp",
                    "hello",
                    options={"n_threads": 1, "max_tokens": 8},
                )

        self.assertEqual(tracker.generate_calls, 1)


if __name__ == "__main__":
    unittest.main()

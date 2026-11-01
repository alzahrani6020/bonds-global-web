from __future__ import annotations

import sys
import threading
import time
import types
import unittest
from pathlib import Path
from unittest import mock

from services.bonds_native_inference import native_generator as ng


def _fake_llama_module(chunks_per_second_delay: float = 0.0, total_chunks: int = 6):
    module = types.ModuleType("llama_cpp")
    state = {"closed": False, "emitted": 0, "stream_calls": 0, "plain_calls": 0}

    class FakeLlama:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        def create_chat_completion(self, **kwargs):
            if not kwargs.get("stream"):
                state["plain_calls"] += 1
                return {
                    "choices": [
                        {"message": {"content": "plain"}, "finish_reason": "stop"}
                    ],
                    "usage": {"prompt_tokens": 3, "completion_tokens": 1, "total_tokens": 4},
                }
            state["stream_calls"] += 1

            def gen():
                try:
                    for index in range(total_chunks):
                        time.sleep(chunks_per_second_delay)
                        state["emitted"] += 1
                        last = index == total_chunks - 1
                        yield {
                            "choices": [
                                {
                                    "delta": {"content": f"t{index} "},
                                    "finish_reason": "stop" if last else None,
                                }
                            ]
                        }
                finally:
                    state["closed"] = True

            return gen()

    module.Llama = FakeLlama
    return module, state


class NativeCancelTests(unittest.TestCase):
    def setUp(self):
        ng._LLM = None
        ng._LLM_KEY = None
        ng._MODEL_CACHE.clear()
        self.model = ng.NativeModel(
            path=Path("/tmp/bonds-test.gguf"), sha256="abc123", size_bytes=123
        )

    def tearDown(self):
        ng._LLM = None
        ng._LLM_KEY = None
        ng._MODEL_CACHE.clear()

    def _patches(self, fake_module):
        return (
            mock.patch.object(ng.importlib.util, "find_spec", return_value=object()),
            mock.patch.object(ng, "gpu_offload_supported", return_value=False),
            mock.patch.object(ng, "_verified_model", return_value=self.model),
            mock.patch.dict(sys.modules, {"llama_cpp": fake_module}),
        )

    def _run(self, fake_module, **kwargs):
        p1, p2, p3, p4 = self._patches(fake_module)
        with p1, p2, p3, p4:
            return ng.generate("/tmp", "hello", options={"n_threads": 1, "max_tokens": 8}, **kwargs)

    def test_without_cancel_check_behaviour_is_unchanged(self):
        fake, state = _fake_llama_module()
        result = self._run(fake)
        self.assertEqual(result["text"], "plain")
        self.assertEqual(result["usage"]["prompt_tokens"], 3)
        self.assertEqual(state["plain_calls"], 1)
        self.assertEqual(state["stream_calls"], 0)

    def test_with_cancel_check_streams_and_keeps_the_result_shape(self):
        fake, state = _fake_llama_module(total_chunks=4)
        result = self._run(fake, cancel_check=lambda: False)
        self.assertEqual(result["text"], "t0 t1 t2 t3")
        self.assertEqual(result["finish_reason"], "stop")
        self.assertEqual(result["completion_tokens"], 4)
        self.assertTrue(result["usage"]["completion_tokens_estimated"])
        self.assertGreater(result["tokens_per_second"], 0)
        self.assertEqual(state["stream_calls"], 1)
        self.assertTrue(state["closed"])

    def test_cancel_mid_generation_stops_early_and_releases_the_lock(self):
        fake, state = _fake_llama_module(chunks_per_second_delay=0.01, total_chunks=200)
        seen = {"n": 0}

        def cancel_after_three():
            seen["n"] += 1
            return seen["n"] > 4  # one pre-generation check + three tokens

        with self.assertRaises(ng.NativeClientCancelled):
            self._run(fake, cancel_check=cancel_after_three)

        self.assertLess(state["emitted"], 10)
        self.assertTrue(state["closed"])
        # The single-flight lock must be free for the next request.
        self.assertTrue(ng._LLM_LOCK.acquire(timeout=0.5))
        ng._LLM_LOCK.release()

    def test_already_disconnected_caller_never_starts_generation(self):
        fake, state = _fake_llama_module()
        with self.assertRaises(ng.NativeClientCancelled):
            self._run(fake, cancel_check=lambda: True)
        self.assertEqual(state["stream_calls"], 0)
        self.assertEqual(state["plain_calls"], 0)
        self.assertTrue(ng._LLM_LOCK.acquire(timeout=0.5))
        ng._LLM_LOCK.release()

    def test_queued_caller_gives_up_without_taking_its_turn(self):
        fake, state = _fake_llama_module()
        gone = threading.Event()
        ng._LLM_LOCK.acquire()  # simulate a long generation holding the model
        try:
            threading.Timer(0.1, gone.set).start()
            started = time.perf_counter()
            with self.assertRaises(ng.NativeClientCancelled):
                self._run(fake, cancel_check=gone.is_set)
            waited = time.perf_counter() - started
        finally:
            ng._LLM_LOCK.release()
        self.assertLess(waited, 2.0)  # far below the 30s lock deadline
        self.assertEqual(state["stream_calls"], 0)

    def test_queued_caller_still_times_out_as_busy_when_it_stays_connected(self):
        fake, _ = _fake_llama_module()
        ng._LLM_LOCK.acquire()
        try:
            p1, p2, p3, p4 = self._patches(fake)
            with p1, p2, p3, p4:
                with self.assertRaises(ng.NativeRuntimeBusy):
                    ng.generate(
                        "/tmp",
                        "hello",
                        options={"lock_timeout_seconds": 1},
                        cancel_check=lambda: False,
                    )
        finally:
            ng._LLM_LOCK.release()


if __name__ == "__main__":
    unittest.main()

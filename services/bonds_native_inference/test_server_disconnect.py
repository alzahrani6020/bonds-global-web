from __future__ import annotations

import http.client
import importlib
import json
import os
import socket
import sys
import threading
import time
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest import mock

SERVICE_DIR = Path(__file__).resolve().parent


def _load_server(cancel_on_disconnect: bool):
    # server.py imports native_generator as a top-level module.
    if str(SERVICE_DIR) not in sys.path:
        sys.path.insert(0, str(SERVICE_DIR))
    env = {
        "BONDS_NATIVE_HOST": "127.0.0.1",
        "BONDS_NATIVE_TOKEN": "",
        "BONDS_NATIVE_CANCEL_ON_DISCONNECT": "1" if cancel_on_disconnect else "0",
    }
    with mock.patch.dict(os.environ, env):
        sys.modules.pop("server", None)
        return importlib.import_module("server")


class _Harness:
    def __init__(self, server_module, fake_generate):
        self.server_module = server_module
        self.calls = []
        self.finished = threading.Event()

        def wrapped(root, prompt, **kwargs):
            self.calls.append(kwargs)
            try:
                return fake_generate(root, prompt, **kwargs)
            finally:
                self.finished.set()

        self.patch = mock.patch.object(server_module, "generate", wrapped)
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server_module.Handler)
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    def __enter__(self):
        self.patch.start()
        self.thread.start()
        return self

    def __exit__(self, *exc):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.patch.stop()


def _slow_cancellable_generate(root, prompt, *, cancel_check=None, **_):
    """Stand-in for generate(): ~5s of work that polls cancel_check like the real one."""
    deadline = time.perf_counter() + 5.0
    while time.perf_counter() < deadline:
        if cancel_check is not None and cancel_check():
            raise sys.modules["native_generator"].NativeClientCancelled("client gone")
        time.sleep(0.02)
    return {"text": "done"}


def _post_and_hold(port, body):
    sock = socket.create_connection(("127.0.0.1", port))
    payload = json.dumps(body).encode()
    sock.sendall(
        b"POST /generate HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\n"
        + f"Content-Length: {len(payload)}\r\n\r\n".encode()
        + payload
    )
    return sock


class ServerDisconnectTests(unittest.TestCase):
    def test_disconnect_cancels_generation_when_enabled(self):
        server = _load_server(cancel_on_disconnect=True)
        with _Harness(server, _slow_cancellable_generate) as h:
            sock = _post_and_hold(h.port, {"prompt": "hi"})
            time.sleep(0.3)  # generation is running
            started = time.perf_counter()
            sock.close()
            self.assertTrue(h.finished.wait(3.0), "generation kept running after disconnect")
            self.assertLess(time.perf_counter() - started, 2.0)
            self.assertTrue(callable(h.calls[0]["cancel_check"]))

    def test_connected_client_is_not_cancelled_and_gets_its_answer(self):
        server = _load_server(cancel_on_disconnect=True)

        def quick(root, prompt, *, cancel_check=None, **_):
            for _ in range(10):
                if cancel_check():
                    raise AssertionError("connected client was reported as disconnected")
                time.sleep(0.02)
            return {"text": "answer"}

        with _Harness(server, quick) as h:
            conn = http.client.HTTPConnection("127.0.0.1", h.port, timeout=5)
            conn.request(
                "POST",
                "/generate",
                body=json.dumps({"prompt": "hi"}),
                headers={"content-type": "application/json"},
            )
            response = conn.getresponse()
            data = json.loads(response.read())
            conn.close()
        self.assertEqual(response.status, 200)
        self.assertEqual(data["result"]["text"], "answer")

    def test_half_close_is_treated_as_disconnect_which_is_why_the_flag_is_opt_in(self):
        # Some proxies shutdown(SHUT_WR) after sending the request but still read
        # the reply. Detection is EOF-based, so such a client looks gone: a known limit.
        # This test pins that behaviour so enabling the flag stays a conscious choice.
        server = _load_server(cancel_on_disconnect=True)
        with _Harness(server, _slow_cancellable_generate) as h:
            sock = _post_and_hold(h.port, {"prompt": "hi"})
            sock.shutdown(socket.SHUT_WR)
            self.assertTrue(
                h.finished.wait(3.0),
                "half-close is expected to look like a disconnect (flag stays opt-in)",
            )
            sock.close()

    def test_default_is_off_and_passes_no_cancel_check(self):
        server = _load_server(cancel_on_disconnect=False)

        def quick(root, prompt, **kwargs):
            return {"text": "ok"}

        with _Harness(server, quick) as h:
            conn = http.client.HTTPConnection("127.0.0.1", h.port, timeout=5)
            conn.request("POST", "/generate", body=json.dumps({"prompt": "hi"}))
            self.assertEqual(conn.getresponse().status, 200)
            conn.close()
        self.assertIsNone(h.calls[0]["cancel_check"])


if __name__ == "__main__":
    unittest.main()

"""Process-exit tests with Win32 API stubs; these do not exercise Windows SCM."""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SERVICE_SCRIPT = Path(__file__).resolve().parents[1] / "windows" / "token_service.py"


class WindowsServiceEntrypointTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        stub_root = Path(self.tempdir.name)
        for module in ("servicemanager", "win32event", "win32service"):
            (stub_root / (module + ".py")).write_text("# Isolated OS API stub.\n", encoding="utf-8")
        (stub_root / "win32serviceutil.py").write_text(
            "import os, sys\n"
            "class ServiceFramework:\n"
            "    pass\n"
            "def HandleCommandLine(service_class):\n"
            "    assert service_class._svc_name_ == 'BondsTokenRuntimeService'\n"
            "    assert sys.argv[-1] == os.environ['BONDS_TEST_SERVICE_COMMAND']\n"
            "    result = os.environ['BONDS_TEST_SERVICE_EXIT']\n"
            "    return None if result == 'none' else int(result)\n",
            encoding="utf-8",
        )
        self.environment = {
            name: value for name, value in os.environ.items()
            if not name.startswith("BONDS_TOKEN_")
        }
        self.environment.update({
            "PYTHONPATH": str(stub_root),
            "PYTHONDONTWRITEBYTECODE": "1",
        })

    def command_result(self, command, handler_result):
        environment = dict(self.environment, BONDS_TEST_SERVICE_COMMAND=command, BONDS_TEST_SERVICE_EXIT=str(handler_result))
        result = subprocess.run(
            [sys.executable, "-B", str(SERVICE_SCRIPT), command],
            env=environment,
            capture_output=True,
            timeout=5,
        )
        self.assertEqual(result.stderr, b"")
        return result.returncode

    def test_install_and_remove_failures_reach_the_process_exit_code(self):
        for command, error_code in (("install", 5), ("remove", 32)):
            with self.subTest(command=command):
                self.assertEqual(self.command_result(command, error_code), error_code)

    def test_successful_command_returns_zero(self):
        for command in ("install", "remove"):
            for handler_result in (0, "none"):
                with self.subTest(command=command, result=handler_result):
                    self.assertEqual(self.command_result(command, handler_result), 0)


if __name__ == "__main__":
    unittest.main()

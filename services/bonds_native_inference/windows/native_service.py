from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

import servicemanager
import win32event
import win32service
import win32serviceutil


SERVICE_NAME = "BondsNativeRuntimeService"
SERVICE_DISPLAY_NAME = "Bonds Native Runtime"
SERVICE_DESCRIPTION = "Boot-level supervisor for the Bonds Native inference runtime."


def _machine_value(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


class BondsNativeRuntimeService(win32serviceutil.ServiceFramework):
    _svc_name_ = SERVICE_NAME
    _svc_display_name_ = SERVICE_DISPLAY_NAME
    _svc_description_ = SERVICE_DESCRIPTION

    def __init__(self, args):
        super().__init__(args)
        self.stop_event = win32event.CreateEvent(None, 0, 0, None)
        self.child: subprocess.Popen | None = None
        self._stdout = None
        self._stderr = None

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.stop_event)
        self._terminate_child()

    def _terminate_child(self) -> None:
        child = self.child
        if child is None or child.poll() is not None:
            return
        try:
            child.terminate()
            child.wait(timeout=15)
        except Exception:
            try:
                child.kill()
                child.wait(timeout=5)
            except Exception:
                pass

    def _close_logs(self) -> None:
        for handle in (self._stdout, self._stderr):
            try:
                if handle:
                    handle.close()
            except Exception:
                pass
        self._stdout = None
        self._stderr = None

    def SvcDoRun(self):
        servicemanager.LogInfoMsg(f"{SERVICE_NAME} starting")
        exit_code = self._run_child()
        if exit_code not in (0, None):
            servicemanager.LogErrorMsg(
                f"{SERVICE_NAME} child exited unexpectedly with code {exit_code}"
            )
            raise RuntimeError(f"Bonds Native runtime exited with code {exit_code}")
        servicemanager.LogInfoMsg(f"{SERVICE_NAME} stopped")

    def _run_child(self) -> int | None:
        runtime_root = Path(_machine_value("BONDS_NATIVE_RUNTIME_ROOT"))
        python_exe = Path(_machine_value("BONDS_PYTHON_EXE", sys.executable))
        state_dir = Path(
            _machine_value(
                "BONDS_NATIVE_STATE_DIR",
                str(Path(os.environ.get("ProgramData", r"C:\ProgramData")) / "BondsNative"),
            )
        )

        if not runtime_root.is_dir():
            raise RuntimeError(f"BONDS_NATIVE_RUNTIME_ROOT is invalid: {runtime_root}")
        if not python_exe.is_file():
            raise RuntimeError(f"BONDS_PYTHON_EXE is invalid: {python_exe}")

        service_dir = runtime_root
        server_path = runtime_root / "server.py"
        if not server_path.is_file():
            raise RuntimeError(f"Native server not found: {server_path}")

        required = (
            "BONDS_NATIVE_TOKEN",
            "BONDS_NATIVE_MODEL_PATH",
            "BONDS_NATIVE_MODEL_SHA256",
        )
        missing = [name for name in required if not _machine_value(name)]
        if missing:
            raise RuntimeError(f"Missing machine configuration: {', '.join(missing)}")

        model_path = Path(_machine_value("BONDS_NATIVE_MODEL_PATH"))
        if not model_path.is_file():
            raise RuntimeError(f"Canonical GGUF not found: {model_path}")

        state_dir.mkdir(parents=True, exist_ok=True)
        stdout_path = state_dir / "native-service.stdout.log"
        stderr_path = state_dir / "native-service.stderr.log"
        self._stdout = stdout_path.open("ab", buffering=0)
        self._stderr = stderr_path.open("ab", buffering=0)

        env = os.environ.copy()
        self.child = subprocess.Popen(
            [str(python_exe), str(server_path)],
            cwd=str(service_dir),
            env=env,
            stdout=self._stdout,
            stderr=self._stderr,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )

        try:
            while True:
                wait_result = win32event.WaitForSingleObject(self.stop_event, 1000)
                if wait_result == win32event.WAIT_OBJECT_0:
                    self._terminate_child()
                    return 0

                exit_code = self.child.poll()
                if exit_code is not None:
                    return exit_code

                time.sleep(0.05)
        finally:
            self._terminate_child()
            self._close_logs()


if __name__ == "__main__":
    win32serviceutil.HandleCommandLine(BondsNativeRuntimeService)

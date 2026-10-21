from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import servicemanager
import win32event
import win32service
import win32serviceutil

SERVICE_NAME = "BondsTokenRuntimeService"
SERVICE_DISPLAY_NAME = "Bonds Token Runtime"
SERVICE_DESCRIPTION = "Boot-level supervisor for the Bonds service-token issuer on localhost:8771."


def _value(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


class BondsTokenRuntimeService(win32serviceutil.ServiceFramework):
    _svc_name_ = SERVICE_NAME
    _svc_display_name_ = SERVICE_DISPLAY_NAME
    _svc_description_ = SERVICE_DESCRIPTION

    def __init__(self, args):
        super().__init__(args)
        self.stop_event = win32event.CreateEvent(None, 0, 0, None)
        self.child: subprocess.Popen | None = None
        self.stdout = None
        self.stderr = None

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.stop_event)
        self._terminate()

    def _terminate(self):
        if self.child is None or self.child.poll() is not None:
            return
        try:
            self.child.terminate()
            self.child.wait(timeout=15)
        except Exception:
            try:
                self.child.kill()
                self.child.wait(timeout=5)
            except Exception:
                pass

    def _close_logs(self):
        for handle in (self.stdout, self.stderr):
            try:
                if handle:
                    handle.close()
            except Exception:
                pass
        self.stdout = None
        self.stderr = None

    def SvcDoRun(self):
        servicemanager.LogInfoMsg(f"{SERVICE_NAME} starting")
        exit_code = self._run_child()
        if exit_code not in (0, None):
            servicemanager.LogErrorMsg(f"{SERVICE_NAME} child exited unexpectedly with code {exit_code}")
            raise RuntimeError(f"Bonds Token Runtime exited with code {exit_code}")
        servicemanager.LogInfoMsg(f"{SERVICE_NAME} stopped")

    def _run_child(self) -> int | None:
        runtime_root = Path(_value("BONDS_TOKEN_RUNTIME_ROOT"))
        python_exe = Path(_value("BONDS_TOKEN_PYTHON_EXE", sys.executable))
        state_dir = Path(_value("BONDS_TOKEN_STATE_DIR", str(Path(os.environ.get("ProgramData", r"C:\ProgramData")) / "BondsTokenRuntime")))

        required = (
            "BONDS_TOKEN_DB",
            "BONDS_TOKEN_ADMIN_SECRET_FILE",
            "BONDS_TOKEN_CHANNEL_SECRET_FILE",
            "BONDS_TOKEN_BUILD_COMMIT",
            "BONDS_TOKEN_RUNTIME_ROOT",
        )
        missing = [name for name in required if not _value(name)]
        if missing:
            raise RuntimeError(f"Missing token runtime configuration: {', '.join(missing)}")

        if not runtime_root.is_dir():
            raise RuntimeError(f"Invalid BONDS_TOKEN_RUNTIME_ROOT: {runtime_root}")
        if not python_exe.is_file():
            raise RuntimeError(f"Invalid BONDS_TOKEN_PYTHON_EXE: {python_exe}")

        for name in ("BONDS_TOKEN_ADMIN_SECRET_FILE", "BONDS_TOKEN_CHANNEL_SECRET_FILE"):
            if not Path(_value(name)).is_file():
                raise RuntimeError(f"Missing token runtime secret file: {name}")

        # The same validator used by direct startup runs before DB/log creation.
        checked = subprocess.run(
            [str(python_exe), "-m", "bonds_security.server", "--check-config"],
            cwd=str(runtime_root),
            env=os.environ.copy(),
            capture_output=True,
            timeout=15,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        if checked.returncode != 0:
            raise RuntimeError("Invalid token runtime configuration; startup refused")

        db_path = Path(_value("BONDS_TOKEN_DB"))
        db_path.parent.mkdir(parents=True, exist_ok=True)
        state_dir.mkdir(parents=True, exist_ok=True)

        self.stdout = (state_dir / "token-service.stdout.log").open("ab", buffering=0)
        self.stderr = (state_dir / "token-service.stderr.log").open("ab", buffering=0)

        env = os.environ.copy()
        self.child = subprocess.Popen(
            [str(python_exe), "-m", "bonds_security.server"],
            cwd=str(runtime_root),
            env=env,
            stdout=self.stdout,
            stderr=self.stderr,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )

        try:
            while True:
                wait_result = win32event.WaitForSingleObject(self.stop_event, 1000)
                if wait_result == win32event.WAIT_OBJECT_0:
                    self._terminate()
                    return 0
                exit_code = self.child.poll()
                if exit_code is not None:
                    return exit_code
        finally:
            self._terminate()
            self._close_logs()


if __name__ == "__main__":
    sys.exit(win32serviceutil.HandleCommandLine(BondsTokenRuntimeService))

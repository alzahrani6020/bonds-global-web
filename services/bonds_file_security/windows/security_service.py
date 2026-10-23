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

SERVICE_NAME = "BondsFileSecurityService"
SERVICE_DISPLAY_NAME = "BONDS File Security"
SERVICE_DESCRIPTION = "Fail-closed malware and file security scanner for BONDS uploads."

class BondsFileSecurityService(win32serviceutil.ServiceFramework):
    _svc_name_ = SERVICE_NAME
    _svc_display_name_ = SERVICE_DISPLAY_NAME
    _svc_description_ = SERVICE_DESCRIPTION

    def __init__(self, args):
        super().__init__(args)
        self.stop_event = win32event.CreateEvent(None, 0, 0, None)
        self.child = None

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.stop_event)
        if self.child and self.child.poll() is None:
            self.child.terminate()

    def SvcDoRun(self):
        root = Path(os.environ["BONDS_FILE_SECURITY_RUNTIME_ROOT"])
        python_exe = Path(os.environ.get("BONDS_PYTHON_EXE", sys.executable))
        server = root / "server.py"
        state = Path(os.environ.get("BONDS_FILE_SECURITY_STATE_DIR", str(Path(os.environ["ProgramData"]) / "BondsFileSecurity")))
        state.mkdir(parents=True, exist_ok=True)
        out = (state / "service.stdout.log").open("ab", buffering=0)
        err = (state / "service.stderr.log").open("ab", buffering=0)
        self.child = subprocess.Popen(
            [str(python_exe), str(server)],
            cwd=str(root),
            env=os.environ.copy(),
            stdout=out,
            stderr=err,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        try:
            while True:
                if win32event.WaitForSingleObject(self.stop_event, 1000) == win32event.WAIT_OBJECT_0:
                    if self.child.poll() is None:
                        self.child.terminate()
                        self.child.wait(timeout=15)
                    return
                if self.child.poll() is not None:
                    raise RuntimeError(f"security scanner exited with code {self.child.returncode}")
                time.sleep(0.05)
        finally:
            out.close()
            err.close()

if __name__ == "__main__":
    win32serviceutil.HandleCommandLine(BondsFileSecurityService)

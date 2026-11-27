import importlib.util
import unittest
from pathlib import Path
from datetime import datetime, timezone, timedelta

spec=importlib.util.spec_from_file_location('monitor',Path(__file__).with_name('check_github_backup_schedule.py'))
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
NOW=datetime(2026,11,28,3,0,tzinfo=timezone.utc)

def run(kind, event='schedule', conclusion='success', at=None, status='completed'):
    return {'id':100 if kind=='backup' else 200,'event':event,'head_branch':'main','status':status,
            'conclusion':conclusion,'created_at':(at or NOW-timedelta(minutes=20)).isoformat(),
            'updated_at':(at or NOW-timedelta(minutes=20)).isoformat()}
def artifact():
    return {'name':'bonds-production-encrypted-backup-100','size_in_bytes':4096,'expired':False,
            'expires_at':(NOW+timedelta(days=20)).isoformat()}
class MonitorTests(unittest.TestCase):
    def test_manual_never_satisfies_schedule(self):
        self.assertEqual(mod.evaluate_run([run('backup',event='workflow_dispatch')],NOW,mod.BACKUP_FIRST_GRACE,mod.BACKUP_MAX_AGE,'backup')['status'],'FAIL')
    def test_missing_before_first_backup_grace_pending(self):
        self.assertEqual(mod.evaluate_run([],datetime(2026,11,27,8,tzinfo=timezone.utc),mod.BACKUP_FIRST_GRACE,mod.BACKUP_MAX_AGE,'backup')['status'],'PENDING')
    def test_schedule_success(self):
        self.assertEqual(mod.evaluate_run([run('backup')],NOW,mod.BACKUP_FIRST_GRACE,mod.BACKUP_MAX_AGE,'backup')['status'],'PASS')
    def test_watchdog_missing(self):
        self.assertEqual(mod.evaluate_run([],NOW,mod.WATCHDOG_FIRST_GRACE,mod.WATCHDOG_MAX_AGE,'watchdog')['status'],'FAIL')
    def test_stale_run(self):
        self.assertEqual(mod.evaluate_run([run('backup',at=NOW-timedelta(hours=28))],NOW,mod.BACKUP_FIRST_GRACE,mod.BACKUP_MAX_AGE,'backup')['status'],'FAIL')
    def test_artifact_expired(self):
        a=artifact();a['expired']=True
        self.assertEqual(mod.verify_artifact([a],100,NOW)['status'],'FAIL')
    def test_all_green(self):
        def get(path):
            if '428092546/runs' in path:return {'workflow_runs':[run('backup')]}
            if '432161115/runs' in path:return {'workflow_runs':[run('watchdog')]}
            if 'artifacts' in path:return {'artifacts':[artifact()]}
            raise AssertionError(path)
        self.assertEqual(mod.monitor(NOW,get)['status'],'PASS')
    def test_missing_backup_artifact_fail(self):
        def get(path):
            if '428092546/runs' in path:return {'workflow_runs':[run('backup')]}
            if '432161115/runs' in path:return {'workflow_runs':[run('watchdog')]}
            if 'artifacts' in path:return {'artifacts':[]}
            raise AssertionError(path)
        self.assertEqual(mod.monitor(NOW,get)['status'],'FAIL')
if __name__=='__main__':unittest.main()

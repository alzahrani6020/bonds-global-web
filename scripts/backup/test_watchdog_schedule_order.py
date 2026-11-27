import unittest
from pathlib import Path

WORKFLOW = Path(__file__).resolve().parents[2] / '.github/workflows/bonds-backup-freshness-watchdog.yml'

class WatchdogScheduleOrder(unittest.TestCase):
    def test_scheduled_check_precedes_missing_manual_backup_exit(self):
        content = WORKFLOW.read_text(encoding='utf-8')
        scheduled = content.index('scheduled="$(gh api -X GET')
        no_success = content.index('if [[ -z "$run_id" || -z "$run_completed" ]]')
        no_success_exit = content.index('exit 0', no_success)
        self.assertLess(scheduled, no_success)
        self.assertLess(scheduled, no_success_exit)
        self.assertIn('event=schedule&status=success', content)

    def test_no_simulated_alert_leaks_into_production_backup_check(self):
        content = WORKFLOW.read_text(encoding='utf-8')
        simulation = content.index('if [[ "$SIMULATE" == "true" ]]')
        scheduled = content.index('scheduled="$(gh api -X GET')
        self.assertLess(simulation, scheduled)
        self.assertIn('exit 0', content[simulation:scheduled])

if __name__ == '__main__':
    unittest.main()

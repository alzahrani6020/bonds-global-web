#!/usr/bin/env python3
"""Read-only out-of-band monitor for GitHub backup schedules and encrypted artifacts."""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

REPO = 'alzahrani6020/bonds-global-web'
BACKUP_ID = 428092546
WATCHDOG_ID = 432161115
BACKUP_FIRST_GRACE = datetime.fromisoformat('2026-11-28T02:07:00+00:00')
WATCHDOG_FIRST_GRACE = datetime.fromisoformat('2026-11-27T04:35:00+00:00')
BACKUP_MAX_AGE = 26 * 3600
WATCHDOG_MAX_AGE = 4 * 3600

def iso(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(timezone.utc)

def evaluate_run(runs, now, grace, age_limit, kind):
    eligible = [r for r in runs if r.get('event') == 'schedule' and r.get('head_branch') == 'main']
    eligible.sort(key=lambda r: r.get('created_at', ''), reverse=True)
    if not eligible:
        return {'status': 'PENDING' if now < grace else 'FAIL', 'reason': f'no scheduled {kind} execution'}
    last = eligible[0]
    if last.get('status') != 'completed':
        return {'status': 'PENDING', 'reason': f'{kind} is {last.get("status")}', 'run_id': last.get('id')}
    if last.get('conclusion') != 'success':
        return {'status': 'FAIL', 'reason': f'{kind} run failed', 'run_id': last.get('id')}
    stamp = iso(last.get('updated_at') or last['created_at'])
    age = (now - stamp).total_seconds()
    if age < -300 or age > age_limit:
        return {'status': 'FAIL', 'reason': f'{kind} run stale or clock invalid', 'run_id': last.get('id'), 'age_seconds': int(age)}
    return {'status': 'PASS', 'run_id': last.get('id'), 'age_seconds': int(age)}

def verify_artifact(artifacts, run_id, now):
    expected = f'bonds-production-encrypted-backup-{run_id}'
    candidates = [a for a in artifacts if a.get('name') == expected]
    if not candidates:
        return {'status': 'FAIL', 'reason': 'missing encrypted artifact', 'run_id': run_id}
    item = candidates[0]
    try:
        remaining = (iso(item['expires_at']) - now).total_seconds()
        size = int(item.get('size_in_bytes', 0))
    except (KeyError, ValueError, TypeError):
        return {'status': 'UNKNOWN', 'reason': 'artifact metadata invalid', 'run_id': run_id}
    if item.get('expired') or size <= 0 or remaining <= 72 * 3600:
        return {'status': 'FAIL', 'reason': 'artifact expired, empty or expiring within 72h', 'run_id': run_id}
    return {'status': 'PASS', 'run_id': run_id, 'size_bytes': size, 'seconds_to_expiry': int(remaining)}

def fetch(path, token):
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'bonds-independent-backup-monitor'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    request = urllib.request.Request(f'https://api.github.com/repos/{REPO}/{path}', headers=headers)
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)

def monitor(now, get):
    b = get(f'actions/workflows/{BACKUP_ID}/runs?event=schedule&per_page=10').get('workflow_runs', [])
    w = get(f'actions/workflows/{WATCHDOG_ID}/runs?event=schedule&per_page=10').get('workflow_runs', [])
    backup = evaluate_run(b, now, BACKUP_FIRST_GRACE, BACKUP_MAX_AGE, 'backup')
    watchdog = evaluate_run(w, now, WATCHDOG_FIRST_GRACE, WATCHDOG_MAX_AGE, 'watchdog')
    artifact = {'status': 'PENDING', 'reason': 'no completed recent successful scheduled backup'}
    if backup['status'] == 'PASS':
        items = get(f'actions/runs/{backup["run_id"]}/artifacts?per_page=100').get('artifacts', [])
        artifact = verify_artifact(items, backup['run_id'], now)
    statuses = [backup['status'], watchdog['status'], artifact['status']]
    aggregate = 'FAIL' if 'FAIL' in statuses else 'UNKNOWN' if 'UNKNOWN' in statuses else 'PENDING' if 'PENDING' in statuses else 'PASS'
    return {'status': aggregate, 'checked_at_utc': now.isoformat(), 'backup': backup, 'watchdog': watchdog, 'encrypted_artifact': artifact}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', default=REPO, choices=[REPO])
    parser.parse_args()
    now = datetime.now(timezone.utc)
    try:
        result = monitor(now, lambda path: fetch(path, os.environ.get('GH_TOKEN', '')))
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError, json.JSONDecodeError) as exc:
        result = {'status': 'UNKNOWN', 'checked_at_utc': now.isoformat(), 'reason': type(exc).__name__}
    print(json.dumps(result, indent=2))
    return {'PASS': 0, 'PENDING': 3, 'FAIL': 1, 'UNKNOWN': 2}[result['status']]

if __name__ == '__main__':
    sys.exit(main())

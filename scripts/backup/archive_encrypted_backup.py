#!/usr/bin/env python3
"""Copy one encrypted AGE backup to a separate existing directory, then verify SHA-256."""
import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import sys
from datetime import datetime, timezone
from pathlib import Path

NAME_PATTERN = re.compile(r'^production-([0-9]{11,20})\.dump\.age

def checksum(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as src:
        for block in iter(lambda: src.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def archive(source: Path, destination_dir: Path, run_id: str = None) -> dict:
    source = source.expanduser().absolute()
    destination_dir = destination_dir.expanduser().absolute()
    match = NAME_PATTERN.fullmatch(source.name)
    inferred = match.group(1) if match else None
    if run_id is not None and not re.fullmatch(r'[0-9]{11,20}', run_id):
        raise ValueError('run-id must contain 11-20 digits')
    if inferred and run_id and inferred != run_id:
        raise ValueError('provided run-id disagrees with source file name')
    if not inferred and (source.name != 'production.dump.age' or not run_id):
        raise ValueError('source must be production-<run-id>.dump.age or production.dump.age with --run-id')
    selected_run_id = inferred or run_id
    if source.is_symlink() or not source.is_file():
        raise ValueError('source must be a regular, non-symlink file')
    if source.stat().st_size == 0:
        raise ValueError('source is empty')
    if not destination_dir.is_dir() or destination_dir.is_symlink():
        raise ValueError('destination must be an existing non-symlink directory')
    dest = destination_dir / f'production-{selected_run_id}.dump.age'
    manifest = destination_dir / (dest.name + '.sha256.json')
    if source.resolve().parent == destination_dir.resolve():
        raise ValueError('destination is the source directory')
    if dest.exists() or dest.is_symlink() or manifest.exists() or manifest.is_symlink():
        raise FileExistsError('refusing overwrite of prior custody copy or manifest')
    source_sha = checksum(source)
    try:
        with source.open('rb') as inp, dest.open('xb') as out:
            if os.name != 'nt':
                os.fchmod(out.fileno(), stat.S_IRUSR | stat.S_IWUSR)
            shutil.copyfileobj(inp, out, length=1024 * 1024)
            out.flush()
            os.fsync(out.fileno())
    except Exception:
        dest.unlink(missing_ok=True)
        raise
    dest_sha = checksum(dest)
    if source_sha != dest_sha or source.stat().st_size != dest.stat().st_size:
        dest.unlink(missing_ok=True)
        raise RuntimeError('copy integrity check failed; unverified copy removed')
    output = {'filename': dest.name, 'bytes': dest.stat().st_size,
              'sha256': dest_sha, 'source_sha256': source_sha,
              'verified_at_utc': datetime.now(timezone.utc).isoformat(),
              'status': 'COPY_SHA256_PASS'}
    try:
        with manifest.open('x', encoding='utf-8') as f:
            if os.name != 'nt':
                os.fchmod(f.fileno(), stat.S_IRUSR | stat.S_IWUSR)
            json.dump(output, f, indent=2)
            f.write('\n')
            f.flush()
            os.fsync(f.fileno())
    except Exception:
        manifest.unlink(missing_ok=True)
        dest.unlink(missing_ok=True)
        raise
    return output

def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', required=True, type=Path)
    p.add_argument('--destination-dir', required=True, type=Path)
    p.add_argument('--run-id', help='Required if source filename is production.dump.age')
    args = p.parse_args()
    try:
        print(json.dumps(archive(args.source, args.destination_dir, args.run_id), indent=2))
        return 0
    except (OSError, ValueError, RuntimeError) as e:
        print('STATUS: FAIL - ' + str(e), file=sys.stderr)
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
)

def checksum(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as src:
        for block in iter(lambda: src.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def archive(source: Path, destination_dir: Path) -> dict:
    source = source.expanduser().absolute()
    destination_dir = destination_dir.expanduser().absolute()
    if not NAME_PATTERN.fullmatch(source.name):
        raise ValueError('source name must match production-<run-id>.dump.age')
    if source.is_symlink() or not source.is_file():
        raise ValueError('source must be a regular, non-symlink file')
    if source.stat().st_size == 0:
        raise ValueError('source is empty')
    if not destination_dir.is_dir() or destination_dir.is_symlink():
        raise ValueError('destination must be an existing non-symlink directory')
    dest = destination_dir / source.name
    manifest = destination_dir / (source.name + '.sha256.json')
    if source.resolve().parent == destination_dir.resolve():
        raise ValueError('destination is the source directory')
    if dest.exists() or dest.is_symlink() or manifest.exists() or manifest.is_symlink():
        raise FileExistsError('refusing overwrite of prior custody copy or manifest')
    source_sha = checksum(source)
    try:
        with source.open('rb') as inp, dest.open('xb') as out:
            if os.name != 'nt':
                os.fchmod(out.fileno(), stat.S_IRUSR | stat.S_IWUSR)
            shutil.copyfileobj(inp, out, length=1024 * 1024)
            out.flush()
            os.fsync(out.fileno())
    except Exception:
        dest.unlink(missing_ok=True)
        raise
    dest_sha = checksum(dest)
    if source_sha != dest_sha or source.stat().st_size != dest.stat().st_size:
        dest.unlink(missing_ok=True)
        raise RuntimeError('copy integrity check failed; unverified copy removed')
    output = {'filename': dest.name, 'bytes': dest.stat().st_size,
              'sha256': dest_sha, 'source_sha256': source_sha,
              'verified_at_utc': datetime.now(timezone.utc).isoformat(),
              'status': 'COPY_SHA256_PASS'}
    try:
        with manifest.open('x', encoding='utf-8') as f:
            if os.name != 'nt':
                os.fchmod(f.fileno(), stat.S_IRUSR | stat.S_IWUSR)
            json.dump(output, f, indent=2)
            f.write('\n')
            f.flush()
            os.fsync(f.fileno())
    except Exception:
        manifest.unlink(missing_ok=True)
        dest.unlink(missing_ok=True)
        raise
    return output

def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', required=True, type=Path)
    p.add_argument('--destination-dir', required=True, type=Path)
    args = p.parse_args()
    try:
        print(json.dumps(archive(args.source, args.destination_dir), indent=2))
        return 0
    except (OSError, ValueError, RuntimeError) as e:
        print('STATUS: FAIL - ' + str(e), file=sys.stderr)
        return 1

if __name__ == '__main__':
    raise SystemExit(main())

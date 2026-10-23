"""Exact source identity gate. Online preparation is explicit; offline is default."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
PINS = json.loads((ROOT / 'research/agent-action-anchor-browser-v0/SOURCE_PINS.json').read_bytes())

def run(args, cwd=None):
    p = subprocess.run(args, cwd=cwd, capture_output=True, text=True, encoding='utf-8')
    if p.returncode:
        raise RuntimeError(' '.join(str(a) for a in args) + '\n' + p.stderr)
    return p.stdout.strip()

def verify(online=False, source_root=None):
    source_root = Path(source_root or ROOT / 'build/agent-anchor/upstream').resolve()
    source_root.mkdir(parents=True, exist_ok=True)
    verified = []
    for repo in PINS['repositories']:
        path = source_root / repo['directory']
        if not path.exists():
            if not online:
                raise RuntimeError('DEPENDENCY_MISSING: run python tests/agent-anchor/prepare-sources.py --online')
            run(['git', 'clone', '--no-checkout', 'https://github.com/' + repo['repository'] + '.git', str(path)])
            run(['git', 'config', 'core.autocrlf', 'false'], path)
            run(['git', 'checkout', '--detach', repo['commit']], path)
        # Refuse an unexpected existing checkout; never reset, clean or repin it.
        if run(['git', 'rev-parse', 'HEAD'], path) != repo['commit']:
            raise RuntimeError('SOURCE_HEAD_MISMATCH: ' + str(path))
        if run(['git', 'status', '--porcelain', '--untracked-files=no'], path):
            raise RuntimeError('SOURCE_MODIFIED: ' + str(path))
        for file, expected in repo['files'].items():
            actual = hashlib.sha256((path / file).read_bytes()).hexdigest()
            if actual != expected:
                raise RuntimeError('SOURCE_DRIFT: ' + repo['directory'] + '/' + file)
            verified.append({'repository': repo['repository'], 'commit': repo['commit'], 'path': file, 'sha256': actual})
    unchanged = []
    changed = []
    for file, expected in PINS['historical_files'].items():
        actual = hashlib.sha256((ROOT / file).read_bytes()).hexdigest()
        if actual != expected:
            if file not in PINS['allowed_integration_paths']:
                raise RuntimeError('HISTORICAL_SOURCE_CHANGED: ' + file)
            changed.append(file)
        else:
            unchanged.append(file)
    # Native algorithms copied for the browser are exactly the same across #85's
    # historical source and the user's merged ReceiptOS source. Docs may differ.
    identical = ['src/core/strict-json.mjs','src/core/common.mjs','src/core/capsule.mjs','research/agent-action-browser-verify-v0/lib/anchor.mjs']
    for file in identical:
        if (source_root/'receiptos'/file).read_bytes() != (source_root/'receiptos-current'/file).read_bytes():
            raise RuntimeError('NATIVE_VERSION_DIFFERENCE: ' + file)
    copies={'kit-vectors.json':source_root/'kit/research/chain-neutral-receipt-anchor-proof-v0/vectors.json',
        'subject.schema.json':source_root/'kit/research/chain-neutral-receipt-anchor-proof-v0/subject.schema.json',
        'envelope.schema.json':source_root/'kit/research/chain-neutral-receipt-anchor-proof-v0/envelope.schema.json',
        'slot-vectors.json':source_root/'invino/examples/decision-receipt/slot_log_vectors.json'}
    for name, original in copies.items():
        if (ROOT/'tests/agent-anchor/fixtures'/name).read_bytes()!=original.read_bytes():
            raise RuntimeError('FROZEN_FIXTURE_CHANGED: '+name)
    licenses={'CC0-1.0.txt':ROOT/'LICENSE',
        'ReceiptOS-Apache-2.0.txt':source_root/'receiptos-current/LICENSE',
        'ReceiptOS-NOTICE.txt':source_root/'receiptos-current/NOTICE',
        'Invinoveritas-Apache-2.0.txt':source_root/'invino/LICENSE'}
    for name, original in licenses.items():
        # The distribution copy removes only the base license's extra EOF blank
        # line; the original LICENSE and its historical hash remain untouched.
        expected=original.read_bytes()
        if name=='CC0-1.0.txt':expected=expected.rstrip(b'\n')+b'\n'
        if (ROOT/'public/licenses'/name).read_bytes()!=expected:
            raise RuntimeError('DISTRIBUTION_LICENSE_MISMATCH: '+name)
    if (ROOT/'public/THIRD_PARTY_NOTICES.txt').read_bytes()!=(ROOT/'THIRD_PARTY_NOTICES.md').read_bytes():
        raise RuntimeError('DISTRIBUTION_ATTRIBUTION_MISMATCH')
    result = {'schema':'lens.source-identity.v0','passed':True,'source_files':verified,
        'historical_unchanged':unchanged,'explicit_integration_changes':changed,'identical_native_files':identical,
        'frozen_fixture_copies_verified':list(copies),'distribution_licenses_verified':list(licenses)}
    out = ROOT/'build/agent-anchor/source-identity.json'
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'passed':True,'sources':len(verified),'historical_unchanged':len(unchanged),'integration_changes':changed}))
    return source_root

if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--online',action='store_true');parser.add_argument('--source-root')
    args=parser.parse_args();verify(args.online,args.source_root)

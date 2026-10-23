"""Executed reproducibility gate; explicit setup is separate from test success."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[2]
def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def write(path,value):Path(path).write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8',newline='\n')
def inventory():
    p=subprocess.run(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=ROOT,capture_output=True,check=True)
    return {n:digest(ROOT/n) for n in sorted(set(p.stdout.decode().split('\0'))- {''}) if (ROOT/n).is_file()}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--out',default='build/agent-anchor/validation')
    args=parser.parse_args();out=(ROOT/args.out).resolve()
    if out.exists():raise RuntimeError('Refuse to overwrite validation evidence')
    out.mkdir(parents=True)
    report={'schema':'lens.agent-anchor.validation.v0','passed':False,'commands':[]}
    before=inventory();write(out/'inventory-before.json',before)
    env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1','PYTHONUTF8':'1'}
    npm=shutil.which('npm.cmd' if os.name=='nt' else 'npm')
    def run(name,argv,extra_env=None):
        started=datetime.now(timezone.utc).isoformat()
        p=subprocess.run([str(a) for a in argv],cwd=ROOT,env={**env,**(extra_env or {})},capture_output=True)
        (out/(name+'.stdout')).write_bytes(p.stdout);(out/(name+'.stderr')).write_bytes(p.stderr)
        report['commands'].append({'name':name,'argv':[str(a) for a in argv],'started_utc':started,'exit_code':p.returncode,
            'stdout_sha256':hashlib.sha256(p.stdout).hexdigest(),'stderr_sha256':hashlib.sha256(p.stderr).hexdigest()})
        write(out/'report.json',report);print(name+': exit '+str(p.returncode),flush=True)
        if p.returncode:raise RuntimeError(name+' failed; retained raw evidence')
    run('source-pins',[sys.executable,'-B','tests/agent-anchor/prepare-sources.py'])
    run('retained-evidence',[sys.executable,'-B','tests/agent-anchor/verify-evidence.py'])
    run('retained-evidence-optimized',[sys.executable,'-O','-B','tests/agent-anchor/verify-evidence.py'])
    run('lint',[npm,'run','lint']);run('typescript-build',[npm,'run','build'])
    for file in (ROOT/'public/licenses').iterdir():
        if file.read_bytes()!=(ROOT/'dist/licenses'/file.name).read_bytes():raise RuntimeError('Bundled license mismatch: '+file.name)
    if (ROOT/'public/THIRD_PARTY_NOTICES.txt').read_bytes()!=(ROOT/'dist/THIRD_PARTY_NOTICES.txt').read_bytes():raise RuntimeError('Bundled attribution mismatch')
    run('fixture-reproduction',['node','tests/agent-anchor/generate-extra.mjs','--out',out/'regenerated-browser-vectors.json'])
    if (out/'regenerated-browser-vectors.json').read_bytes()!=(ROOT/'tests/agent-anchor/fixtures/browser-vectors.json').read_bytes():raise RuntimeError('Fixture producer differs')
    run('native-oracle',[sys.executable,'-B','tests/agent-anchor/replay-oracle.py'])
    shutil.copyfile(ROOT/'build/agent-anchor/oracle/report.json',out/'native-oracle.json')
    shutil.copyfile(ROOT/'build/agent-anchor/source-identity.json',out/'source-identity.json')
    for mode,flags in [('normal',[]),('repeat',[]),('no-opt',['--no-opt'])]:
        run('node-'+mode,['node',*flags,'tests/agent-anchor/conformance.mjs','--out',out/('node-'+mode)])
    node_hashes={mode:digest(out/('node-'+mode)/'conformance.json') for mode in ['normal','repeat','no-opt']}
    if len(set(node_hashes.values()))!=1:raise RuntimeError('Node nondeterministic')
    for mode in ['normal','repeat']:
        run('chromium-'+mode,['node','node_modules/@playwright/test/cli.js','test'],{'LENS_REPORT_DIR':str(out/('chromium-'+mode))})
        run('production-'+mode,['node','tests/agent-anchor/production.mjs'],{'LENS_REPORT_DIR':str(out/('production-'+mode))})
        run('physical-'+mode,['node','tests/agent-anchor/mutations.mjs','--out',out/('physical-'+mode)])
        run('slot-physical-'+mode,['node','tests/agent-anchor/mutations.mjs','--catalog','mutations-slot.json','--out',out/('slot-physical-'+mode)])
    browser_hashes={mode:digest(out/('chromium-'+mode)/'browser-results.json') for mode in ['normal','repeat']}
    mutation_hashes={mode:digest(out/('physical-'+mode)/'report.json') for mode in ['normal','repeat']}
    production_hashes={mode:digest(out/('production-'+mode)/'production-results.json') for mode in ['normal','repeat']}
    slot_hashes={mode:digest(out/('slot-physical-'+mode)/'report.json') for mode in ['normal','repeat']}
    if any(len(set(h.values()))!=1 for h in [browser_hashes,mutation_hashes,production_hashes,slot_hashes]):raise RuntimeError('Browser/mutation nondeterministic')
    run('source-pins-after',[sys.executable,'-B','tests/agent-anchor/prepare-sources.py'])
    run('diff-check',['git','diff','--check'])
    after=inventory();write(out/'inventory-after.json',after)
    if before!=after:raise RuntimeError('Source changed during validation')
    report.update({'passed':True,'tracked_and_untracked_source_files_unchanged':len(before),
        'deterministic':{'node':node_hashes,'chromium':browser_hashes,'production':production_hashes,'physical_mutations':mutation_hashes,'supplemental_slot_mutations':slot_hashes},
        'runtime':{'python':sys.version,'node':subprocess.check_output(['node','--version']).decode().strip(),
            'platform':sys.platform},'result_scope':'Author/CI reproducibility, not independent organizational certification'})
    write(out/'report.json',report)
    print(json.dumps({k:v for k,v in report.items() if k!='commands'}))

if __name__=='__main__':main()

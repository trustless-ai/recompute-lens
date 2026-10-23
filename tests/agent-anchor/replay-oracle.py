"""Execute unmodified pinned #85 Node/Python native layers against frozen vectors."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('prepare',Path(__file__).with_name('prepare-sources.py'))
prepare=importlib.util.module_from_spec(spec);spec.loader.exec_module(prepare)
upstream=prepare.verify()
kit=upstream/'kit/research/chain-neutral-receipt-anchor-proof-v0'
env={**os.environ,'CHAIN_PROOF_SOURCES':str(upstream),'CHAIN_PYTHON':sys.executable,'PYTHONDONTWRITEBYTECODE':'1'}
corpus=json.loads((ROOT/'tests/agent-anchor/fixtures/kit-vectors.json').read_bytes())
# Expected records never enter the implementation under test.
request={'vectors':[{k:v[k] for k in ['name','input','context']} for v in corpus['vectors']]}
p=subprocess.run(['node',str(kit/'adapter.mjs')],input=json.dumps(request),env=env,cwd=ROOT,capture_output=True,text=True,encoding='utf-8')
out=ROOT/'build/agent-anchor/oracle';out.mkdir(parents=True,exist_ok=True)
(out/'stdout.json').write_text(p.stdout,encoding='utf-8',newline='\n');(out/'stderr.txt').write_text(p.stderr,encoding='utf-8',newline='\n')
if p.returncode!=0 or not p.stdout.strip():raise RuntimeError('ORACLE_PROCESS_FAILED_OR_EMPTY')
actual=json.loads(p.stdout);expected={v['name']:v['expected'] for v in corpus['vectors']}
if actual!=expected:raise RuntimeError('ORACLE_EXPECTATION_MISMATCH')
result={'schema':'lens.native-oracle-replay.v0','passed':True,'count':len(actual),
    'kit_commit':'b4537d73bda4e4df73c4b105ee516a43c351ba02','complete_projection':actual,
    'request_excludes_expectations':True,'request_sha256':hashlib.sha256(json.dumps(request).encode()).hexdigest()}
(out/'report.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'passed':True,'count':len(actual),'request_excludes_expectations':True}))

"""Validate retained bytes and internal report consistency, not proof semantics."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parents[2]
E=ROOT/'research/agent-action-anchor-browser-v0/evidence'
def check(condition,reason):
    if not condition:raise RuntimeError(reason)
def sha(data):return hashlib.sha256(data).hexdigest()

def main():
    pins=json.loads((E/'SHA256.json').read_bytes())
    summary=json.loads((E/'SUMMARY.json').read_bytes())
    for name,expected in pins['files'].items():check(sha((E/name).read_bytes())==expected,'File hash: '+name)
    with zipfile.ZipFile(E/'EVIDENCE.zip') as z:
        check(len(z.namelist())==len(set(z.namelist())),'Duplicate ZIP member')
        check(sorted(z.namelist())==sorted(pins['archive_members']),'ZIP inventory')
        for name,expected in pins['archive_members'].items():check(sha(z.read(name))==expected,'Member hash: '+name)
        load=lambda name:json.loads(z.read(name))
        prior=None
        for platform in ['windows','linux']:
            r=load(platform+'/report.json')
            check(r['passed'] is True and all(c['exit_code']==0 for c in r['commands']),'Execution failed')
            for c in r['commands']:
                for stream in ['stdout','stderr']:
                    check(sha(z.read(platform+'/'+c['name']+'.'+stream))==c[stream+'_sha256'],'Command log hash')
            check(load(platform+'/inventory-before.json')==load(platform+'/inventory-after.json'),'Source restoration')
            check(r['deterministic']==summary['behavioral_digests'],'Summary digest mismatch')
            check(prior is None or prior==r['deterministic'],'Cross-platform mismatch');prior=r['deterministic']
            for family,filename in [('node','conformance.json'),('chromium','browser-results.json'),('production','production-results.json'),('physical_mutations','report.json')]:
                folder='physical' if family=='physical_mutations' else family
                digests=r['deterministic'][family]
                check(len(set(digests.values()))==1,'Repeat mismatch')
                for mode,expected in digests.items():check(sha(z.read(platform+'/'+folder+'-'+mode+'/'+filename))==expected,'Behavioral hash')
            n=load(platform+'/node-normal/conformance.json')
            check(n['passed'] is True and (n['kit_count'],n['browser_count'],n['slot_count'],n['admission_count'])==(49,21,15,19),'Conformance counts')
            m=load(platform+'/physical-normal/report.json')
            check(m['passed'] is True and len(m['records'])==47 and m['counts']==summary['physical_mutations'],'Mutation counts')
            check(all(x['byte_restoration'] and x['semantic_restoration'] for x in m['records']),'Mutation restoration')
            check(all(x['classification']!='KILLED' for x in m['records'] if x['kind']=='SENTINEL'),'Sentinel kill credit')
            oracle=load(platform+'/native-oracle.json')
            check(oracle['passed'] is True and oracle['count']==49 and oracle['request_excludes_expectations'] is True,'Native oracle')
    print(json.dumps({'schema':'lens.retained-evidence-integrity.v0','passed':True,'members':len(pins['archive_members']),'implementation_commit':summary['implementation_commit']}))

if __name__=='__main__':main()

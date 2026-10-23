# Preserved execution evidence

`EVIDENCE.zip` contains actual fresh-checkout output at implementation commit
`de695f06a55684843baa7e80549786eedf7d7d7a`, with sorted members, fixed timestamps,
and individual SHA-256 values in `SHA256.json`. It contains no dependencies,
caches, credentials, replacement source tree or fabricated successful outcomes.

`windows/` holds the passing sequential full run; `linux/` the passing WSL run.
Both include all raw command logs, inventories, complete Node/browser/production
reports and baseline/mutant/restored physical observations. Setup logs are
separate. The first Windows setup's failed validation remains failed in those
logs; the later successful run is explicitly `fresh-sequential`.

`incidents/` preserves the earlier repaired base64 boundary failure and the
overlapping-port setup refusal. These do not count as conformance passes or
semantic mutation kills. `source/` records the bounded changes to original files.
The exact implementation commit supplies all source code and frozen fixtures.

Verify the archive and report consistency:

```sh
python -B tests/agent-anchor/verify-evidence.py
python -O -B tests/agent-anchor/verify-evidence.py
```

Then execute the full fresh-clone commands in the parent README. Hash validation
establishes retained bytes, not correctness, current upstream state or independent
review. This package's implementation SHA is intentionally stable; PR-head CI
and later author replay are separate records, not silently inserted into it.

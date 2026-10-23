# Agent action and anchor browser recipes v0

Starting main: `61f7392f1c4758231517b22ba06ab608dedbae02`.
Branch: `feat/agent-action-anchor-browser-recipes-v0`.

This additive browser port reuses recompute-kit PR85's contracts and independently
authored expected results. It adds three registry entries and preserves the 13
existing recipes and their source vectors.

| Recipe | Browser work | Boundary |
| --- | --- | --- |
| `agent-action.subject-record.v0` | Original UTF-8 byte admission; exact restricted canonical equality; SHA-256; comparison with optional selected subject ID | Record identity, not execution |
| `receiptos.manifest-proof.v0` | Subject/leaf binding; domain-separated binary Merkle path; count-bound root; authenticated selected checkpoint; Ed25519 signatures; optional full-manifest extension | Laboratory/local key verification, not public anchoring |
| `invinoveritas.decision_receipt.slot_log.v1` | Subject/claim commitment; full canonical snapshots; ASCII-hex pair Merkle path; selected header-root binding; index/count; optional prior snapshot preservation | Snapshot consistency, not timestamp/Bitcoin verification |

Both proof recipes accept `chain-neutral.anchor-proof-envelope.v0`. Their common
composition lives in `src/recompute/agent-anchor/proof.js`; algorithm-specific
ports remain separate. Typed declarations expose the API to the existing React
registry. SHA-256 and Ed25519 actually execute through browser Web Crypto. There
is no server verifier, host-verdict fallback, implicit fetch or network access.

The caller passes `evaluateProof(input, configuration)` with an independently
selected `{policy_id, authorities}` configuration. Policy signatures cover the
original domain prefix and canonical policy body. Only its authenticated selected
checkpoint keys can authenticate a manifest checkpoint. Proof metadata never
grants authority. The explicit example button supplies *public laboratory* keys;
it does not provision an independently authenticated public authority.

Subject admission accepts a `Uint8Array`. File upload preserves original bytes,
including malformed UTF-8, rather than normalizing through JSON.parse or textarea
serialization. Pasted text is UTF-8 encoded after scalar-string validation.
Maximum document size is 4 MiB and nesting is 32 containers. Duplicate members,
unsafe integers, negative zero, invalid Unicode, unsafe/non-ASCII keys and
noncanonical bytes are refused. The subject has **no field exclusions**. An
extra top-level `anchor` is a shape error; admitted metadata is hashed completely.
The historical `receiptos-c14n-v0` recipe still strips top-level `anchor` and is
not used here.

Proof validity (`VERIFIED`, `REFUTED`, `UNVERIFIABLE`) and anchor assurance
(`CHAIN_CONSISTENT`, `ANCHOR_UNCHECKED`) are separate. `ANCHORED_VERIFIED` is
NOT_COVERED. A bad inclusion remains REFUTED even when timestamp evidence is
unavailable. An optional host projection is diagnostic: mismatch is shown as
DISAGREEMENT without replacing the browser result. No seventh RVR field exists.

## Replay

Node 22.15.0, Python 3.12 and the exact npm lock are the CI baseline. Linux Node
20.19.5 is also exercised locally when recorded in RESULTS. Run in a new clone:

```sh
git clone https://github.com/trustless-ai/recompute-lens.git
cd recompute-lens
git checkout <exact PR commit>
npm ci --ignore-scripts --no-audit --no-fund
npx playwright install --with-deps chromium
python -B tests/agent-anchor/prepare-sources.py --online
python -B tests/agent-anchor/validate.py
```

On systems using `python3`, substitute that executable. Windows may use the full
Python path. Preparation explicitly downloads exact source dependencies and
verifies 49 file pins. Existing unexpected checkouts are refused without reset.
Missing dependencies or failed browser setup are failures, never successful tests.
After preparation, the tests and both proof recipes work without network access.

Routine offline subsets:

```sh
npm run build
npm run lint
npm run test:agent-anchor
npm run test:browser
node tests/agent-anchor/production.mjs
node tests/agent-anchor/mutations.mjs --out build/agent-anchor/my-mutation-run
python -B tests/agent-anchor/prepare-sources.py
python -B tests/agent-anchor/replay-oracle.py
```

Use a new output directory for repeat validation: evidence is not overwritten.
The validator runs Node normal/repeat/`--no-opt`, Chromium normal/repeat, production
bundle checks, physical mutations and the unmodified pinned Node/Python oracle.
Complete #85 projections (including reason and native fields) are compared, not
just a green status. Expected outcomes never enter the implementation under test.

## Evidence and review

See `SOURCE_PINS.json`, `RESULTS.md`, `LIMITATIONS.md` and `PHASE_2_PLAN.md`.
`tests/agent-anchor/fixtures/kit-vectors.json` and `slot-vectors.json` are original
source bytes. Browser-only expectations are separately authored by a producer
that imports no verifier. The physical catalog records multi-site removals
explicitly; the defensive native-root fault experiment is a separate population.
No-op, crash, missing-output and unapplied sentinels cannot count as kills.

Independent reviewers should verify pins and fixture hashes, inspect source
adaptations against the pinned originals, reproduce raw results, inspect each
baseline/mutant/restored witness and positive control, and verify the two result
dimensions and separate configuration channel in the UI. Author fresh-checkout
replay and CI are reproducibility evidence, not independent organizational review.

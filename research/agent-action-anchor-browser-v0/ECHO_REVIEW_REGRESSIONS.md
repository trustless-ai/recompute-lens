# Echo review regression closure — author evidence

Reviewed parent: `84cf444537f9fdc028c355a830790fa80597f4aa`.
Main/base observed before this change: `61f7392f1c4758231517b22ba06ab608dedbae02`.
Existing Draft PR: https://github.com/trustless-ai/recompute-lens/pull/2.
Review: https://github.com/trustless-ai/recompute-lens/pull/2#issuecomment-6376143028.

## What changed

The runtime guard was already correct. This patch adds regression fixtures,
physical controls and documentation, without changing any verifier, recipe,
Merkle algorithm, policy semantics, UI implementation, dependency or source pin.
It does not establish a new production vulnerability.

The separate `tests/agent-anchor/fixtures/review-regressions-v0.json` contains
26 proof cases plus two host-comparison cases. Its deterministic generator is
`tests/agent-anchor/generate-review-regressions.mjs`; it never invokes or imports
the verifier to obtain expectations. Literal expected projections were specified
before execution. Original 49 kit + 21 browser + 15 slot vectors, 19 admission
controls, 16 golden self-tests and historical evidence archives are unchanged.

The accessible PR/comment/branch listings and author searches contained no
published Echo fixture set or fixture PR when inspected. The review reports
23 probes but supplies prose, not their exact bytes. These are locally authored
reconstructions of documented scenarios, with additional documentation controls;
they are not represented as Echo's original 23 fixtures or independent verifier.
Attribution belongs to Echo for the finding and scenario descriptions.

## Before/after witness

Both duplicate-ID policies are authenticated with the independent configured
laboratory authority. The selected checkpoint identity and its signature under
the attacker laboratory key are valid. `review-authentication.mjs` checks these
premises with Node crypto independently of the browser verifier. The keys are
public deterministic fixture material, not operational authorities.

| Operation | Original tests | New tests / observation |
| --- | --- | --- |
| Existing guard present | conformance exit 0 | both orderings UNVERIFIABLE / AMBIGUOUS_LOG_TRUST_ROOT |
| Remove only duplicate-ID guard | conformance exit 0; original mutation suite exit 0 | attacker first becomes VERIFIED; attacker second becomes REFUTED / CHECKPOINT_SIGNATURE_INVALID |
| Same removal with new regressions | not applicable | exit 1; exactly the two duplicate cases fail, no crash |
| Restore original bytes | exit 0 | exit 0; all candidate source bytes restored |
| Remove known checkpoint-signature guard | exit 1 | original INVALID_CHECKPOINT_SIGNATURE case supplies positive red control |

The attacker's first position is the semantic KILL witness: `.find()` chooses
that key after uniqueness enforcement is removed. The second ordering asserts
the ambiguity reason but is **not** credited as a signature-failure kill.
The supplemental physical mutation has healthy `A_VALID` and `B_VALID_CHAIN`
controls and byte/semantic restoration. The unmodified runtime manifest digest
is `3fe4e245222e9d83473ab9ff33c69afa47358daab5dab2874860f629d08e7a4f`.

## Executed validation

Windows (Node 22.15.0, Python 3.12.10) and isolated WSL Ubuntu
(Node 20.19.5, Python 3.12.3) each completed all 24 validator commands.
Linux invoked the Python orchestration with `-O -B`; retained-evidence integrity
runs both normal and `-O` on both systems. JavaScript runs normal, repeat and
`--no-opt` (Python optimization is not a JavaScript execution mode).

- 96/96 complete proof projections: original 49 + 21, new 26.
- 2/2 new host-comparison cases; conflicting host VERIFIED never promotes local
  REFUTED, malformed extra host fields remain MALFORMED, local object unchanged.
- 15/15 original slot cases; 19/19 admission controls; 16/16 golden recipes.
- 49/49 original projections agree with the separately executed pinned native oracle.
- 7/7 Chromium Playwright groups, twice; production bundle: three original examples
  plus four new duplicate/host UI cases, twice, with no unexpected network requests.
- Original 41 semantic mutants, two existing slot mutants and one new duplicate
  mutant: 44 KILLED, zero SURVIVED. One controlled native-root fault and one
  diagnostic detection are reported separately, not added to semantic coverage.
- Non-kill sentinels across old/new catalogs: CRASHED 2, NO_OP 2,
  NOT_APPLIED 2, MISSING_OUTPUT 2, CONTROL_BROKEN 1. None receive kill credit.
- 49 upstream source-file pins valid; 18 original lens files unchanged under the
  existing eight-path integration allowance; license/notice bundle checks pass.
- All six complete machine-result reports match byte-for-byte across repeat modes
  and Windows/Linux. Original mutation reports are also byte-identical to retained
  historical reports; original 70 projections and golden outputs are unchanged.
- 71/78 parent-tracked files unchanged. Seven intentional test/doc wrappers changed;
  every `src/` file, original fixture, mutation catalog, workflow and historical
  evidence file is byte-identical to the reviewed parent.

One failed Windows attempt is retained: `physical-repeat` could not fetch the
`selected-checkpoint/proof.js` module during semantic restoration. Byte restoration
succeeded, semantic restoration did not, and the campaign correctly failed.
The cause is not established beyond module loading. It is not counted as a kill
or a successful run. Two unchanged targeted replays and the subsequent complete
Windows/Linux campaigns pass. No classifier, timeout or restoration gate was
weakened. This intermittent observation remains disclosed for independent replay.

## Evidence and replay

Additive archive: `evidence/ECHO_REVIEW_REGRESSIONS.zip` (595 members).
SHA-256: `a549cc35ad08f2f5ea1438087983f8ce2e3df18ff2b73762c22097c872b6d287`.
`evidence/ECHO_REVIEW_SUMMARY.json` records every archive-member digest, test-source
hash, changed/preserved parent-file hash, exact behavioral digests and runtimes.
The archive contains argv, stdout/stderr, exits, before/removal/restored observations,
all physical edit records and the failed attempt. Exact-commit fresh-checkout
replay and GitHub CI occur after this source/evidence commit and are reported
separately; this precommit archive does not pretend to be postcommit evidence.

The old `evidence/EVIDENCE.zip` remains SHA-256
`9c47bf80551432418b96fa31e61847b3a60d58e7fec66e712038560eecfd8a80`.
No historical result was overwritten or relabelled.

```sh
# Fresh clone with exact blob bytes; checkout the PR commit being reviewed.
git clone --config core.autocrlf=false https://github.com/trustless-ai/recompute-lens
cd recompute-lens
git checkout <exact-review-commit>
npm ci --ignore-scripts --no-audit --no-fund
npx playwright install --with-deps chromium
python -B tests/agent-anchor/prepare-sources.py --online
python -B tests/agent-anchor/validate.py --out build/review-replay
# Optional complete optimized Python orchestration in another output directory:
python -O -B tests/agent-anchor/validate.py --out build/review-replay-O
```

The existing CI workflow invokes this validator on Ubuntu and Windows; no test
invocation was removed and no new workflow was needed. Do not overlap UI campaigns
on port 4173. Never reuse output directories: evidence is preserved, not overwritten.

## Documentation and remaining boundary

`LIMITATIONS.md` records the deliberately preserved ReceiptOS malformed-path
REFUTED result versus slot sibling-shape UNVERIFIABLE, ignored but authenticated
unknown policy members, and browser `PROFILE_MECHANISM_UNSUPPORTED` narrowing.
`UPSTREAM_CLARIFICATIONS_PROPOSED.md` proposes the slot checkpoint/header identity
and selected-policy contradiction wording only; no upstream specification changed.

Proof validity and anchor assurance remain separate. Public anchor authenticity,
OpenTimestamps/Bitcoin verification, external execution and downstream authorization
remain NOT_COVERED. No new-head macOS, Firefox or Safari execution is claimed.
Echo's prior macOS/spec-only review is independent upstream-reported evidence at
the parent SHA, not independent acceptance of this follow-up. Keep PR Draft and
Phase 2 Web Component unstarted pending completed independent review.

## New proof projections

All expectations below include the complete native projection in the JSON corpus;
the table abbreviates it for reading.

| Case | Validity | Reason | Assurance |
| --- | --- | --- | --- |
| REVIEW_DUPLICATE_KEY_ATTACKER_FIRST | UNVERIFIABLE | AMBIGUOUS_LOG_TRUST_ROOT | ANCHOR_UNCHECKED |
| REVIEW_DUPLICATE_KEY_ATTACKER_SECOND | UNVERIFIABLE | AMBIGUOUS_LOG_TRUST_ROOT | ANCHOR_UNCHECKED |
| REVIEW_ATTACKER_CHECKPOINT_REAL_ID | REFUTED | CHECKPOINT_SIGNATURE_INVALID | ANCHOR_UNCHECKED |
| REVIEW_ENVELOPE_AUTHORITY_ONLY | UNVERIFIABLE | POLICY_AUTHORITY_UNKNOWN | ANCHOR_UNCHECKED |
| REVIEW_CONTEXT_KEY_SWAP | UNVERIFIABLE | POLICY_SIGNATURE_INVALID | ANCHOR_UNCHECKED |
| REVIEW_POLICY_NO_DOMAIN | UNVERIFIABLE | POLICY_SIGNATURE_INVALID | ANCHOR_UNCHECKED |
| REVIEW_EMPTY_CHECKPOINT_KEYS | UNVERIFIABLE | LOG_TRUST_ROOT_MISSING | ANCHOR_UNCHECKED |
| REVIEW_CHECKPOINT_NO_DOMAIN | REFUTED | CHECKPOINT_SIGNATURE_INVALID | ANCHOR_UNCHECKED |
| REVIEW_CHECKPOINT_POLICY_DOMAIN | REFUTED | CHECKPOINT_SIGNATURE_INVALID | ANCHOR_UNCHECKED |
| REVIEW_SIGNED_OTHER_LOG | REFUTED | LOG_IDENTITY_MISMATCH | ANCHOR_UNCHECKED |
| REVIEW_WRONG_CHECKPOINT_SCHEMA | UNVERIFIABLE | CHECKPOINT_MALFORMED | ANCHOR_UNCHECKED |
| REVIEW_REQUIRED_CHAIN_MISSING | UNVERIFIABLE | CONSISTENCY_EVIDENCE_MISSING | ANCHOR_UNCHECKED |
| REVIEW_EXTRA_MANIFEST_SIBLING | REFUTED | MERKLE_INCLUSION_INVALID | ANCHOR_UNCHECKED |
| REVIEW_MANIFEST_SIDE_CASE | REFUTED | MERKLE_INCLUSION_INVALID | ANCHOR_UNCHECKED |
| REVIEW_COUNT_UINT32_WRAP | REFUTED | CHECKPOINT_TREE_SIZE_MISMATCH | ANCHOR_UNCHECKED |
| REVIEW_MANIFEST_UPPERCASE_HASH | REFUTED | MERKLE_INCLUSION_INVALID | ANCHOR_UNCHECKED |
| REVIEW_EXTRA_SLOT_PATH | REFUTED | SLOT_INCLUSION_INVALID | ANCHOR_UNCHECKED |
| REVIEW_SLOT_CRLF | REFUTED | SLOT_SNAPSHOT_INVALID | ANCHOR_UNCHECKED |
| REVIEW_SLOT_NO_FINAL_LF | REFUTED | SLOT_SNAPSHOT_INVALID | ANCHOR_UNCHECKED |
| REVIEW_SLOT_STRING_INDEX | REFUTED | SLOT_POSITION_INVALID | ANCHOR_UNCHECKED |
| REVIEW_UNKNOWN_POLICY_MEMBER | VERIFIED | BOUNDED_INCLUSION_VERIFIED | ANCHOR_UNCHECKED |
| REVIEW_PROFILE_MECHANISM_NARROWING | UNVERIFIABLE | PROFILE_MECHANISM_UNSUPPORTED | ANCHOR_UNCHECKED |
| REVIEW_SELECTED_LOG_CONTRADICTION | REFUTED | LOG_IDENTITY_MISMATCH | ANCHOR_UNCHECKED |
| REVIEW_SELECTED_CHECKPOINT_CONTRADICTION | REFUTED | SELECTED_CHECKPOINT_MISMATCH | ANCHOR_UNCHECKED |
| REVIEW_SLOT_UPPERCASE_HASH | UNVERIFIABLE | SLOT_MALFORMED | ANCHOR_UNCHECKED |
| REVIEW_SLOT_SIDE_CASE | UNVERIFIABLE | SLOT_MALFORMED | ANCHOR_UNCHECKED |

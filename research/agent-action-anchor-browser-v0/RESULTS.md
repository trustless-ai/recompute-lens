# Executed browser recipe results

These are author-executed reproducibility results, not independent organizational
certification. No upstream defect or universal conformance claim is made.

## Scope and preservation

Three browser recipes implement exact admitted subject identity, ReceiptOS binary
count-bound manifest inclusion and Invinoveritas ASCII-hex slot-log inclusion.
The original 13 registry recipes pass their golden self-tests; 16 run in total.
The historical `receiptos-c14n-v0` still excludes top-level `anchor`; the new subject
recipe hashes every admitted byte and excludes nothing.

The exact base is `61f7392f1c4758231517b22ba06ab608dedbae02`. `SOURCE_PINS.json`
records all 26 base files: eight explicit integration paths may change, while
18 historical files, including all original recomputation modules, remain exact.
49 source-file pins and four original fixture/schema copies are verified. The
ReceiptOS runtime files used by #85 are byte-identical at its historical pin and
the user's merged PR2 source. No upstream repository is modified.

## Windows candidate execution

The full `windows-final` validation passed on Windows with Node 22.15.0, Python
3.12.10 and Playwright 1.64.1 / Chromium 156.0.8078.4. Lint and TypeScript/Vite build
passed. Native #85 replay matched all 49 independent complete result projections.

| Population | Observed result |
| --- | --- |
| Published #85 full projections | 49/49 matched in Node and Chromium |
| Separately authored browser projections | 21/21 matched in Node and Chromium |
| Original slot-log vectors | 15/15 matched |
| Raw byte admission controls | 19/19 matched, including exact/over 4 MiB and depth 32/33 |
| Registry self-tests | 16/16 passed, including all 13 historical recipes |
| Playwright groups | 6/6 passed, including real UI uploads and host disagreement |
| Built production bundle | Three recipe examples and all 16 self-tests passed |
| Physical semantic mutations | 41/41 KILLED |
| Host-comparison diagnostic mutation | 1/1 DIAGNOSTIC_DETECTED, separate from proof guarantees |
| Induced native-root fault experiment | 1/1 KILLED, separate from ordinary semantic mutants |
| Classifier sentinels | NO_OP, CRASHED, MISSING_OUTPUT and NOT_APPLIED all classified without semantic kill credit |

Physical experiments record baseline, modified and restored browser outputs,
positive controls, exact edits and all source hashes. Some admission guarantees
require explicitly catalogued multi-site removals because checks are redundant.
The native-root fault deliberately alters a native report before removing the
composition guard; it is not evidence of an upstream vulnerability.

Node normal/repeat/`--no-opt` and Chromium/production/mutations normal/repeat
have identical complete machine-result digests:

| Output | SHA-256 |
| --- | --- |
| Node conformance | `c77ecc4bb50fc8a0cfe0481c2a11b67ce14ec3b1ce9ea75ec9915b621f3724db` |
| Chromium | `dfa596f244e26cc88a575a5b2eab0c8fd3470155fdcfdf98d60fa0b71baa6182` |
| Production | `c82cfa2f79cd130baf3c1c8a413df34821f6af9bf2159f72656333eb6a83755e` |
| Physical mutations | `498021b6660e1ce811f0efdf7862f1a765702639118c3225e11defea078f9908` |

Timing, machine paths and runtime metadata are kept separately from semantic
digests. The candidate gate recorded all 67 then-present source files unchanged
during execution. Later distribution-license checks and a stylesheet relocation
are subject to fresh-checkout validation before publication.

## Failure discovered and repaired

The first Chromium run hit a JavaScript stack limit when a nested base64 regular
expression processed the 4 MiB boundary. The byte decoder now uses a bounded
character scan, padding checks and round-trip equality. The original failed run
is retained as an incident; it is not counted as a passing campaign. The final
19 admission controls exercise this repaired boundary in the actual browser.

## Limits and next gate

The browser has three declared narrower admissions than the host: explicit
profile/mechanism pairs, literal L/R sibling tags and the bounded slot JSON
domain. See `LIMITATIONS.md`. All 49 published witnesses still match completely.
No host verdict substitutes for local browser verification. No mandatory network
calls are added; browser test traffic is restricted to the local test server.

Public anchoring, timestamp/Bitcoin verification, public-log freshness and
non-equivocation, external action execution, judgment correctness, payment and
claim authorization remain NOT_COVERED. Independent security review and Firefox/
Safari execution are not established. RVR remains a separate six-field receipt.

Fresh Windows/Linux checkout execution and final publication status will be
recorded after they actually complete. The separate component design is in
`PHASE_2_PLAN.md`; no Web Component is implemented in this change.

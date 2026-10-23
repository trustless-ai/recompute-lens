# v0 limits and declared browser subset

- `ANCHORED_VERIFIED`: NOT_COVERED. There is no authenticated public-log
  provisioning, public publication check, freshness, non-equivocation, Bitcoin
  consensus or OpenTimestamps verification. Timestamp labels never verify time.
- External action execution, judgment truth, claim authorization, payment
  authorization and production permission: NOT_COVERED. An identity or inclusion
  result establishes none of these.
- RVR Core integration / a new normative RVR anchor profile: NOT_COVERED. ERC-8404
  remains the separate six-field receipt. No Core source or contract is changed.
- Browser support outside the actually executed Chromium version: NOT_COVERED.
  Ed25519 capability refusal is UNVERIFIABLE. No host signature verdict is used
  as a substitute. Firefox, Safari and independent reviewer machines require
  their own execution evidence.
- Independently authenticated deployment trust provisioning: NOT_COVERED.
  Configuration is explicitly selected separately, but the application cannot
  establish how the operator obtained it. Examples use publicly known test keys.
- Universal conformance, exhaustive mutation/guard coverage and security audit:
  NOT_COVERED. Multi-site admission removals demonstrate a combined boundary, not
  that each redundant guard alone can change a final verdict. The native-root
  fault control does not assert that upstream emits a wrong root.
- Side-channel resistance, denial-of-service analysis, cancellable worker
  execution and resource measurements beyond the 4 MiB/depth acceptance controls:
  NOT_COVERED. Large documents currently execute on the UI thread.

Two explicit restrictions beyond the #85 host adapter are versioned browser
admission choices: ReceiptOS proofs accept only `local-ed25519`, slot proofs only
`snapshot-digest`; slot siblings accept only literal `L`/`R`. The upstream checker
treats every non-R side as left. Browser witnesses demonstrate these refusals;
they are not relabeled as upstream conformance defects. All 49 published #85
projections remain unchanged.

`PROFILE_MECHANISM_UNSUPPORTED` is the intentional browser narrowing for a
validly authenticated but cross-labelled mechanism/profile pair. It is not a
claim that the #85 host adapter rejects the same input.

Malformed Merkle evidence retains each native algorithm's existing semantics.
ReceiptOS `verifyInclusion` returns a boolean, so an uppercase sibling hash or
invalid side can yield `REFUTED / MERKLE_INCLUSION_INVALID`. The slot checker
classifies those sibling-shape errors as `UNVERIFIABLE / SLOT_MALFORMED`.
Not every slot-format error is UNVERIFIABLE: canonical snapshot/newline and
position contradictions can instead be REFUTED. The separate review fixtures
record the exact distinctions; this change does not normalize native outcomes.

Unknown members in an otherwise validly signed policy body are currently
ignored by interpretation, while remaining covered by the policy identity and
signature. For example, `accept_any_root: true` grants no capability and does not
disable any verification. Unknown profile versions still fail closed. Required
known fields, selected authority and checkpoint-key uniqueness remain enforced.

The slot port uses the bridge's safe-integer/scalar domain, with bounded strict
JSON admission. It is not a general Python JSON/JCS compatibility layer. Subject,
policy and manifest canonicalization retain the restricted ReceiptOS domain;
they are not interchangeable with historical `receiptos-c14n-v0` identities.

Complete raw proof results are compared to independent expected projections.
Machine logs and UI rendering are additional browser evidence, not upstream
expected outcome fields. A malformed optional host report remains a diagnostic
MALFORMED result and cannot authorize or override a local proof.

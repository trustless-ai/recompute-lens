# Proposed #85 specification clarifications — not upstream changes

These editorial proposals follow Echo-Merlini's independent spec-only replay
reported at https://github.com/trustless-ai/recompute-lens/pull/2#issuecomment-6376143028.
They describe existing bounded behavior. They are not normative amendments,
have not been committed to recompute-kit, and do not alter ERC-8404.

1. In the slot proof-profile description, state explicitly:

   > For `invinoveritas.decision_receipt.slot_log.v1`, the selected
   > `checkpoint_id = SHA256(JCS(header)) = log_root`, represented as lowercase
   > hexadecimal. It is not SHA-256 of the entire serialized snapshot file.

   Slot leaves remain SHA256(JCS(line)); internal nodes remain SHA256 of the
   UTF-8 concatenation of two hex strings, with duplicate-odd pairing. This is
   distinct from ReceiptOS's domain-separated binary, count-bound Merkle root.

2. In the selected-policy result rules, state explicitly:

   > After authenticating the selected policy, an envelope whose `log_id` or
   > `checkpoint_id` contradicts it is REFUTED. A profile binding or mechanism
   > mismatch is UNVERIFIABLE because that verification relation is unsupported.

   Preserve exact native reasons and the separate `proof_validity` and
   `anchor_assurance` dimensions. The browser's additional supported
   mechanism/profile-pair restriction is local admission behavior, not a claim
   that the current #85 host implements the same extra restriction.

Neither proposal establishes public anchoring, public-authority authenticity,
external execution or downstream authorization. Those remain NOT_COVERED.

# recompute-lens

**Don't trust. Recompute.** — the human surface over [recompute-kit](https://github.com/trustless-ai/recompute-kit).

The kit verifies records for agents and CI. The lens does it **for people**: point it at a record + its primary source and *watch it re-derive*, step by step, in your browser — no server, no SDK, no trusted party. Part of [trustless-ai](https://trustless-ai.eth.limo).

## Design laws

- **Never a bare green.** A verdict is always shown as three things together: the **reproduction** (the legible rebuild), the **profile it verified under**, and the **`vantage_limitation`** caveat (integrity ≠ testimony). The checkmark is the by-product; the reproduction is the product.
- **Conformant, not trusted.** Each recipe is a conformant implementation of a pinned profile — it earns that by reproducing the profile's **golden vector** on load (a self-test you can see), exactly like any other port. It doesn't ask you to trust the lens; it proves itself against the published vector, then shows you every step so you can check by eye.
- **Browser-first.** Recompute runs on *your* machine (Web Crypto), so you're not trusting a backend either. Recipes that need chain state take a public RPC you can point anywhere.
- **Tri-state, honestly.** verified-good / verified-bad / **unverifiable** — "couldn't evaluate" is its own verdict, never dressed as a pass.

## Recipes

Pick a recipe from the dropdown, load its example (or paste your own record), and watch the console re-derive it line by line. Every recipe self-tests against its **golden vector** on load — the conformance badge reads "all N recipes conformant" only when each one reproduces its published vector in your browser.

**Native profiles**

| profile | what it verifies |
|---|---|
| `receiptos-c14n-v0` | ReceiptOS §2.8 `receipt_root` — `0x·sha256(C(strip_anchor(E)))`, JCS + top-level anchor-strip |
| `invinoveritas-witness-v1` | Composed-evaluator witness anchor — `sha256(body)` body integrity (not the signature) |

**recompute-kit ports** (each byte-exact vs the kit's `agent-flow.vectors.json`)

| profile | what it verifies |
|---|---|
| `wyriwe/raw` (ERC-8299 §45) | `raw_input_hash = keccak256(raw_user_input)` — the input-provenance leg |
| `wyriwe/pipeline` (ERC-8299 §46) | `sanitization_pipeline_hash = keccak256(utf8(cid) ‖ raw_input_hash)` |
| `name/keccak-binding` | `keccak256(utf8(label))` — a name→handle binding (not the 8004 agentId, not an ENS namehash) |
| `ens/namehash` (EIP-137) | `node = keccak(parent ‖ keccak(label))` over labels — the id ENS resolves |
| `8004/agent-id` (ERC-8004) | `agentId = bytes32(uint256(registryId))` — registry-assigned, left-padded (not a hash) |
| `scope/binding` | `scopeRoot = keccak256(abi.encode(merkleRoot, count))` — truncation-resistant |
| `8203/settlement-proof` | `verdictHash = keccak256(abi.encode(jobId, keccak256(utf8(resultText))))` — ConsultEscrow release |
| `8275/reputation` | `winRate = gated_wins / (gated_wins + gated_losses)` — the recomputable **input**, not the composite score |
| `8301/task-hash` | INITIAL-task `taskHash = keccak256(abi.encode(…7 fields…))`; empty `prevReplyHashes → keccak256(0x)`, not `bytes32(0)` |

Native recipes use Web Crypto (sha256); kit ports use [viem](https://viem.sh) (keccak256 / `encodeAbiParameters` / namehash) — all synchronous, all in-browser. Adding a recipe is one module + one registry entry; the UI is generic.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc + vite build
```

## Roadmap

- **RPC-backed recipes** — recipes that read chain state (on-chain anchor, value-fidelity, bond-standing) against a public RPC you point anywhere; same "show the reproduction" render.
- **`ruleset_version` binding** — display **"verified under profile X (content-hash …)"**; an unrecognized profile → `unverifiable` (per the group's ruleset-version spec).
- **Composed verdicts, tagged per input** — when a verdict consumes another layer's output (e.g. an ERC-8126 ZK standing score), tag each input `recomputed-legible` vs `verified-in-proof`. A composed verdict is only as legible as its least-legible input; the surface must never let a green imply end-to-end recompute when only one layer earns it.
- **Shareable re-check permalinks** — the recompute is itself pinnable → someone re-checks you.

Standards-family design note: the shared concept doc (`Human-Provable Recompute`) — https://gist.github.com/TMerlini/6c493cdd39a8f7dbf44090b126d649ca

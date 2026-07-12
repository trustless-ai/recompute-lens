# recompute-lens

**Don't trust. Recompute.** — the human surface over [recompute-kit](https://github.com/trustless-ai/recompute-kit).

The kit verifies records for agents and CI. The lens does it **for people**: point it at a record + its primary source and *watch it re-derive*, step by step, in your browser — no server, no SDK, no trusted party. Part of [trustless-ai](https://trustless-ai.eth.limo).

## Design laws

- **Never a bare green.** A verdict is always shown as three things together: the **reproduction** (the legible rebuild), the **profile it verified under**, and the **`vantage_limitation`** caveat (integrity ≠ testimony). The checkmark is the by-product; the reproduction is the product.
- **Conformant, not trusted.** Each recipe is a conformant implementation of a pinned profile — it earns that by reproducing the profile's **golden vector** on load (a self-test you can see), exactly like any other port. It doesn't ask you to trust the lens; it proves itself against the published vector, then shows you every step so you can check by eye.
- **Browser-first.** Recompute runs on *your* machine (Web Crypto), so you're not trusting a backend either. Recipes that need chain state take a public RPC you can point anywhere.
- **Tri-state, honestly.** verified-good / verified-bad / **unverifiable** — "couldn't evaluate" is its own verdict, never dressed as a pass.

## Recipes

| profile | what it verifies | status |
|---|---|---|
| `receiptos-c14n-v0` | ReceiptOS §2.8 receipt_root — `0x·sha256(C(strip_anchor(E)))`, JCS + anchor-strip | ✅ screen #1 (byte-exact on the §2.8 π golden vector) |

Mirrors the recompute-kit recipe of the same name; the §2.8 vector is the shared conformance anchor.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc + vite build
```

## Roadmap

- More recipes (task-hash, input-provenance, on-chain anchor) — same "show the reproduction" render.
- `ruleset_version` binding — display **"verified under profile X (content-hash …)"**; an unrecognized profile → `unverifiable` (per the group's ruleset-version spec).
- Shareable re-check permalinks (the recompute is itself pinnable → someone re-checks you).

Standards-family design note: the shared concept doc (`Human-Provable Recompute`) — https://gist.github.com/TMerlini/6c493cdd39a8f7dbf44090b126d649ca

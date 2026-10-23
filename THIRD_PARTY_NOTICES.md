# Browser recipe source boundaries

The repository's original CC0-1.0 dedication and `LICENSE` remain unchanged.
New composition, UI and test orchestration are CC0-1.0. Derived Apache-2.0
modules retain Apache-2.0; the root dedication does not relicense them.

| Source | Exact commit | Reused material | Grant |
| --- | --- | --- | --- |
| [recompute-kit](https://github.com/trustless-ai/recompute-kit/tree/b4537d73bda4e4df73c4b105ee516a43c351ba02/research/chain-neutral-receipt-anchor-proof-v0) | `b4537d73bda4e4df73c4b105ee516a43c351ba02` | Subject/envelope composition contract, full independent 49-vector corpus, schemas, public laboratory examples | CC0-1.0 |
| [ReceiptOS Verify](https://github.com/pipavlo82/receiptos-verify/tree/f39ac3b289be6baef1140c53976d525d8eb45c8c) | `f39ac3b289be6baef1140c53976d525d8eb45c8c` | `strict-json.js`, `common.js`, `capsule.js`, `manifest.js`, adapted from strict JSON/common/capsule/anchor modules | Apache-2.0, Copyright 2026 Pavlo Tvardovskyi |
| [invinoveritas](https://github.com/babyblueviper1/invinoveritas/tree/ce8c504f2ae4d9b389b53823fe16afec7fcf3bb3/examples/decision-receipt) | `ce8c504f2ae4d9b389b53823fe16afec7fcf3bb3` | `slot.js` port of the original Python checker; original 15 slot vectors | Apache-2.0, Copyright 2026 babyblueviper1 |
| [RVR Core](https://github.com/pipavlo82/recomputable-verification-receipts/tree/9dd36e882dd372f264b77b179130948aa5adcbde) | `9dd36e882dd372f264b77b179130948aa5adcbde` | Inspected/pinned six-field boundary; no RVR implementation or seventh field added | Apache-2.0 source reference |

ReceiptOS's four selected runtime files are byte-identical at PR85's historical
`ac82f93b81559b4da61ae766824bb5fcf54388f4` pin and the merged PR2 source above.
The historical pin is retained for native oracle execution. Neither its source
lock nor its older licensing statements are rewritten.

Changes to Apache modules: Node Buffer/hash/signature APIs become Uint8Array and
asynchronous Web Crypto; manifest algorithms and checks retain their original
order. Only the needed capsule operations are included. The Python slot checker
and PR85 bridge are ported to JavaScript in their bounded integer/scalar domain;
L/R sibling tags are explicit, rather than the native checker's non-R alias.
Trace rows expose actual computed values. No upstream source repository changes.

Full original licenses and ReceiptOS NOTICE are retained in `public/licenses/`
and copied by Vite into the distributable. ReceiptOS's NOTICE references other
upstream components for its own product; those unrelated components are not
imported by these browser ports. Installed npm packages retain their licenses.
Shared upstream work and review are not claimed as sole authorship.

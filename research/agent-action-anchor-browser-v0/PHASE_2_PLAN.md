# Phase 2: embeddable component (not implemented)

Begin after independent review of these browser recipes and their trust boundary.
Keep recipe execution reusable without React before adding an optional
`<recompute-lens>` wrapper. Do not change profile versions or proof algorithms.

1. Define an explicit component input API for original bytes, selected recipe,
   separately selected verifier configuration and optional diagnostic host result.
   Never infer authority from element content, URL parameters or proof metadata.
2. Define structured output events carrying the complete proof/assurance
   dimensions, native-port result, digests, capabilities and limitations. Rendering
   must not collapse them into a general authorization badge.
3. Isolate styles and lifecycle; add cancellation and stale-request protection,
   and assess a bounded Web Worker interface for large inputs. Specify CSP,
   offline use and any future optional user-controlled fetch policy explicitly.
4. Package ESM/custom-element entry points with CC0 and retained Apache notices.
   Test the actual distributed bundle in independent host pages without silently
   obtaining trust from the embedding page's untrusted proof content.
5. Reuse this corpus and mutation campaign, add lifecycle/accessibility and
   cross-browser tests, then request separate review. Do not introduce public
   anchoring, execution or authorization guarantees through the component API.

No Web Component, registration, embedding API, repository transfer or production
deployment is part of this PR.

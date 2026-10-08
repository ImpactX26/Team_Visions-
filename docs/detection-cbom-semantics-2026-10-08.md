# Detection and CBOM semantics — 8 October 2026

Implemented in the working copy and activated on the local API. No migration, commit, push or deployment. Persistent local counts remained 62 scans, 14,243 findings and zero analyst reviews across restart. Private configuration and the original presentation copy were preserved.

## Bounded Node crypto detection

`.js` and `.ts` now use a Tree-sitter syntax collector instead of the generic text rules. Parser/runtime grammars are pinned and hash-locked: tree-sitter 0.25.2, tree-sitter-javascript 0.25.0 and tree-sitter-typescript 0.23.2. Python parser wheels also work in the backend without requiring Node or executing scanned code. Scanner identity now records their installed versions; scans made with different parser profiles are incompatible for comparison.

Supported bindings: Node `crypto`/`node:crypto` ES default, namespace and named imports; direct CommonJS requires and destructured requires; selected immutable identifier aliases. Supported APIs: createHash, createHmac, createCipheriv, createDecipheriv, generateKeyPair/Sync, createECDH and createDiffieHellman. Literal selectors and bounded immutable literal aliases establish supported digest families, AES key sizes/modes, ChaCha20-Poly1305, key types and selected literal key options. HMAC remains distinct from its underlying digest. Key generation retains unknown usage rather than implying signing or encryption. Dynamic/unrecognized digest, cipher and key-type selectors produce an explicit UNKNOWN finding for a verified API binding.

Scopes account for parameters, catch/loop bindings, block declarations, var hoisting, duplicate bindings, type-only imports and binding/property writes. Comments, unrelated strings, bare API names and unrelated/shadowed objects do not establish Node operations. Options with spreads or duplicate keys do not establish those parameters. Source arguments, keys, IVs, messages and source snippets are not retained by this collector.

Reads retain the configured file limit. Parsing has a two-second progress cutoff and traversal a four-second/200,000-node ceiling. Syntax errors and dynamic eval/with scopes fail the file and cannot establish comparison processing proof. They are not reported as successful clean scans. Existing aggregate file/evidence/worker limits still apply.

This is a static call-site detector, not proof of runtime execution or a full JavaScript dataflow engine. WebCrypto, third-party APIs, dynamic imports/selectors, computed API access and interprocedural mutation/flow remain outside this slice. JS/TS fallback comparison across edited files still abstains; unchanged-file evidence matching remains supported. Third-party patterns formerly reported by generic JS/TS rules are no longer routed through that collector. This trades that heuristic coverage for the named semantic scope; it does not establish a general recall improvement. Dependency manifests continue to provide capability evidence.

## Native CycloneDX 1.6 subset

Interactive JSON, standalone full JSON and CSV component types share one mapper. Supported findings become `cryptographic-asset` components with native `cryptoProperties`; evidence, review, provenance, risk and other inventory fields remain in ECDAT properties. There is still one component per finding and a unique `ecdat:asset:<id>` reference, including unknown/unmapped findings retained explicitly as data records.

Algorithm mappings distinguish hashes, HMAC MACs, block ciphers, authenticated encryption, stream ciphers, signatures/public-key encryption when usage establishes the role, key agreement and KDFs. AES mode and parameter-set identifiers come from evidence; SHA digest sizes come from named variants. Node HMAC-SHA-256 is named separately from SHA-256. Node key generation maps to the keygen function with primitive unknown when purpose is unresolved. Runtime execution, certification, platform and security levels are not inferred. Conflicting evidence cannot establish a mode.

TLS/SSH/IPsec/IKE map to protocol type without invented versions or cipher suites. Certificate findings with parsed certificate evidence map to certificate assets with available validity and full subject/issuer distinguished names. Newly collected certificates retain those names; legacy CN-only evidence does not become a full distinguished name. Certificate signature/public-key relationships, library dependencies, key material/lifecycle and complete interoperable graph modelling are outside this mapping. References are omitted rather than fabricated; the validator rejects dangling native algorithm/certificate references in addition to duplicate component and dangling dependency references.

The full export continues to validate offline against the checksum-pinned official schema and reject size/count/schema failures rather than truncate. Schema validity is separate from semantic completeness. The page's small required-field check is now labelled “Page structure / Required fields present”, replacing its misleading “Valid CycloneDX” claim. The UI shows native primitive, mode and parameter set alongside the actual algorithm name and explicit partial-mapping limitations.

## Verification

- Final release gate: 579 backend tests and 95 subtests passed, four Windows skips, one existing Starlette/AnyIO deprecation; 46.47 seconds. An earlier run failed the existing 500-file benchmark at 61.1 seconds. The bounded reader now requests verified file size plus one byte rather than an 8 MiB buffer for every tiny source file; growth detection and the original benchmark threshold remain enforced.
- Final frontend: 118 tests across 18 files; formatting, ESLint, TypeScript and production build passed. Existing JS/CSS/gzip budgets were preserved.
- Chromium: 58 tests passed without retries; final CBOM page checks rerun across responsive viewports after the label correction.
- Ruff, incremental mypy (109 source files), Bandit high-severity scan and dependency consistency passed. Hash-locked Python audit and full npm audit report no known vulnerabilities.
- Disposable real API/worker/browser rehearsal: TS hash/HMAC/AES/keygen operations and one unresolved selector; JS negative file clean; native semantic assertions; no secret argument in exported output; complete downloaded file validated offline; 375px layout; no browser/API errors; same native components after API restart.
- Existing real scan/risk edit/analyst review/history/export/restart rehearsal also passed, preserving scanner evidence and exporting all 68 controlled findings.

Manually labelled tests are regression evidence, not a new independent repository-separated holdout. Previously consumed frozen-corpus and legacy RuleCollector evaluations do not certify this new detector's precision/recall. Independent field evaluation, broader language/library semantics and full CBOM relationship interoperability remain separate work; no 95% detection accuracy claim is made.

Evidence logs: `docs/verification/detection-cbom-semantics-2026-10-08/`. Reproduce with `scripts/verify_release.ps1`, `npm run test:e2e` in dashboard, and `python scripts/rehearse_local_baseline.py --semantics` / `--browser` separately. The rehearsals create disposable databases and source fixtures and remove them afterward.

Primary references consulted: [Tree-sitter Python binding API](https://github.com/tree-sitter/py-tree-sitter), [TypeScript grammar](https://github.com/tree-sitter/tree-sitter-typescript), [Node crypto API](https://nodejs.org/api/crypto.html), and the pinned local official [CycloneDX 1.6 schema](../schemas/cyclonedx/1.6/bom-1.6.schema.json). Parser syntax, API semantics and schema validity are distinct verification concerns.

# Reliable local scan comparison — 8 October 2026

Implemented and activated locally. Open Scan history → Compare scans, enter an earlier baseline scan ID and a current scan ID, then inspect evidence links and complete paginated group counts. Existing scans remain intact; scans without the new identity/processing metadata require fresh scans.

## Snapshot and compatibility contract

Migration `0010_scan_comparison` adds a JSON metadata column to scan jobs, defaulting legacy rows to an empty map. New scans record a versioned comparison contract, hashed canonical local repository root, scan profile/file-size limit/correlator, Python and cryptography versions, scanner source fingerprint, optional Git branch/revision hints, and a per-supported-file processing manifest. Snapshot IDs hash that manifest; they are file observation identifiers, not Git commits or an atomic filesystem snapshot.

File content is fingerprinted around collection and checked again after collection. Collector failures, skipped files, absent paths, unreadable fingerprints and detected file changes do not establish processing proof. No source text is retained in the manifest. The scanner remains bounded by its existing file/evidence/resource limits. Extra hashing and bounded Python parsing add work; no performance improvement is claimed.

Repository identity is local to the canonical scan root. Copies at different roots are incompatible. Git hints come from the nearest recognized ancestor repository without executing repository-controlled Git configuration. Git worktree pointer files and unreadable/unrecognized branch metadata cause explicit refusal. Source profile, parser/runtime versions, scanner fingerprint and branch must agree. Identity changes detected during scanning also cause refusal. These checks do not replace a frozen repository checkout or OS sandbox.

## Matching contract: ecdat-comparison-v1

- Unique named Python assignment contexts and function return contexts use hashes of file, enclosing qualified scope and context, independent of line numbers and algorithm state. Algorithm/key-size/context changes can therefore appear as changes to the same bounded occurrence context. Nested or repeated candidates sharing that context stay ambiguous.
- Unique normalized evidence signatures can match in unchanged files. Collector UUIDs and location telemetry are excluded; substantive evidence is retained. Resembling evidence in an edited file without a stable context stays Unknown.
- Duplicate candidates and collector-marked ambiguous findings are never arbitrarily paired. File renames are not inferred; function/variable context renames are unmatched under this contract. General dataflow and stable semantic matching for other languages are deferred.
- Changes include cryptographic parameters, normalized evidence, confidence/conflict and currently saved business/risk inputs. Risk context is mutable: comparison reads the saved values together, rather than claiming a historical immutable score. Review decisions are shown on their original findings and are not copied to the current scan.

## Classification and API

`GET /api/scans/compare?baseline_id=...&current_id=...&limit=50&offset=0&status=...`

| State | Meaning |
| --- | --- |
| Added | A finding is observed now in a file successfully revisited in both scans. |
| Changed | A unique supported correspondence has different evidence, parameters or saved risk context. |
| Unchanged | A supported correspondence has no compared field changes. |
| No longer observed | Prior evidence was not observed in the successfully revisited file; remediation is not verified. |
| Ambiguous | Multiple candidates share the match context/signature, or the collector records ambiguity. |
| Unknown | Processing/identity/correspondence is insufficient, including deleted, renamed, newly introduced, excluded, failed or changing files. |

Counts describe comparison groups. Ambiguous groups can contain several findings; original finding totals are returned separately. Filtering and pagination preserve complete totals. The maximum page is 200 groups; comparisons exceeding 10,000 findings per input fail explicitly with 413, without truncated results. Same/reversed scan IDs or invalid selectors return 422; missing scans 404; active/incompatible/legacy scans 409. Failed/cancelled scans without retained identity metadata are refused; retained partial processing cannot establish disappearance.

Metadata, full finding rows and editable risk context are read in one bounded joined database statement. Supported dialects are SQLite/PostgreSQL; unsupported dialects fail explicitly. Existing signed authentication protects the endpoint; viewers and auditors can compare. The feature writes no reviews, suppresses no findings, and changes no detection-accuracy labels.

## Verification

- Final release verifier: PASS, exit zero.
- Backend/API/scanner: **494 tests + 95 subtests passed**, four Windows platform skips, 85.02 seconds. Includes moved lines, changed algorithms, ambiguity, processing drift, parsing failures, incompatible roots/profiles/versions/branches, role access, legacy metadata, >200-item pagination, bounds and migration preservation/downgrade.
- Frontend: **117 tests in 18 files passed**; comparison evidence links, server-side filtering/pagination, compatibility errors and no-scan dashboard behavior covered.
- Full Chromium: **58 passed without retries**, 57.2 seconds.
- Real browser/API: baseline scan → inserted lines and MD5-to-SHA-256 source change → rescan → evidence-linked comparison passed. Filtering, 375px layout, no browser/API errors and exact comparison results across API restart passed. Disposable source, database and services cleaned up.
- Python compilation, dependency consistency, Ruff, incremental mypy, formatting, ESLint, TypeScript/build budgets, diff checks: PASS. Full npm audit: zero vulnerabilities.

The live rehearsal initially exposed a premature dashboard evaluation request before any completed scan existed. Dashboard now waits for the summary and fetches evaluation only for its selected completed scan; a regression covers the empty state. The strict live error check was retained. The rescan rehearsal also now waits for completed progress and resets through the real New scan control. A moved-line regression caught randomly generated collector IDs being compared as evidence; those IDs are excluded from matching.

The lazy comparison page adds about 5.2 KB of JavaScript over analyst review. The explicit JavaScript budget is now 820 KB (measured about 817.7 KB); CSS remains 156 KB and gzip remains 500 KB. No general accuracy, remediation or enterprise-readiness claim follows from these controlled examples. A non-failing Starlette/AnyIO deprecation warning remains.

Evidence: [final release](verification/scan-comparison-2026-10-08/comparison-release-final.log), [browser](verification/scan-comparison-2026-10-08/comparison-browser-final.log), [live comparison/restart](verification/scan-comparison-2026-10-08/comparison-live-conservative.log), [final frontend](verification/scan-comparison-2026-10-08/comparison-frontend-final.log), [focused contracts](verification/scan-comparison-2026-10-08/comparison-final-contracts.log), [initial live failure diagnosis](verification/scan-comparison-2026-10-08/comparison-live-diagnosis.log).

## Local activation

The working-copy SQLite database was backed up with SQLite's backup API to gitignored `.runtime/scan-comparison-pre-migration-20261008.sqlite`, then migrated. No active scans were present; scan, finding and review counts were verified unchanged. Only the identified working-copy API was restarted. `/ready` reports `0010_scan_comparison`; the comparison endpoint is registered and frontend `/compare` returns HTTP 200.

The original presentation copy and existing user work were preserved. No synthetic verification scans/reviews were added to persistent user data, and no old snapshot metadata was invented. Docker/PostgreSQL deployment and hosted operation were not rerun for this feature. No commit, push or deployment was performed.

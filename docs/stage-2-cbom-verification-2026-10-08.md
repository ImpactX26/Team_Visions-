# Stage 2 — complete validated CBOM export

Status: PASS for backend scope, 8 October 2026. Backend implementation and verification only; frontend belongs to the user's friends. Original SIH project, production databases and private configuration were preserved. No migration, deployment or push.

## Reproduction and contract

Pinned official schema validation reproduced rejection of the current `/api/cbom` response's UI-only top-level pagination. A new export regression failed with 404 before implementation. The old paginated API remains unchanged.

New `GET /api/exports/cbom?scan_id=...` returns all stored findings from a completed scan in a standalone schema-validated document. It includes safe evidence, confidence, risk context/provenance and processing-gap metadata. Empty scans are valid; scans beyond 10,000 findings or 32 MiB fail with 413 instead of truncating. A single SQL statement captures scan metadata and complete finding rows, including risk edits. A real concurrent SQLite WAL writer test verified old score/provenance consistently in the export and new values in the database. Unsupported database dialects fail explicitly.

Full contract and mapping: `cbom-export-contract.md`. The current `library`/ECDAT-properties mapping is retained and explicitly labeled; native cryptographic-asset/cryptoProperties mapping is deferred as planned. Schema validity does not certify native crypto semantics or discovery completeness.

## Schema and environment

Official BOM/SPDX/JSF schemas and license are pinned from CycloneDX/specification ref 1.6, commit `55343ba19dee1785acf1ce9191540d5fd7b590db`, with checksums/source URLs. Local-only registry resolution is tested with network connections forbidden and a real SPDX reference. Invalid type/version/license values, duplicate identifiers and dangling dependency refs fail.

Added validator `jsonschema==4.26.0` and its four required dependencies. The existing lockfile gains hashes only for those additions; existing versions were preserved. Python 3.11 constrained resolution matched all 78 locked package versions exactly. Docker copies the schema directory. Docker/PostgreSQL execution was not performed.

## Verification evidence

- First combined gate: 457 passed, four Windows skips, 95 subtests, 57.65 seconds.
- Final focused export/offline suite passed, including empty/251-item completeness, scan selection, redaction, caps, reference checking, and concurrency.
- Live migrated SQLite/API rehearsal passed: readiness, signed login, 9/9 fixture files, 68 findings, risk edit/reload/reports, then all 68 CBOM components validated offline with edited risk/provenance retained. Process tree stopped, database removed; no demo directories remained.
- Saved-file validator CLI passed on a standalone empty document. No independent native CBOM consumer was available/tested.
- Ruff passed on affected Python code; dependency lock resolution passed.

During the final repeat, three setup failures exposed a test-fixture race: StaticPool sessions shared one SQLite connection with background reconciliation. A direct reproduction showed an unrelated reader seeing an uncommitted row and deleting it by rollback. Both API fixture sets now use disposable file SQLite databases with independent connections and foreign keys enabled on every connection. Two regression tests check transaction isolation; affected pagination/export/risk tests passed 30/30. No production watchdog behavior or foreign-key constraints were disabled.

Final combined gate: **460 passed, four Windows skips, 95 subtests passed; 58.73 seconds.** Known Windows resource/permission/symlink skips and the existing Starlette/AnyIO warning remain. Frontend checks were not rerun or changed. Hosted delivery, PostgreSQL runtime and native cryptographic mapping remain separately unverified.

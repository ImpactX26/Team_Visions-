# ECDAT system verification — 8 October 2026

**Local and Docker/PostgreSQL functional verification: PASS. Full release gate: FAIL at the development dependency advisory audit.**

Verified only `C:\Users\Tishan Kumar B\Desktop\ECDAT-SIH-Working`, including the current glass frontend. HEAD was `2a206b598428bfe051f4be9da8c8ebbfdb7be226`, with existing uncommitted work preserved. Original SIH files, persistent application data and private configuration were not edited. No commit, push or hosted deployment was performed.

## Fresh results

| Check | Result |
| --- | --- |
| Python compilation | PASS |
| Backend/API/scanner tests | 460 passed; 95 subtests passed; four platform skips; 60.69 seconds |
| Python dependency consistency | PASS |
| Python Ruff | PASS, including the updated Compose verifier |
| Frontend formatting, ESLint | PASS |
| Frontend unit tests | 106 passed, 16 files |
| TypeScript/Vite production build | PASS, unchanged bundle budgets |
| Full Chromium responsive/workflow suite | 58 passed; 1.4 minutes |
| Positive/negative/mixed-risk controls | PASS: 12 / 0 / 12 findings, exact labelled algorithm sets, offline CycloneDX schema validation |
| Live browser/API integration | PASS: migrated disposable SQLite, real supervised workers, nine of nine fixture files processed, 68 findings |
| Risk edit and exports | PASS: evidence/confidence/provenance preserved, reload, risk JSON/CSV, complete 68-finding CBOM schema validation |
| API restart persistence | PASS: exact edited finding persisted |
| Current UI routes/mobile | PASS: inventory, detail, report, graph and 375px CBOM; no browser/API errors |
| Docker/PostgreSQL smoke check | PASS after runtime-mount fix: three real scans, PostgreSQL queries and backend restart/persistence rounds |
| Deployment contract checks | Two passed after the Compose change |
| Running development servers | Backend ready, database reachable, schema revision `0008_scan_admission`; frontend HTTP 200 |
| Python locked dependency audit | Zero known vulnerabilities |
| Production npm dependency audit | Zero findings |
| Full npm dependency audit | FAIL: two high-severity development packages, `brace-expansion` and `source-map-js` |
| Disposable deployment cleanup | PASS: verifier containers/networks/database volumes removed; disposable SQLite runs and task-owned pytest directories removed |

The Python suite emitted a non-failing Starlette/AnyIO deprecation warning. Platform skips are not passed tests. These fixtures validate labelled examples and processing behavior; they do not establish general detector accuracy.

## Failures found and disposition

The initial Python suite could not create fixtures under Windows' shared `pytest-of-Tishan Kumar B` temporary directory. It ended with 376 passes and 84 setup errors. A separate first-failure run confirmed `WinError 5` in `tmp_path_factory`, before application test execution. Running the release script with `PYTEST_ADDOPTS` pointing to a new, uniquely named workspace temporary directory produced the passing backend result above. The default shared-temp permission problem was not modified outside this working copy.

The first two Docker runs started healthy services but failed when the scan supervisor created `/app/.runtime` on a read-only filesystem. Fixed `docker-compose.yml` by mounting a dedicated 16 MiB tmpfs there, owned by the existing application UID/GID 10001, mode 0700, with `noexec,nosuid,nodev`. The root filesystem remains read-only and all existing capability, privilege and resource restrictions remain. The final three-round Compose run passed. `scripts/verify_compose.py` now captures bounded backend diagnostics with generated credentials redacted before it removes its own temporary stack.

The release script passed compilation, backend tests, dependency consistency, frontend formatting/tests/lint/build, then exited one at the full npm audit. Dependencies were not upgraded during verification. This is a release-gate failure, despite passing functional checks.

## Remaining limits

- Resolve the two development dependency advisories before calling the complete release gate green.
- The unfamiliar-presenter trial remains pending at the user's explicit request.
- The previously documented legacy unknown-provenance UI label remains a limitation; exports preserve provenance distinctions.
- Hosted deployment and native CycloneDX cryptographic-asset mapping remain outside this verification. Docker/PostgreSQL is now freshly verified locally.
- Earlier Lighthouse/performance scores describe a preceding frontend theme; this run does not certify glass-theme field performance.

## Evidence

Raw evidence is under [verification/system-glass-2026-10-08](verification/system-glass-2026-10-08/release-gate-isolated.txt): release gate, first-failure diagnosis, full Chromium output, real browser workflow and screenshots, control exports, final Compose output, redacted failure diagnostics, audit JSON, lint/deployment checks and running-server readiness.

The development servers remain on ports 3000 and 8000. Container tests used isolated loopback ports 18080/18081 and randomly named verification projects; they never targeted the regular ECDAT Compose database.

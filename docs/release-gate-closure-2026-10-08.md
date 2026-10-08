# Dependency release gate closure — 8 October 2026

The project release verifier passed after compatible transitive dependency patches. Full and production npm audits report zero vulnerabilities; the locked Python audit reports no known vulnerabilities.

## Change

Only five package-lock entries changed: three copies of `brace-expansion` 1.1.18 → 1.1.21, one copy 5.0.9 → 5.0.12, and `source-map-js` 1.2.1 → 1.2.2. Direct dependency declarations, application code and backend dependencies are unchanged. The original two high-severity package findings were reproduced against the npm advisory service before repair. Compatible updates used `npm update brace-expansion source-map-js --ignore-scripts`; no forced major upgrades or advisory suppression were used.

The initial browser run passed 57 tests and timed out in the iPad navigation test. Its URL assertion preceded React's rendered destination and navigation-close synchronization. The test now waits for the CBOM heading and the hidden navigation before reopening it, then asserts visible navigation. The original failure is retained in evidence; final browser results are recorded below.

## Verification

- `scripts/verify_release.ps1`: PASS, exit zero.
- Python compilation and dependency consistency: PASS.
- Backend: 460 passed, four Windows platform skips, 95 subtests passed; 59.52 seconds. One non-failing Starlette/AnyIO deprecation warning.
- Frontend: 106 tests passed across 16 files; formatting, ESLint, TypeScript/Vite production build and existing bundle budgets passed.
- Full npm audit and production npm audit: zero vulnerabilities.
- `pip_audit -r backend/requirements.lock --require-hashes --strict`: no known vulnerabilities, exit zero.
- `npm ci --ignore-scripts --dry-run --offline`: PASS; this checks install planning, not a fresh installed environment.
- Formatting after browser-test synchronization and `git diff --check`: PASS.
- Final full Chromium suite: 58 passed in 51.5 seconds, exit zero, without retries. See [final browser output](verification/release-gate-patches-2026-10-08/release-gate-20261008-browser-final.log).

The first sandboxed attempts could not reach the registry/local browser server and stalled after Python runtime warnings. The release verifier and browser runner were rerun with required access. Pytest used a uniquely named workspace basetemp to avoid the documented shared Windows temp ACL problem.

Evidence: [release output](verification/release-gate-patches-2026-10-08/release-gate-20261008-full.log), [full npm audit](verification/release-gate-patches-2026-10-08/release-gate-20261008-audit.json), [production npm audit](verification/release-gate-patches-2026-10-08/release-gate-20261008-production-audit.json), [Python audit](verification/release-gate-patches-2026-10-08/release-gate-20261008-python-audit.log), and [initial browser failure](verification/release-gate-patches-2026-10-08/release-gate-20261008-browser-full.log).

This closes the reproduced dependency blocker for the local release verifier. Hosted deployment, remote CI, a fresh clean installation, and the previously deferred unfamiliar-presenter trial are not certified by this run. Docker and real-API persistence were not repeated for these development dependency patches; their previous evidence remains in [system verification](system-verification-2026-10-08.md). No commit, push or deployment was performed. User files, private configuration and persistent application databases were preserved.

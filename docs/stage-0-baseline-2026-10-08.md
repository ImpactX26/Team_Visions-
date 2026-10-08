# Stage 0 — baseline preservation and reproduction

Status: PASS, 8 October 2026. Delivery selected: native local. Frontend is owned by the user's friends and was not changed in this stage.

## Preserved baseline

Working directory: `C:\Users\Tishan Kumar B\Desktop\ECDAT-SIH-Working`. Original: `C:\Users\Tishan Kumar B\Desktop\SIH\ECDAT-SIH`; read-only inspection only. Existing deletions, modifications, untracked work, private configuration and persistent databases were preserved. No restore/reset, commit, remote change or push occurred.

Branch: `fix/sha1-recommendation`. HEAD: `8532dbc99378a4e77e9a7d0b4ece391fd889d655`. Origin remains `https://github.com/tishanbrijesh-rgb/ECDAT-SIH.git`; it is not the unknown organizer submission destination.

`baselines/2026-10-08-step0/` records Git status, baseline metadata, and a 453-entry manifest of tracked/untracked nonignored paths with size/SHA-256 or missing status. This is a review fingerprint, not a content backup or claim of exclusive authorship. Ignored secrets, databases, dependencies and caches are not captured. Concurrent edits after capture can be distinguished from the recorded snapshot. Do not attribute all pre-existing changes to this plan.

## Fresh reproduction

The existing Python environment was reused without upgrades. `scripts/rehearse_local_baseline.py` provides a repeatable disposable rehearsal: random temporary credentials, migrated SQLite, loopback API on a temporary port, explicit allowlisting of `test-repo`, readiness, authenticated login, scan completion and history inspection. Run from the working root with `.venv\Scripts\python.exe scripts/rehearse_local_baseline.py`.

Fresh result: migration/readiness passed; admin login passed; scan completed with 9/9 files, 68 findings, 100% supported-file processing coverage; history passed. Final rehearsal exited zero and removed its disposable database directory after stopping the API process tree. No `tmp/demo-*` folders remained.

First attempt reproduced a transient Windows database-handle cleanup failure after successful scanning. The rehearsal now retries cleanup for up to five seconds after process termination and raises if cleanup still fails; the repeat passed. The preserved script adds no production API behavior.

## Scope and gate evidence

Bundled integration fixture: `test-repo` (Python, Java, dependency manifests, X.509 certificates and ambiguity/blind-spot examples). Additional demonstration fixtures: `demo-repositories/positive-control`, `negative-control`, and `mixed-risk`, each with expected findings. Those three were located, not freshly scanned in this stage.

Collector registry is the source of truth: Python AST plus source pattern collectors, six dependency manifest/lockfile formats, and PEM/CRT/CER certificates. Source profiles exclude dependency/build/cache/environment directories, linked paths are excluded, and oversized files count as processing failures. Pattern matching in other languages does not establish full semantic analysis. Processing coverage is not detection accuracy.

The immediately preceding backend gate passed 440 tests, four Windows skips and 95 subtests in 56.09 seconds; changed Python files passed Ruff. See `backend-risk-edit-verification-2026-10-08.md`. This stage did not rerun frontend checks; earlier frontend/browser evidence is historical and friends may have changed those files since.

Hosted delivery, PostgreSQL/Compose, fresh dependency advisory checks, and complete live-browser/API rehearsal remain unverified. Missing Render files were not imported from the original. Stage 1's narrow risk fix is already implemented; its broader manual edit/reload/report and remaining required regressions must be checked before declaring the entire stage complete. Stage 2 remains planned.

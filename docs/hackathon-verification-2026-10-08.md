# Hackathon reliability pass — 8 October 2026

Scope: the Desktop working copy only. Original project, remotes, submission repository, private configuration, and existing databases were preserved.

## Changes

- Login identity subtitle uses the readable 12px typography token.
- Confirmation dialogs focus Cancel immediately after mounting, preserving keyboard trapping and focus restoration.
- Release verification runs the complete pytest groups rather than only unittest discovery, and includes frontend unit tests and lint.
- Export query metadata uses an Annotated parameter while preserving repeated `ids` query behavior.
- Corrected scan-admission test import order and login-page formatting.
- Ignored local frontend temporary test files.

## Fresh verification

| Check | Result |
|---|---|
| Combined `tests/ backend/tests/` pytest suite | 435 passed, four skipped, 95 subtests passed; 55.94 seconds |
| Export/admission regressions after annotation/import changes | 17 passed |
| Frontend unit suite | 102 passed across 16 files |
| Frontend lint and formatting | Passed |
| Production TypeScript/Vite build and size budgets | Passed |
| Python Ruff check over backend/scanner/scripts/tests | Passed |
| Chromium browser workflows | Final run 58/58 passed; 1.9 minutes |
| Real local API rehearsal on disposable migrated SQLite | Readiness, authenticated login, scan submission/completion, and history passed |
| Bundled fixture scan | Nine of nine supported files processed, 68 findings, 100% processing coverage |
| Rehearsal cleanup | Temporary API process tree stopped and database directory removed; final rehearsal exited zero |

The four backend skips correspond to Windows resource-module, permissions, or symlink limitations. A Starlette/AnyIO deprecation warning remains. Python's restricted environment hung creating an event-loop socket; API tests and browser tests ran outside that restriction. Temporary test directories were kept inside this copy.

The first browser run had one sign-in timeout (57/58 passed). The complete repeat passed without test changes. The underlying intermittent cause was not established, so one clean repeat is not proof of long-term stability.

The first real rehearsal used an invalid configuration value; correcting the temporary harness to `local` restored readiness. Windows virtual-environment launcher children initially retained the disposable database after the parent was terminated. Explicit process-tree cleanup fixed the rehearsal harness, and the repeated scan and cleanup passed.

## Remaining boundaries

- Browser tests mock backend responses. The separate real-API rehearsal proves the scan/history flow, not every browser interaction against a live API.
- Render configuration and wrapper files are absent in this copy. They were inspected in the original but not blindly imported: this copy lacks the original's public-demo configuration support. Hosted deployment still needs integration and validation.
- No fresh dependency advisory audit, full authenticated axe audit, PostgreSQL/Compose rehearsal, hosted-service check, or new accuracy benchmark was performed in this pass.
- Coverage is supported-file processing, not cryptographic detection accuracy.
- Organizer submission repository has not been supplied; no push or submission occurred.

Next priorities: add a consistent hosted deployment for this copy, verify its access model and real-browser/API workflow, then prepare the short judge demonstration and offline fallback.

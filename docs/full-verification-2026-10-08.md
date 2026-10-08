# ECDAT Steps 0–3: full verification, 8 October 2026

**Functional local verification: PASS. Full release gate: FAILED at the dependency advisory audit. Stage 3 human acceptance: PENDING at the user's request.** No hosted or PostgreSQL certification is implied.

Verified working copy: `C:\Users\Tishan Kumar B\Desktop\ECDAT-SIH-Working`. Git HEAD during verification: `2a206b598428bfe051f4be9da8c8ebbfdb7be226`, with existing uncommitted changes preserved. The original SIH project, persistent application databases, frontend dependency files and unrelated untracked work were not modified. No commit or push was made by this pass.

## Fresh results

| Gate | Result |
| --- | --- |
| Python compilation: backend, scanner, scripts, tests | PASS |
| Combined backend/API/scanner tests | 460 passed, four platform skips, 95 subtests; 57.34 seconds |
| Python dependency consistency | PASS, no broken requirements |
| Ruff: backend, scanner, scripts, tests | PASS |
| Frontend formatting | PASS |
| Frontend unit tests | 104 passed, 16 files |
| Frontend ESLint | PASS |
| TypeScript/Vite production build and unchanged size budgets | PASS |
| Full Chromium suite on final application | 58 passed, 1.6 minutes; exit zero |
| Three live demo control scans | PASS: positive 12 findings, negative zero, mixed-risk 12 |
| Control processing checks | Zero failed files; every in-scope file successfully processed |
| Complete control exports | Exact labelled algorithm sets, all stored findings included, official offline CycloneDX schema valid |
| Previously saved offline demo exports | All three revalidated: 12, zero, 12 components |
| Live browser/API workflow | PASS; real workers and migrated disposable SQLite |
| API restart persistence | PASS; exact edited asset/evidence/context preserved |
| Temporary process/database cleanup | PASS; no rehearsal `tmp/demo-*` directories remained |
| Python locked dependency audit | 78 dependencies; zero known vulnerabilities |
| Production-only npm audit | Zero findings |
| Full npm audit | FAIL: two high-severity development dependency packages |
| Browser-script syntax and Git whitespace checks | PASS |

The backend run produced one non-failing Starlette/AnyIO deprecation warning about the BlockingPortal alias. Four platform skips remain separate from passed tests; unsupported platform behavior is not certified by those skips.

## Real integration evidence

The fresh browser rehearsal verified signed login, actual scan submission and worker completion, nine of nine bundled files processed with 68 findings, a persisted risk edit and reload with unchanged evidence/confidence and unrelated provenance, inventory/scan/detail/report/graph routes, and an authenticated complete CBOM download containing all 68 findings. The downloaded file validated against the pinned offline CycloneDX 1.6 schemas. The 375px CBOM view had no horizontal overflow. No browser errors or failed API responses were recorded. Restarting the API against the same disposable migrated database preserved the exact browser-edited asset. The temporary API process tree and database were removed.

The browser suites use Vite's development server. Production compilation and bundle-size budgets passed separately; no deployed production server, hosting or PostgreSQL execution was tested.

## Verification harness improvements

Pack generation now scans only its three controls, avoiding an unnecessary bundled fourth submission against the fixed three-scans-per-five-minutes admission policy. The separate browser rehearsal checks the bundled fixture in its own disposable instance. No API limit or authentication behavior was weakened. The control verifier now rejects successful-looking scans with failed or unprocessed in-scope files. These final script changes passed Ruff and the fresh control/browser rehearsals.

Commands:

```powershell
./scripts/verify_release.ps1
npm --prefix dashboard run test:e2e
.venv\Scripts\python.exe scripts/rehearse_local_baseline.py --demo-pack tmp/full-verification-controls
.venv\Scripts\python.exe scripts/rehearse_local_baseline.py --browser --screenshots tmp/full-verification-screenshots
```

The release script passed its compilation, tests, consistency, formatting, frontend tests, lint and build stages, then exited one at `npm audit`. This is a reproduced release failure, not an all-green result. The Python audit initially encountered sandbox DNS failure and passed after network-enabled retry. Neither dependency audit changed installed versions or lockfiles.

## Open items

1. **Development dependencies:** full npm audit flags brace-expansion and source-map-js at high severity. Production-only audit has zero findings. Updates remain with the frontend team under the current ownership boundary. See raw audit evidence and the earlier [integration report](integration-verification-2026-10-08.md).
2. **Human presentation trial:** the user explicitly asked to keep it pending. The [three-minute walkthrough](impactx-demo.md), exports and screenshots are prepared, but Stage 3's unfamiliar-presenter exit is not yet satisfied.
3. **Existing provenance label limitation:** the frontend labels legacy unknown provenance as `Policy default`. Exported provenance retains the distinction. The walkthrough documents it; frontend correction was not authorized under the narrow CBOM exception.
4. **Separate scope:** hosted delivery, PostgreSQL rehearsal and native CycloneDX cryptographic-asset mapping remain unverified/deferred. Static control outcomes and processing coverage do not establish general detector accuracy or enterprise readiness.

## Saved evidence

Raw gate output and fresh audit JSON are preserved under [verification/full-2026-10-08](verification/full-2026-10-08/release-gate.txt), including `chromium.txt`, `controls.txt`, `live-browser.txt`, and the three audit documents. The existing labelled offline demonstration pack remains under [demo-evidence/2026-10-08](demo-evidence/2026-10-08/README.md). No screenshots or exports containing private credentials were generated.

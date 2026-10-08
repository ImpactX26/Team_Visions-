# ECDAT integration verification — 8 October 2026

Functional integration: **PASS**. Full dependency release gate: **OPEN**, because two frontend development dependency packages have high-severity audit findings. The original SIH project was preserved; work was confined to this working copy. No submission repository was configured or pushed by this verification task.

## Authorized integration

The user authorized only the CBOM download frontend change. `dashboard/src/pages/CbomPage.tsx` connects `Full JSON` to `/api/exports/cbom?scan_id=<displayed-scan-id>` through the existing authenticated download helper. It exports all stored findings independently of UI pagination and filters, permits completed empty scans, and shows a retryable error. CSV retains its existing endpoint. `CbomPage.test.tsx` covers scan selection, empty scans, failure and retry. Other frontend improvements and dependency files remain with the frontend team.

The rehearsal scripts now exercise the actual browser against a disposable migrated database and live API, then restart the API against the same database to check persistence.

## Verification evidence

| Check | Result |
| --- | --- |
| Combined backend/scanner suite | 460 passed, four Windows skips, 95 subtests; 117.58 seconds |
| Python dependency consistency | `pip check` passed |
| Backend/scanner/scripts lint | Ruff passed; rehearsal import formatting corrected |
| Frontend unit tests | 104 passed across 16 files |
| Frontend lint and formatting | Passed |
| TypeScript/Vite production build and existing size budgets | Passed; JavaScript budget has very little remaining headroom |
| Mocked Chromium suite | 58 passed before the final download-handler consolidation |
| Final focused Chromium checks | Eight CBOM/responsive/completed-scan checks passed after consolidation |
| Real browser and API rehearsal | Passed on final controls |
| Python locked dependency audit | 78 dependencies; zero known vulnerabilities |
| Production-only npm audit | Zero findings |
| Full npm audit | Two high-severity development dependency packages; unresolved |

The real rehearsal verified authenticated UI login, a worker scan processing all nine bundled files and producing 68 findings, an observed RSA risk edit, reload with preserved evidence/provenance, inventory/scan/report/evidence-graph routes, and a browser JSON download containing all 68 findings. The saved download passed official offline CycloneDX 1.6 validation. At 375px width the download remained visible without horizontal overflow. No browser errors or failed API responses were recorded. Restart preserved the exact edited asset, risk context and provenance. Temporary server processes and the disposable database were removed successfully.

Reproduce with:

```powershell
.venv\Scripts\python.exe scripts/rehearse_local_baseline.py --browser
```

Earlier rehearsal failures concerned Windows ESM import paths, ambiguous browser locators and temporary database cleanup timing. The harness was corrected and rerun successfully; application checks and foreign-key constraints were not weakened.

## Remaining dependency findings

Full npm audit flags `brace-expansion` (installed 5.0.9 and nested 1.1.18) and `source-map-js` (1.2.1), reached through development tools such as ESLint, Vite/PostCSS and jsdom. Production-only audit is clean. The current audit ranges require brace-expansion 5.0.12/1.1.21 and source-map-js 1.2.2 to clear the reported findings. Dependency files were not changed because frontend scope was limited to the download integration.

References: [brace-expansion recursion advisory](https://github.com/advisories/GHSA-qhr7-859c-m2p7), [source-map-js advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). Raw audit evidence is saved under `docs/verification/integration-2026-10-08/`.

## Scope limits

The live browser used Vite's development server and its proxy against the real local API; the production build was compiled and size-checked separately. Hosted deployment and PostgreSQL execution were not rehearsed. Native CycloneDX cryptographic-asset mapping remains deferred. Complete export means all stored findings, not proof of complete cryptographic discovery. These results do not certify enterprise readiness or detection accuracy.

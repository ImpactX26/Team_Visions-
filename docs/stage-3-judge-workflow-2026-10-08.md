# Stage 3 — judge demonstration preparation

Status: demonstration materials and automated verification PASS. The unfamiliar-presenter timed trial is pending at the user's explicit request. Stage 3 cannot claim its complete human acceptance criterion until that trial is recorded.

## Scope

Local delivery retained. No hosted deployment, ingestion feature or frontend page changes were introduced. The existing positive, negative and mixed-risk controls are scanned statically through authenticated real workers. The three-minute script is in [impactx-demo.md](impactx-demo.md); offline evidence is under [demo-evidence/2026-10-08](demo-evidence/2026-10-08/README.md).

`scripts/verify_demo_controls.py` checks each control's exact algorithm set, zero findings for the negative control, complete exported totals and official offline CycloneDX validation. Portable exports replace the machine-specific project root and are revalidated. `scripts/rehearse_local_baseline.py --demo-pack <path>` runs this against a disposable migrated database. A separate `--browser --screenshots <path>` run saves desktop risk/evidence and 375px CBOM screenshots before verifying restart persistence and cleanup.

## Admission and verification

The first pack attempt verified positive and negative controls, then received 429 on the fourth scan submission. A bounded 60-second retry assumption was also insufficient. Inspection established the actual fixed limit: three submissions per client IP per 300 seconds. The harness now respects the supplied retry interval (bounded to 300 seconds), waits in at most 30-second intervals and fails on another unsuccessful response. No rate-limit configuration, role enforcement or production endpoint was weakened. The control subprocess timeout accommodates the interval.

Fresh controls: positive 12 findings (AES, RSA, ECDSA, SHA-256, HMAC), negative zero, mixed-risk 12 (AES, RSA, ECDSA, MD5, SHA-1). All exact algorithm labels, complete totals and portable offline schemas passed. Both nonempty controls include declared-capability and observed-operation evidence. The combined browser attempt then exhausted the shared admission window; the harness now rejects combining pack and browser options and provides separate disposable runs. Browser submission errors are checked before reading scan ids, avoiding a misleading follow-on 422. Existing integration evidence remains in [integration-verification-2026-10-08.md](integration-verification-2026-10-08.md); no full backend/frontend gate is implied by this documentation and rehearsal-script change.

## Presentation limits

Final separate browser rehearsal exited zero: real login and worker scan (9/9 files, 68 findings), risk edit/reload with preserved evidence and provenance, complete downloaded JSON validated offline, inventory/detail/report/graph routes, 375px layout without overflow, no browser/API errors, exact edited asset persistence after API restart, and temporary database/process cleanup all passed. Both saved screenshots were visually inspected. No `tmp/demo-*` directories remained. Changed Python scripts passed Ruff, browser script passed Node syntax checking, and `git diff --check` passed. This narrow stage did not rerun the combined application suites because production behavior was unchanged.

Fixtures prove their named algorithm outcomes only. The positive control produces multiple findings per algorithm, including capability/import and observed-operation evidence; algorithm presence is not a one-call/one-finding assertion. No detector accuracy estimate is derived from these controls. Confidence remains heuristic. Complete exports retain the existing library/property mapping, not native cryptographic assets. Screenshots use the separate bundled integration fixture and are explicitly labelled as pre-generated evidence.

The current frontend renders legacy unknown provenance as `Policy default`; the script tells presenters to inspect exported provenance and use fresh controlled results. No frontend correction was attempted. Hosted deployment, PostgreSQL rehearsal and the two development dependency audit findings remain outside this completed preparation scope.

## Pending human gate

Subsequent [full verification](full-verification-2026-10-08.md) freshly passed 460 backend tests, 104 frontend tests, 58 Chromium tests and both real rehearsals. Pack generation now scans only the three controls, so an unused bundled scan no longer consumes its fourth admission slot. Explicit processing checks also require zero failures and fully processed in-scope files. Full release advisory gate remains failed as documented.

The user chose “Keep the human trial pending.” A teammate must still complete the timed script without coaching and record elapsed time, confusing controls, visible failure behavior and mobile usability. Do not mark the entire Stage 3 PASS based on automated screenshots alone.

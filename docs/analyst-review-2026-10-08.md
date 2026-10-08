# Analyst review — 8 October 2026

Analysts and administrators can record Confirmed use, False positive or Uncertain decisions on asset detail, with a required reason. Legacy findings start Unreviewed. Each decision records the authenticated reviewer and UTC time; previous decisions remain available in paginated history. Viewers and auditors can read but cannot submit reviews. Scanner evidence, confidence, inferred confirmed-use flags, risk scores and inventory counts remain unchanged by review.

## Contract

- `POST /api/assets/{id}/reviews`: status, trimmed reason (1–2000 characters), and required `expected_version`. Unknown fields, invalid states and blank reasons are rejected. A stale version returns 409 instead of overwriting another analyst's decision.
- `GET /api/assets/{id}/reviews?limit=50&offset=0`: newest decisions first, maximum page size 200. Missing findings return 404.
- Asset responses include review status/version, reviewer, timestamp and reason. Complete CBOM exports include these fields as ECDAT properties in the existing single-statement snapshot. False-positive decisions do not silently remove findings or change scanner metrics.
- A conditional version update, append-only review record and `asset.reviewed` audit entry commit in one transaction. Audit failure rolls the decision back. Client input cannot supply the reviewer or timestamp.
- Migration `0009_analyst_reviews` adds latest-decision fields and the `asset_reviews` history table. Existing data defaults to Unreviewed/version zero. Downgrade removes review data while preserving original findings; back up before downgrading.

## Verification

- Release verifier: PASS, exit zero; Python compilation, dependency consistency, frontend formatting/lint, build and full npm audit passed.
- Backend: 472 tests and 95 subtests passed, four Windows platform skips. Includes review states, signed actor/audit, stale updates, permissions, validation, rollback, export, legacy migration preservation and downgrade.
- Frontend: 112 tests in 17 files passed, including save/history refresh, read-only behavior and draft preservation on failed saves.
- Full Chromium suite: 58 passed without retries, 58.8 seconds.
- Real browser/API rehearsal: signed-in review, reload/history, 375px review layout, evidence preservation, complete 68-finding schema-valid CBOM containing review, and exact finding persistence across API restart passed. Disposable services/data cleaned up.
- Ruff and incremental mypy: PASS. Final UTC serialization correction verified with 11 review API tests, including SQLite round trips; Ruff passed afterward.

The feature adds about 3 KB of JavaScript and under 0.3 KB of CSS. Explicit build budgets changed from 810 to 815 KB JavaScript and 155 to 156 KB CSS; the 500 KB gzip cap is unchanged. These are documented feature growth, not claims of improved performance.

The first broad run exposed an incorrect new migration fixture that omitted the existing required provenance field; the fixture was corrected. Earlier build runs exposed the exhausted size headroom. Those failures were resolved before the final passing verifier. A non-failing Starlette/AnyIO deprecation warning remains.

Evidence: [release](verification/analyst-review-2026-10-08/analyst-review-release-complete.log), [browser](verification/analyst-review-2026-10-08/analyst-review-browser.log), [live rehearsal](verification/analyst-review-2026-10-08/analyst-review-live.log).

## Local activation and limits

The working-copy `ecdat_local.db` was backed up using SQLite's backup API to gitignored `.runtime/analyst-review-pre-migration-20261008.sqlite`, then migrated with its original finding count verified unchanged. No active scans were present. Only the identified working-copy API was restarted; readiness now reports `0009_analyst_reviews`, and frontend port 3000 returns HTTP 200. No review was added to persistent user data by verification.

Decisions belong to a finding in one scan. They are not transferred automatically to subsequent scans; stable identity/comparison remains the next milestone. Review history is retained separately from general audit-log retention. Latest review is exported; full history remains available through the review endpoint. No new calibration labels are generated from reviews yet. Docker/PostgreSQL and hosted deployment were not rerun for this feature. No commit, push or deployment occurred; original presentation files and existing user work were preserved.

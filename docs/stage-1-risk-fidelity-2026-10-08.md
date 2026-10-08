# Stage 1 — risk evidence and context fidelity

Status: PASS, 8 October 2026. Backend and verification scripts only; frontend and the original SIH copy were not modified in this stage. No schema migration or API payload change.

## Reproduced defects and resulting behavior

The earlier narrow repair reproduced evidence-aware score loss during PATCH and preserved existing evidence/provenance. This completion pass reproduced a second defect: direct `assess_risk` used a 0-year Mosca window for absent lifetime/migration inputs, while the scanner used 10 + 3 years. A regression initially failed with 0 versus 13.

`backend/services/risk_policy.py` now owns absent-input defaults used by the scanner and risk engine: medium criticality/sensitivity/effort, 10-year data lifetime, 3-year migration, internal exposure, and a 15-year threat horizon unless the existing bounded `ECDAT_DEFAULT_THREAT_HORIZON_YEARS` setting overrides it. Explicit values are preserved, including zero lifetime/migration. Provenance uses original input presence, not the populated default dictionary. Persisted findings are not mass-recalculated; PATCH assesses their stored context and preserves untouched recorded origins.

PATCH accepts only the existing risk-context fields. Non-null explicit inputs become user-provided; untouched origins remain as recorded, or unknown for missing legacy provenance. Empty/null-only requests leave stored scores/reasons unchanged and write no audit. Null continues to mean no edit, not reset. Explicit reset is deferred. Scanner evidence, evidence kind/quality, confidence, and operation/capability flags remain intact.

Admin and Security Analyst may edit. Read-only roles receive 403. Invalid values receive 422 without mutation or audit. Successful edits persist exactly the supplied non-null changes with the authenticated actor in the same transaction. Audit failure rolls back the asset mutation.

## Verification

- Focused risk/provenance/audit tests: 46 passed.
- Combined scanner/backend gate: 448 passed, four Windows platform skips, 95 subtests passed; 61.19 seconds.
- Ruff passed on all seven Python files changed in this completion pass.
- Live migrated disposable SQLite/API rehearsal: readiness, signed admin login, fixture scan (9/9 files, 68 findings), observed RSA finding exposure edit, reload equality, preserved evidence/confidence/provenance, matching JSON report score/reasons/confidence, and matching downloaded CSV score/reasons all passed.
- Temporary API process tree stopped; disposable database removed. No upgrades, push, migration, frontend changes, or production database edits.

The first live verification request used an unsupported 250-item inventory page size and received 422. The verification script was corrected to the existing 200 limit; the repeat passed. API validation was not loosened. Four skips cover Windows resource-module, permission and symlink limits; the existing Starlette/AnyIO deprecation warning remains.

## Changed files and limits

Production: `backend/services/risk_policy.py`, `risk_engine.py`, `scanner_runner.py`. Tests: `backend/tests/test_asset_risk_updates.py`, `test_mosca_provenance.py`. Rehearsal: `scripts/rehearse_local_baseline.py`, `verify_rnsit_workflow.py` (risk-edit verification is opt-in; the disposable harness enables it). Earlier PATCH repair remains in `backend/routers/assets.py`.

Direct calls with absent numeric context now follow scanner policy; this intentional behavior change can affect their computed scores. Explicit and persisted context remains authoritative. This gate covers backend behavior and live API reports; frontend interaction testing belongs to the frontend workstream. Hosted/PostgreSQL behavior and complete consistent CBOM export remain separate checks. Stage 2 is next.

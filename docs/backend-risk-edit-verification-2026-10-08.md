# Backend risk-edit verification

8 October 2026. Changes made only in ECDAT-SIH-Working. Original SIH project and frontend files were not edited during this backend task.

## Reproduced problem and fix

An exposure PATCH omitted evidence kind from recalculation, causing confirmed RSA use and capability-only RSA findings to receive the unknown-evidence base score. It also relabeled all stored risk inputs as user-provided.

Recalculation now receives stored evidence kind, evidence quality, and confidence. Only explicitly edited non-null risk fields get user-provided provenance. Untouched origins remain recorded; missing legacy origins become unknown rather than an invented default/user origin. Empty and null-only PATCH requests return the unchanged finding without recalculation or audit. Existing null semantics remain unchanged: null does not clear a field.

Five new API regressions cover confirmed/capability scores and reasons, provenance preservation, evidence/confidence persistence after reload, empty/null-only requests, and transaction rollback when auditing fails. No database migration or frontend contract change is required.

## Verification

- Regression initially failed on incorrect evidence-aware score; passed after fix.
- Focused risk/provenance/audit suite: 38 passed.
- Full scanner/backend suite: 440 passed, 4 Windows platform skips, 95 subtests passed, 56.09 seconds.
- Ruff checks on changed Python files passed.
- Initial full run encountered 17 setup errors accessing the Windows default pytest temp directory; rerun with workspace-owned TEMP/TMP passed. One existing Starlette/AnyIO deprecation warning remains.

This verifies the risk-edit change, not vendor equivalence, detection accuracy, or enterprise readiness. Next planned backend priority is complete, consistently generated CBOM exports with official schema validation.

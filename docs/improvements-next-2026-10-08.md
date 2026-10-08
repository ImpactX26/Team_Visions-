# ECDAT next improvement plan

Prepared 8 October 2026. This plan reconciles the older implementation lists with current source and the latest recorded verification. No new application tests or dependency audits were run while preparing it; recorded passes are historical evidence, not a fresh certification.

## Baseline

Subsequent implementation: dependency release gate and provenance labels are fixed; analyst review and bounded local scan comparison are implemented and verified. A bounded Node JS/TS syntax detector and partial native CycloneDX crypto mapping are now implemented and locally verified. See [release closure](release-gate-closure-2026-10-08.md), [labels](provenance-label-fix-2026-10-08.md), [review](analyst-review-2026-10-08.md), [comparison](scan-comparison-2026-10-08.md), and [detection/CBOM scope and verification](detection-cbom-semantics-2026-10-08.md). The ordered list records the original sequence. Independent repository-separated detector evaluation and complete relationship interoperability remain open; this implementation is not an accuracy certification. Cross-root identity and general dataflow matching remain deferred.

Risk-edit fidelity, complete offline-schema-validated CBOM downloads, demo controls, responsive frontend, and Docker/PostgreSQL scan persistence have documented passing gates. See [system verification](system-verification-2026-10-08.md). Do not repeat September's missing-feature backlog as current work.

Source inspection confirms that `AssetDetail.tsx` still labels every non-user-provided provenance value as “Policy default”, including unknown values. The latest recorded release gate also reports two high-severity development dependency packages. Reproduce that audit before selecting a repair; package files may have changed since the report.

## Ordered delivery

| Order | Improvement | Deliverable and acceptance |
| --- | --- | --- |
| 1 | Close the dependency gate | Reproduce the full and production dependency audits; inspect dependency paths; make the smallest compatible repair if findings remain. Preserve lockfile reproducibility. Pass frontend unit tests, lint/formatting, build budgets and relevant browser workflows; record the new audit result. |
| 2 | Make risk assumptions truthful | Distinguish user-provided, policy-default and unknown provenance in asset detail. Missing or unrecognized provenance must stay unknown. Cover legacy and mixed-provenance findings, edit/reload behavior, and agreement with exports. |
| 3 | Introduce analyst review | Add reviewed states for confirmed use, false positive and uncertain, with reviewer, timestamp, reason and audit history. Preserve raw scanner evidence and confidence. Enforce roles and transactional updates; demonstrate review, reload and export using the real API. |
| 4 | Establish repository and finding identity | Record repository scope, snapshot/revision when available, scanner/profile versions and processing manifest. Define stable occurrence matching without merging duplicates or incompatible repositories. Verify moved lines, changed algorithms, duplicate calls and legacy scans. |
| 5 | Add before/after scan comparison | Build on identity to show added, changed, unchanged, no-longer-observed, ambiguous and unknown findings. Failed or excluded files cannot imply a fix. Demonstrate baseline scan → source change → rescan → evidence-linked comparison. |
| 6 | Improve detection and interoperability | Choose one bounded JavaScript/TypeScript semantic detector slice and a named native CycloneDX cryptographic-asset mapping slice. Deliver separately, with independent labelled evaluation for detectors and schema plus semantic assertions for exports. |
| 7 | Calibrate reviewed confidence | Use reviewed outcomes and repository-separated datasets after review and identity are reliable. Report counts, calibration error and uncertainty; retain heuristic labels where evidence is insufficient. |

Orders 1–2 are the immediate small fixes. Orders 3–5 form the next product milestone: discovery → analyst decision → verified change. Orders 6–7 follow that foundation. Detailed contracts remain in the [IBM/Keyfactor-informed plan](implementation-plan-ibm-keyfactor-2026-10-08.md).

## Delivery rules

Work only in this working copy. Preserve the original presentation project, private configuration, persistent databases and existing user work. Keep each change independently reviewable. For each implementation, reproduce the gap, apply a focused change, run relevant checks and the milestone's integration gate, and save evidence with remaining limitations.

The unfamiliar-presenter trial remains pending by the user's earlier choice. It is a separate human demo check, not an engineering feature. Hosted deployment, submission destination and enterprise infrastructure require their own concrete scope. Do not infer authorization to publish or push from this plan.

## First execution batch

Begin with a fresh dependency audit and dependency-path inspection, then address the confirmed provenance-label defect. Finish the batch with audit results, frontend checks and a real asset edit/reload/export rehearsal. Reassess the baseline before introducing the analyst-review migration and API contract.

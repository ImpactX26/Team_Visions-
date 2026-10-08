# IBM Quantum Safe Explorer and Keyfactor AgileSec: research for ECDAT

Generated: 8 October 2026, India time. Confidence: high for documented capabilities, moderate for cross-version consistency, insufficient evidence for comparative accuracy, pricing, or installed-build performance.

## Executive summary

IBM Explorer is the closer reference for repository analysis; AgileSec is the stronger reference for inventory lifecycle and sensor architecture. Both document CBOM and risk workflows, so these alone do not establish uniqueness. ECDAT should first preserve trustworthy evidence and context, then provide validated exports, human review, and conservative scan comparison. Semantic expansion and enterprise connectors require separate work. These priorities are engineering recommendations, not claims of vendor equivalence.

## Research questions

1. What does each product discover, and what remains unresolved or excluded?
2. How are evidence, identities, policies, and scan lifecycle represented?
3. How do CBOM, automation, and remediation capabilities differ?
4. Which ideas fit ECDAT's actual code and today's hackathon?
5. What evidence is needed before claiming improved accuracy or production readiness?

## IBM findings

**Documented:** Explorer distinguishes cryptographic API discovery from deeper analysis. The current 2.x overview lists deeper analysis for Java and Python, alongside discovery in C/C++, C#, Dart, Go, and Node.js languages. Variable-parameter tracing and operation patterns are described. Python 2 or invalid syntax can be excluded with warnings. This documents supported analysis, not measured completeness on arbitrary applications. [Explorer overview](https://www.ibm.com/docs/en/quantum-safe/quantum-safe-explorer/2.x?topic=quantum-safe-explorer-overview).

The FAQ explains Java operation-chain analysis and the requirement for class/dependency artifacts. It also lists IDE, CLI, API, and inventory outputs. Its Java-focused text is narrower than the current overview. [FAQ](https://www.ibm.com/docs/en/quantum-safe/quantum-safe-explorer/2.x?topic=faq).

The CLI documentation describes input paths, language choices, exclusion filters, and Java classpath configuration. Some analytics wording differs between retrieved pages. Implementing an adapter requires version-specific validation rather than copying a command from a general overview. [CLI guide](https://www.ibm.com/docs/en/quantum-safe/quantum-safe-explorer/2.x?topic=cli-using-quantum-safe-explorer).

Scan outputs distinguish inventory, findings, metrics, CBOM, and missing-dependency/class-file issues. Missing prerequisites are not equivalent to clean results. [Output guide](https://www.ibm.com/docs/en/quantum-safe/quantum-safe-explorer/2.x?topic=cli-accessing-quantum-safe-explorer-scan-results).

The May 2026 Explorer datasheet identifies version 2.3.1, CycloneDX 1.6 assets, usage/implementation relationships, knowledge-base customization, and an Unknown compliance result when properties cannot be resolved. This is vendor product documentation, not independent benchmark evidence. [Datasheet](https://www.ibm.com/downloads/documents/us-en/137a1e22185bac92).

Explorer discovery should not be confused with IBM's separate Remediator, which documents adaptive-proxy hybrid/PQC communication and performance testing. Guardium Cryptography Manager describes broader inventory and lifecycle management. [Remediator](https://www.ibm.com/docs/en/quantum-safe/quantum-safe-remediator/1.1.x?topic=overview), [Guardium](https://www.ibm.com/products/guardium-cryptography-manager).

**Implication for ECDAT:** preserve unresolved parameters; strengthen semantic extraction one language at a time; expose failure scope; keep observations separate from risk judgments. Recommendations do not establish that migration has been executed safely.

## Keyfactor findings

**Documented:** AgileSec sensors feed a common scanning core and processing pipeline. Source/library, binary/artifact, certificate/key, and keystore discovery depend on sensor and format. The 3.5 overview describes incremental scans followed by periodic full scans. Its auto-resolution rules defer removed-finding reconciliation until a subsequent full scan; an initial full scan does not resolve earlier inventory. [Sensor architecture](https://docs.keyfactor.com/agilesec/3.5/sensors-architecture-and-overview).

The data reference separates observation, cryptographic content, and analysis. A location-independent object fingerprint differs from the UID of an occurrence at a source location. It includes source branch/span metadata. Its resolution fields describe an occurrence being removed, not a proof that every deployed use was remediated. [Data fields](https://docs.keyfactor.com/agilesec/latest/cryptographic-data-fields-reference).

The deployment guide describes operational storage, search indexing, asynchronous orchestration, and remote collectors. Its architecture is explicitly dated December 2025. Remote execution can still transmit findings to the platform. [Deployment guide](https://docs.keyfactor.com/agilesec/3.5/architecture-and-deployment-guide).

Release-specific observations:

- **3.4:** incremental repository scanning and per-source CycloneDX 1.6 exports. The documented large-export limitation belongs to that version; do not assume later versions share it. [3.4 notes](https://docs.keyfactor.com/agilesec/3.5/agilesec-3-4-release-notes).
- **3.5.0:** unified findings/policies, bearer authentication, and integration improvements. Header-token examples remain in some older overview content. [3.5.0 notes](https://docs.keyfactor.com/agilesec/latest/agilesec-3-5-0-release-notes).
- **3.6:** findings-level RBAC, additional cloud integration, branch scanning, and scale/resource improvements. [3.6 notes](https://docs.keyfactor.com/agilesec/latest/agilesec-3-6-release-notes).
- **3.6.5:** maintenance and deployment-specific upgrade guidance. A current release index does not establish that every customer installation runs it. [3.6.5 notes](https://docs.keyfactor.com/agilesec/latest/agilesec-3-6-5-release-notes).

Schema migration documentation warns that field/type changes can silently break queries. Versioned evidence and export mappings therefore matter. [Search API migration](https://docs.keyfactor.com/agilesec/latest/search-api-migration-guide-v3-to-3-5).

**Implication for ECDAT:** separate object, occurrence, scan, and analyst review; define comparison compatibility; never treat absence in a failed/partial scan as remediation. Keep infrastructure collectors out of today's repository-focused scope.

## Standards findings

CycloneDX represents algorithms, certificates, keys, and relationships. Its 1.6 schema defines `cryptographic-asset` and `cryptoProperties`; a document declaring 1.6 needs validation against that version and its referenced schemas. Schema validity and useful cryptographic modeling are distinct checks. [CBOM overview](https://cyclonedx.org/capabilities/cbom/), [official 1.6 schema](https://raw.githubusercontent.com/CycloneDX/specification/1.6/schema/bom-1.6.schema.json).

NCCoE separates discovery/inventory from migration planning and interoperability testing. This supports ECDAT's repository discovery scope but is not a certification of ECDAT. [NCCoE migration project](https://www.nccoe.nist.gov/applied-cryptography/migration-to-pqc).

## ECDAT mapping: inspected code, not vendor inference

| Area | Already present | Gap to plan |
|---|---|---|
| Semantic discovery | Python imports/aliases/scopes/calls; other languages use rules | No comparable non-Python AST/type analysis |
| Risk context | Editable fields, reasons, defaults/provenance, audit | PATCH omits evidence kind and provenance input during recalculation |
| Analyst review | Machine `confirmed_use`; risk editing | No human verdict/history workflow |
| Finding identity | Logical hashes, parser versions, spans | Line/column-dependent hash; no repository/revision comparison contract |
| Scan comparison | Overview aggregate differences | No finding-level comparison |
| Calibration | Bands, Brier/ECE helpers, record ingestion | Default labels derive from machine inference; no reviewed holdout workflow |
| CBOM | 1.6 declaration, custom evidence properties, paginated UI | Shape-only validation; `pagination` mixed into output; algorithm findings modeled as libraries |
| Hosting | Allowlisted server paths, Compose | No hosted ingestion or complete Render integration in this copy |

Relevant source: `backend/routers/assets.py:update_asset`, `backend/services/risk_engine.py:assess_risk`, `backend/services/correlator_v3.py:_build_finding`, `backend/services/calibration_dataset.py:add_from_scan`, `backend/routers/outputs.py:cbom`, `scripts/validate_schema.py:_validate_cbom`, `scanner/collectors/ast_collector.py`, and `scanner/collectors/rule_collector.py`.

The risks above are code-inspection findings; they have not been reproduced with new regressions in this planning pass. The prior reliability gate remains dated evidence, not validation of these newly identified cases.

## Confidence and limitations

- High: official descriptions of discovery/analysis, sensor architecture, data-field identities, and version-specific release entries.
- Moderate: reconciling IBM pages with different analytics wording and moving `latest` Keyfactor URLs.
- Unverified: current IBM API contract and exact release-note changes. Direct API/release retrieval encountered access failures; indexed snippets do not justify implementing against guessed endpoints.
- Unverified: product pricing, shared-corpus detection accuracy, runtime efficiency, purchased edition availability, and deployed customer behavior.
- No vendor software was installed or benchmarked. No comprehensive vendor exclusion manifest or partial-scan reconciliation contract was independently verified.

## Methodology

Applied the ecc:deep-research workflow with parallel IBM research, Keyfactor research, and read-only ECDAT inspection. Firecrawl/Exa were unavailable; built-in search/open tools were used. Searches covered analysis scope, sensors/lifecycle, schema/export, release changes, and standards. Relevant official pages were deep-read; 18 primary supporting references are cited above. Search results from secondary sites were not used for technical conclusions. Access failures and contradictory versions are retained as limitations. No application code, original-project files, credentials, or remote configuration changed.

## Recommended decisions

Repair evidence/provenance fidelity and export correctness first. Add human review before calibrating confidence from outcomes. Add stable comparison contracts before presenting findings as remediated. Extend one language before promising enterprise discovery. The execution-ready tasks, estimates, and exit gates are in `implementation-plan-ibm-keyfactor-2026-10-08.md`.

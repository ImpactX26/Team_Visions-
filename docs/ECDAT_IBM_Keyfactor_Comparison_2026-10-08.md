# ECDAT IBM and Keyfactor Comparison

Technical and product assessment for the ECDAT project team and evaluators
8 October 2026

### Main assessment

IBM Quantum Safe Explorer is the closest reference for application cryptography analysis. Keyfactor AgileSec is the closer reference for discovery across repositories and infrastructure. Their related products extend into operational cryptography and certificate management. This is a scope-based assessment of documented capabilities, not a measured ranking. [IBM Quantum Safe Explorer 2.3.1 datasheet](https://www.ibm.com/downloads/documents/us-en/137a1e22185bac92) [IBM Guardium Cryptography Manager product overview](https://www.ibm.com/products/guardium-cryptography-manager) [Keyfactor AgileSec sensors architecture and overview 3.5](https://docs.keyfactor.com/agilesec/3.5/sensors-architecture-and-overview) [Keyfactor Command product overview](https://www.keyfactor.com/products/command/)

ECDAT now provides a working local workflow for repository scanning, evidence inspection, editable risk assumptions, analyst review, conservative scan comparison and partial native CBOM export. It is suitable for a controlled demonstration and focused engineering evaluation. The evidence does not establish enterprise equivalence, general detection accuracy or production readiness.

### Products compared

| Organization | Relevant products | Role in this report |
| --- | --- | --- |
| IBM | Quantum Safe Explorer; Guardium Cryptography Manager | Explorer for code analysis; Manager for broader inventory and lifecycle context. [IBM Quantum Safe Explorer 2.3.1 datasheet](https://www.ibm.com/downloads/documents/us-en/137a1e22185bac92) [IBM Guardium Cryptography Manager product overview](https://www.ibm.com/products/guardium-cryptography-manager) |
| Keyfactor | AgileSec; CipherInsights; Command | AgileSec for discovery; CipherInsights for network evidence; Command for certificate automation. [Keyfactor AgileSec sensors architecture and overview 3.5](https://docs.keyfactor.com/agilesec/3.5/sensors-architecture-and-overview) [Keyfactor CipherInsights introduction version 13.0.0](https://software.keyfactor.com/Guides/CipherInsights/Current/Content/General/Introduction.htm) [Keyfactor Command product overview](https://www.keyfactor.com/products/command/) |
| ECDAT | Current working copy | Repository discovery and analyst workflow, assessed against local source and recorded verification. |


### Evidence and boundaries

Vendor statements below are drawn from official documentation retrieved for this report. ECDAT statements use the implementation and verification records from this chat. No IBM or Keyfactor installation was tested. Unknown means not established by the reviewed evidence; it does not mean a vendor lacks the feature. Pricing, procurement terms and comparative throughput are not ranked.

## Capability comparison

IBM and Keyfactor columns describe the named products, with separate products identified where required. ECDAT functionality is narrower. Source markers link to the supporting vendor pages.

| Capability | IBM | Keyfactor | ECDAT |
| --- | --- | --- | --- |
| Source analysis | Explorer API discovery and parameter tracing. [IBM Quantum Safe Explorer 2.3.1 datasheet](https://www.ibm.com/downloads/documents/us-en/137a1e22185bac92) | AgileSec source and library scanning. [Keyfactor AgileSec sensors architecture and overview 3.5](https://docs.keyfactor.com/agilesec/3.5/sensors-architecture-and-overview) | Python AST; scoped Node JS/TS syntax; other supported languages use rules. |
| Infrastructure scope | Manager inventory, ownership and dependencies. [IBM Guardium Cryptography Manager product overview](https://www.ibm.com/products/guardium-cryptography-manager) | Sensor-dependent binary, archive, key, keystore and container coverage. [Keyfactor AgileSec sensors architecture and overview 3.5](https://docs.keyfactor.com/agilesec/3.5/sensors-architecture-and-overview) | Local source, supported manifests and certificate files. No infrastructure connectors. |
| Network evidence | Specific installed sensor scope not verified here. | CipherInsights passive encrypted-traffic analysis without decryption. [Keyfactor CipherInsights introduction version 13.0.0](https://software.keyfactor.com/Guides/CipherInsights/Current/Content/General/Introduction.htm) | No traffic monitoring or runtime execution evidence. |
| CBOM | Explorer CycloneDX 1.6 and usage/implementation relationships. [IBM Quantum Safe Explorer 2.3.1 datasheet](https://www.ibm.com/downloads/documents/us-en/137a1e22185bac92) | AgileSec per-source 1.6 export documented in 3.4; exporter improved in 3.6. [Keyfactor AgileSec 3.4 release notes](https://docs.keyfactor.com/agilesec/3.5/agilesec-3-4-release-notes) [Keyfactor AgileSec 3.6 release notes](https://docs.keyfactor.com/agilesec/latest/agilesec-3-6-release-notes) | Full offline validation; native algorithm/protocol/certificate subset; unresolved records retained. |
| Risk assessment | Explorer unknown-property compliance state; Manager risk policies. [IBM Quantum Safe Explorer 2.3.1 datasheet](https://www.ibm.com/downloads/documents/us-en/137a1e22185bac92) [IBM Guardium Cryptography Manager product overview](https://www.ibm.com/products/guardium-cryptography-manager) | AgileSec policy processing and risk classifications. [Keyfactor AgileSec sensors architecture and overview 3.5](https://docs.keyfactor.com/agilesec/3.5/sensors-architecture-and-overview) | Explainable heuristic priorities with user/default/unknown context provenance. |
| Analyst decisions | Equivalent signed verdict/history contract not verified. | Policies and resolution state documented; equivalent verdict/history contract not verified. [Keyfactor AgileSec sensors architecture and overview 3.5](https://docs.keyfactor.com/agilesec/3.5/sensors-architecture-and-overview) [Keyfactor AgileSec cryptographic data fields reference](https://docs.keyfactor.com/agilesec/latest/cryptographic-data-fields-reference) | Confirmed use, false positive or uncertain; reason, signed actor, UTC time, history and stale-write rejection. |
| Finding identity | Exact matching contract not verified. | Object fingerprint distinct from occurrence UID. [Keyfactor AgileSec cryptographic data fields reference](https://docs.keyfactor.com/agilesec/latest/cryptographic-data-fields-reference) | Local root/profile/parser/snapshot compatibility and conservative occurrence matching. |
| Repeat scans | Equivalent diff and partial-scan contract not verified. | Incremental scans and periodic full-scan auto-resolution. [Keyfactor AgileSec sensors architecture and overview 3.5](https://docs.keyfactor.com/agilesec/3.5/sensors-architecture-and-overview) | Added/changed/unchanged/no longer observed/ambiguous/unknown; failed revisits cannot imply fixes. |
| Access and operations | Installed edition and deployment controls require validation. | AgileSec findings RBAC/SAML mapping; distributed deployment documented. [Keyfactor AgileSec 3.6 release notes](https://docs.keyfactor.com/agilesec/latest/agilesec-3-6-release-notes) [Keyfactor AgileSec architecture and deployment guide 3.5](https://docs.keyfactor.com/agilesec/3.5/architecture-and-deployment-guide) | Signed sessions and roles; supervised local workers; no enterprise SSO or tenant isolation claim. |
| Lifecycle actions | Manager key generation and certificate renewal; Remediator is separate. [IBM Guardium Cryptography Manager product overview](https://www.ibm.com/products/guardium-cryptography-manager) | Command certificate renewal and provisioning. [Keyfactor Command product overview](https://www.keyfactor.com/products/command/) | Guidance only; does not rotate certificates, replace algorithms or deploy PQC. |


No numerical winner is assigned: product breadth, detection accuracy and suitability for a particular organization are different questions.

## Interpretation of the differences

### IBM and Keyfactor serve overlapping but distinct needs

Explorer documents code-level cryptographic discovery, parameter tracing and a portfolio view. AgileSec documents a sensor-driven pipeline with scanning, enrichment, ingestion and policy processing. Keyfactor also provides an explicit object/observation/analysis data model. These are different implementation reference points for ECDAT, not evidence that either vendor detects more findings on the same codebase. [IBM Quantum Safe Explorer 2.3.1 datasheet](https://www.ibm.com/downloads/documents/us-en/137a1e22185bac92) [Keyfactor AgileSec sensors architecture and overview 3.5](https://docs.keyfactor.com/agilesec/3.5/sensors-architecture-and-overview) [Keyfactor AgileSec cryptographic data fields reference](https://docs.keyfactor.com/agilesec/latest/cryptographic-data-fields-reference)

For application remediation planning, evaluate Explorer on the exact languages and build artifacts in use. For inventory spanning hosts, repositories, cloud key services and artifacts, evaluate the relevant AgileSec sensors. For observed network cryptography, include CipherInsights; for certificate renewal and provisioning, include Command. IBM Manager similarly adds lifecycle capabilities beyond Explorer. This recommendation follows the documented product roles and requires edition-specific validation. [IBM Guardium Cryptography Manager product overview](https://www.ibm.com/products/guardium-cryptography-manager) [Keyfactor CipherInsights introduction version 13.0.0](https://software.keyfactor.com/Guides/CipherInsights/Current/Content/General/Introduction.htm) [Keyfactor Command product overview](https://www.keyfactor.com/products/command/) [Keyfactor AgileSec architecture and deployment guide 3.5](https://docs.keyfactor.com/agilesec/3.5/architecture-and-deployment-guide)

### CBOM validity does not establish semantic completeness

CycloneDX models cryptographic assets and their relationships to software. ECDAT exports native properties for a supported subset, preserves inventory evidence and review fields, and omits relationships it cannot prove. Full exports validate against the pinned 1.6 schema. This establishes structural validity for those exports, not complete dependency modelling or automatic interoperability with a vendor importer. A receiver test is still required. [CycloneDX cryptography bill of materials overview](https://cyclonedx.org/capabilities/cbom/)

### Absence is not proof of remediation

AgileSec documentation describes auto-resolution after a subsequent full scan; removal during an incremental cycle waits for that reconciliation. Its resolution metadata concerns an occurrence being removed. ECDAT instead returns unknown when compatible processing proof or a reliable match is missing. Neither a missing source finding nor an analyst verdict establishes that deployed instances were remediated. The exact vendor behavior under every partial-scan failure was not independently tested. [Keyfactor AgileSec sensors architecture and overview 3.5](https://docs.keyfactor.com/agilesec/3.5/sensors-architecture-and-overview) [Keyfactor AgileSec cryptographic data fields reference](https://docs.keyfactor.com/agilesec/latest/cryptographic-data-fields-reference)

### Accuracy and costs remain unmeasured

Regression counts demonstrate software checks, not detector precision or recall. ECDAT has no fresh independent repository-separated field holdout for the new JS/TS collector. No shared labelled corpus was run through the vendor tools. A comparison of speed, accuracy or total cost would therefore be unsupported. Obtain written quotes and compare licensing, integrations, infrastructure, operations and support against the same deployment scope.

## ECDAT readiness and next decisions

### What is verified locally

The latest recorded gate passed 579 backend tests and 95 subtests, with four Windows skips; the final frontend passed 118 tests across 18 files. Chromium passed 58 tests, followed by six focused CBOM viewport checks. Formatting, lint, TypeScript, production build, incremental Python typing and the recorded dependency audits passed. These are dated local results, not an independent security or product certification.

Disposable live rehearsals verified actual worker scans, analyst review/history, risk edits, complete downloads, mobile layout and persistence after restart. A controlled TS fixture produced four supported operations and one unresolved selector; its JS negative file stayed clean. An existing fixture exported all 68 findings. Evidence: docs/detection-cbom-semantics-2026-10-08.md and its verification logs.

### Material limitations

The JS/TS slice covers direct Node crypto bindings and bounded immutable selectors. WebCrypto, third-party APIs and general interprocedural dataflow remain outside scope; previous generic JS/TS pattern coverage was replaced, so general recall improvement is not established. Static calls do not prove execution. Edited JS/TS occurrences without reliable anchors abstain in comparison. Native CBOM relationships and key lifecycle modelling remain incomplete.

Current deployment is a local application, not a verified enterprise service. No claim is made for enterprise SSO, tenant isolation, durable distributed queues, managed backups, HSM integration, automatic migration or high availability. Existing source/runtime comparisons are intentionally local and refuse incompatible or legacy inputs.

### Recommended implementation sequence

1. Establish a fresh labelled evaluation split by repository. Measure precision, recall and unresolved rates per API and language; include shadowing, mutation, failed files and realistic third-party usage.

2. Test CBOM import with a target receiver. Expand only evidence-backed library/algorithm/certificate relationships; verify reference integrity and semantic meaning separately from schema validity.

3. Extend detection one named API family at a time. Add scope and dataflow only with labelled negatives and explicit abstention behavior, then rerun comparison compatibility tests.

4. Add enterprise connectors and deployment controls only after the target use case is selected. Choose source portfolio, network inventory or certificate lifecycle requirements before designing integrations.

### Suggested presentation statement

ECDAT is a repository-focused cryptographic discovery and analyst workflow prototype. It makes evidence, assumptions, reviews and scan changes visible, and exports a validated partial native CBOM. IBM and Keyfactor are enterprise reference products with broader documented scope; ECDAT has not been benchmarked as their replacement.

## Sources and verification method

Official vendor and standards pages retrieved on 8 October 2026, India time. Versioned documents are identified below; moving latest/current URLs may change. Documentation describes capabilities, not an independently tested installed build.

[S1] [IBM Quantum Safe Explorer 2.3.1 datasheet](https://www.ibm.com/downloads/documents/us-en/137a1e22185bac92)

[S2] [IBM Guardium Cryptography Manager product overview](https://www.ibm.com/products/guardium-cryptography-manager)

[S3] [Keyfactor AgileSec sensors architecture and overview 3.5](https://docs.keyfactor.com/agilesec/3.5/sensors-architecture-and-overview)

[S4] [Keyfactor AgileSec cryptographic data fields reference](https://docs.keyfactor.com/agilesec/latest/cryptographic-data-fields-reference)

[S5] [Keyfactor AgileSec 3.4 release notes](https://docs.keyfactor.com/agilesec/3.5/agilesec-3-4-release-notes)

[S6] [Keyfactor AgileSec 3.6 release notes](https://docs.keyfactor.com/agilesec/latest/agilesec-3-6-release-notes)

[S7] [Keyfactor CipherInsights introduction version 13.0.0](https://software.keyfactor.com/Guides/CipherInsights/Current/Content/General/Introduction.htm)

[S8] [Keyfactor Command product overview](https://www.keyfactor.com/products/command/)

[S9] [Keyfactor AgileSec architecture and deployment guide 3.5](https://docs.keyfactor.com/agilesec/3.5/architecture-and-deployment-guide)

[S10] [CycloneDX cryptography bill of materials overview](https://cyclonedx.org/capabilities/cbom/)

### ECDAT evidence

Local implementation and records: docs/detection-cbom-semantics-2026-10-08.md, docs/scan-comparison-2026-10-08.md, docs/analyst-review-2026-10-08.md and docs/provenance-label-fix-2026-10-08.md. The earlier deep-research report was used to locate sources; its pre-improvement ECDAT gap table was not reused as the current baseline.

### Access and interpretation limits

Direct retrieval of selected IBM documentation pages returned access errors; the accessible official Explorer 2.3.1 datasheet and Manager product page support the IBM claims used here. AgileSec 3.4 export notes and 3.5 sensor guidance are version-specific; 3.6 release notes supplement them rather than proving every installation is upgraded. No pricing assumptions, fabricated benchmarks or inferred feature absences are included.

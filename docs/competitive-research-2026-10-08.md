# IBM, Keyfactor, and ECDAT

Research date: 8 October 2026. Vendor statements below come from official documentation; ECDAT statements come from this working copy and its recorded verification. No head-to-head product benchmark or vendor installation was performed.

## IBM

The closest comparison is **IBM Quantum Safe Explorer**, which discovers application cryptography and produces inventories/CBOMs. Its documentation lists Java, Python, C/C++, C#, Dart, Go, JavaScript, and TypeScript. It distinguishes API discovery from deeper cryptographic analysis: the latter is listed for Java and Python and includes tracing variable parameters and recognizing operation sequences. This is stronger documented semantic capability than ECDAT's largely rule-based non-Python analysis. It does not establish higher measured accuracy on a shared dataset.

Explorer offers IDE, CLI, and API interfaces with CBOM, CSV, and JSON outputs. [Explorer documentation](https://www.ibm.com/docs/en/quantum-safe/quantum-safe-explorer/2.x?topic=quantum-safe-explorer-overview).

IBM also has broader products. **Guardium Cryptography Manager** addresses inventory, ownership/dependencies, policy, and key/certificate lifecycle operations. [Product overview](https://www.ibm.com/products/guardium-cryptography-manager).

**Quantum Safe Remediator** includes hybrid/PQC communication through an adaptive proxy and a performance harness. These are separate capabilities from discovering cryptography or recommending migration. [Remediator documentation](https://www.ibm.com/docs/en/quantum-safe/quantum-safe-remediator/1.1.x?topic=overview).

## Keyfactor

**Keyfactor AgileSec** combines distributed discovery sensors with a centralized inventory and policy/risk analysis. The documented sensor architecture includes source and library scanning, binary/artifact inspection, certificate/key discovery, keystores, and repository integration. Incremental scanning and findings resolution are documented. Availability depends on sensor, format, deployment, and version. [Sensor architecture](https://docs.keyfactor.com/agilesec/3.5/sensors-architecture-and-overview).

The product page also describes network traffic and cloud discovery, continuous monitoring, and remediation integrations with CLM/GRC/ITSM/CMDB tools. [Discovery and inventory](https://www.keyfactor.com/products/cryptographic-discovery-inventory/).

AgileSec 3.4 release notes document per-source CycloneDX 1.6 CBOM export. CBOM is therefore a shared capability, not an ECDAT-exclusive innovation. [Release notes](https://docs.keyfactor.com/agilesec/3.5/agilesec-3-4-release-notes).

## ECDAT: current implementation

- Repository-first static scanning without executing scanned source.
- Python AST plus rule inspection; rules cover Python, Java, JavaScript, TypeScript, C/C++, Go, C#, and Rust. Support depth varies.
- Dependency inputs: requirements.txt, pom.xml, package-lock.json, Gemfile.lock, go.sum, Cargo.lock.
- X.509 certificate inputs: PEM, CRT, CER.
- Operation-aware evidence correlation, separate operation/capability evidence, conflict indicators, and heuristic confidence.
- Explainable risk reasons, editable business context, Mosca-style migration scenarios, and PQC recommendations.
- Inventory, scan history, evidence graph, reports, CSV and CycloneDX 1.6 output.
- Signed-session roles, bounded scans, progress/cancellation, database-backed admission/leases, migrations, and local/Compose deployment paths.

Evidence: `scanner/collectors/registry.py`, `scanner/collectors/rule_collector.py`, `backend/services/confidence.py`, `backend/services/risk_engine.py`, `backend/routers/outputs.py`, and the October verification report.

ECDAT does not currently establish enterprise-wide network/runtime/binary/container discovery, KMS/HSM integration, automated certificate renewal/key rotation, or actual PQC migration execution. Hosted deployment integration is still pending in this copy.

## Comparison

| Area | IBM | Keyfactor AgileSec | ECDAT |
|---|---|---|---|
| Closest role | Explorer: application analysis; wider IBM portfolio adds management/remediation | Organization-wide sensor inventory and posture management | Repository discovery and explainable prioritization |
| Semantic source analysis | Deeper analysis documented for Java/Python | Source/library discovery documented; no shared accuracy test | Python AST; other languages mainly rules |
| Infrastructure discovery | Broader portfolio, beyond Explorer | Hosts, networks, cloud and artifact sensors | Repository files and bundled fixtures |
| CBOM | Explorer supports CBOM | CycloneDX 1.6 export documented | CycloneDX 1.6 implementation |
| Operational remediation | Separate lifecycle/proxy products | Workflow integrations and broader lifecycle ecosystem | Recommendations/context editing |
| Accuracy comparison | Not measured here | Not measured here | Stored corpus results only |

## Evidence and defensible positioning

Fresh local checks: 435 backend tests passed, four Windows-related skips, 95 subtests passed; 102 frontend tests passed; final Chromium run 58/58 passed after one initial timeout. A real disposable-database fixture scan processed 9/9 supported files and produced 68 findings. These validate scoped behavior, not enterprise coverage or competitive superiority.

Stored September 12 frozen-corpus results: precision 85.71%, recall 96%, F1 90.57%. These are historical dataset-specific results, not a fresh benchmark. Processing coverage is not detection accuracy. Confidence remains an evidence-strength heuristic, not a demonstrated probability of correctness.

Position ECDAT as an inspectable repository-focused prototype with transparent evidence and practical migration planning. Do not claim it outperforms IBM/Keyfactor, is cheaper without comparable licensing/TCO evidence, or has a unique feature simply because it implements CBOM or risk scoring.

## Improvement opportunities

1. Add analyst verdicts and reviewed labels to support defensible confidence calibration.
2. Strengthen JavaScript/TypeScript or Java API/import analysis and test with independent positive/negative cases.
3. Add scan-to-scan comparison showing new, removed, and changed findings.
4. Improve contextual migration actions and clearly distinguish defaults from user inputs.
5. Validate CBOM interoperability and real-browser/API deployment flows.
6. Expand into infrastructure discovery later, with explicitly scoped sensors and independent testing.

These priorities are an inference from the capability gaps, not vendor recommendations. Pricing, resource efficiency, and comparative accuracy remain unverified.

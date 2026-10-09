import type { CryptoAsset, ScanJob } from "../types";

export function reportTitle(asset: CryptoAsset): string {
  const algorithm = asset.algorithm || "Unknown algorithm";
  return asset.key_size && !algorithm.endsWith(`-${asset.key_size}`)
    ? `${algorithm}-${asset.key_size}`
    : algorithm;
}

export function evidenceStatus(asset: CryptoAsset): string {
  if (asset.confirmed_use && asset.capability_only) return "Conflicting usage flags";
  if (asset.confirmed_use) return "Confirmed use";
  if (asset.capability_only) return "Capability only; actual use is not established";
  return "Usage confirmation not established";
}

export function planningWindow(asset: CryptoAsset) {
  const values = [
    asset.data_lifetime_years,
    asset.migration_time_years,
    asset.threat_horizon_years,
  ];
  if (!values.every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0))
    return null;
  const years = asset.data_lifetime_years + asset.migration_time_years;
  return { years, overlap: asset.quantum_vulnerable && years >= asset.threat_horizon_years };
}

export function provenance(asset: CryptoAsset, field: string): string {
  const value = asset.risk_context_provenance?.[field];
  return value === "user-provided"
    ? "User-provided"
    : value === "policy-default"
      ? "Policy default"
      : "Not recorded";
}

export const CONTEXT_FIELDS = [
  ["business_criticality", "Business criticality"],
  ["data_sensitivity", "Data sensitivity"],
  ["exposure", "Exposure"],
  ["migration_effort", "Migration effort"],
  ["data_lifetime_years", "Required protection (years)"],
  ["migration_time_years", "Migration duration (years)"],
  ["threat_horizon_years", "Selected threat horizon (years)"],
] as const;

function text(value: unknown): string {
  return String(value ?? "Not recorded")
    .replace(/\r?\n/g, " ")
    .replace(/[\\`*_[\]<>#|]/g, "\\$&");
}

export function buildAlgorithmReport(
  asset: CryptoAsset,
  scan: ScanJob | null,
  generatedAt: string,
): string {
  const window = planningWindow(asset);
  const evidence = JSON.stringify(asset.evidence_json ?? {}, null, 2);
  const fence = "`".repeat(
    Math.max(3, ...(evidence.match(/`+/g) ?? []).map((value) => value.length + 1)),
  );
  return [
    `# ImpactX: ${text(reportTitle(asset))} occurrence report`,
    "",
    `Generated: ${text(generatedAt)}`,
    `Asset: ${asset.id} | Scan: ${asset.scan_job_id}`,
    `Logical asset: ${text(asset.logical_asset_id || "Not recorded")}`,
    `Repository: ${text(scan?.repo_path || "Unavailable")}`,
    `Scan completed: ${text(scan?.finished_at || "Not recorded")}`,
    `Scan status: ${text(scan?.status || "Unavailable")}`,
    `Scan coverage: ${scan?.coverage_pct != null ? `${scan.coverage_pct}%` : "Unavailable"}`,
    "",
    "## Scope and executive summary",
    "This report covers one detected occurrence, not every use of this algorithm in the repository.",
    `At ${text(asset.location)}, the risk engine assigned ${text(asset.priority_label)} priority (${asset.priority_score}/100).`,
    `Evidence status: ${text(evidenceStatus(asset))}.`,
    "",
    "## Observed configuration",
    ...[
      ["Algorithm", asset.algorithm],
      ["Category", asset.category],
      ["Key size (bits)", asset.key_size],
      ["Usage", asset.usage],
      ["Library", asset.library || "Not recorded"],
      ["Protocol", asset.protocol || "Not recorded"],
      ["Location", asset.location],
      ["Component", asset.evidence_json?.component || "Not recorded"],
    ].map(([label, value]) => `- ${label}: ${text(value)}`),
    "",
    "## Discovery evidence",
    `- Confidence: ${Number.isFinite(asset.confidence) ? `${Math.round(asset.confidence * 100)}%` : "Not recorded"}`,
    "Confidence describes detection evidence; it is not the probability that the algorithm is secure.",
    `- Evidence kind: ${text(asset.evidence_kind || "Not recorded")}`,
    `- Evidence quality: ${text(asset.evidence_quality || "Not recorded")}`,
    `- Sources: ${text(asset.source?.join(", ") || "Not recorded")}`,
    `- Conflict: ${asset.conflict ? "Yes; review conflicting evidence" : "No conflict flag recorded"}`,
    "",
    `${fence}json`,
    evidence,
    fence,
    "",
    "## Recorded risk assessment",
    `Priority: ${text(asset.priority_label)} (${asset.priority_score}/100).`,
    asset.quantum_vulnerable
      ? "Quantum exposure is flagged by the risk model."
      : "No modeled Shor exposure is flagged. This is not a blanket security assessment.",
    ...(asset.risk_reasons?.length
      ? asset.risk_reasons.map((reason) => `- ${text(reason)}`)
      : ["No risk reasons were recorded."]),
    "",
    "## Planning assumptions and provenance",
    ...CONTEXT_FIELDS.map(
      ([field, label]) => `- ${label}: ${text(asset[field])} (${provenance(asset, field)})`,
    ),
    window
      ? `Protection + migration: ${window.years} years. ${window.overlap ? "Overlaps" : "No modeled quantum overlap with"} the selected threat horizon.`
      : "Planning window cannot be calculated from the available values.",
    "The selected threat horizon is a planning scenario, not a prediction of quantum-computer availability.",
    "",
    "## Recorded migration recommendation",
    text(asset.pqc_candidate || "No recommendation recorded; review with the security owner."),
    `Hybrid transition recommended by the risk engine: ${asset.hybrid_recommended ? "Yes" : "No"}.`,
    "",
    "## Review and validation checklist",
    "- Confirm the operation, location, and configuration against the original evidence.",
    "- Resolve capability-only findings, evidence conflicts, and unrecorded configuration before prioritizing implementation.",
    "- Have the security and application owners validate the recorded recommendation for this usage and protocol.",
    "- Plan compatibility testing and rollback before deploying a change.",
    "- Rescan after remediation and compare the evidence and risk assessment.",
    "",
    "## Coverage and limitations",
    ...(scan?.blind_spots?.length
      ? scan.blind_spots.map((gap) => `- ${text(gap)}`)
      : [
          scan
            ? "No blind spots recorded by this scan; this does not prove complete coverage."
            : "Scan metadata and blind spots were unavailable.",
        ]),
    "This report reflects stored scanner evidence and risk-model outputs. Runtime behavior and unrecorded settings are not established by this report.",
    "",
  ].join("\n");
}

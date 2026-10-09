import { getAssets, getScan } from "../api/client";
import type { CryptoAsset, ScanJob } from "../types";

export type AlgorithmRollup = {
  name: string;
  count: number;
  quantum: number;
  confirmed: number;
  capability: number;
  conflicts: number;
  maxScore: number;
  keySizes: number[];
  usages: string[];
  recommendations: string[];
};
export type ScanReport = {
  scan: ScanJob;
  generatedAt: string;
  total: number;
  risks: Record<string, number>;
  quantum: number;
  conflicts: number;
  confirmed: number;
  capability: number;
  unknown: number;
  confidenceAverage: number | null;
  missingKeySize: number;
  missingProtocol: number;
  algorithms: AlgorithmRollup[];
  sources: Record<string, number>;
  evidenceKinds: Record<string, number>;
  priorities: Pick<
    CryptoAsset,
    | "id"
    | "algorithm"
    | "key_size"
    | "location"
    | "priority_score"
    | "priority_label"
    | "pqc_candidate"
  >[];
};

export async function loadScanReport(
  scanId: number,
  signal: AbortSignal,
  progress: (loaded: number, total: number) => void,
): Promise<ScanReport> {
  const check = () => {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  };
  check();
  const scan = await getScan(scanId);
  check();
  if (scan.id !== scanId) throw new Error("The returned scan does not match the requested report.");
  if (scan.status !== "completed")
    throw new Error(
      "A final report is available when this scan is completed. Open scan details to see its current status.",
    );
  const report: ScanReport = {
    scan,
    generatedAt: "",
    total: 0,
    risks: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    quantum: 0,
    conflicts: 0,
    confirmed: 0,
    capability: 0,
    unknown: 0,
    confidenceAverage: null,
    missingKeySize: 0,
    missingProtocol: 0,
    algorithms: [],
    sources: Object.create(null),
    evidenceKinds: Object.create(null),
    priorities: [],
  };
  const algorithms = new Map<string, AlgorithmRollup>();
  const ids = new Set<number>();
  let offset = 0,
    expected: number | undefined,
    confidenceSum = 0,
    confidenceCount = 0;
  while (true) {
    check();
    const page = await getAssets(scanId, { limit: 200, offset, sort: "priority", signal });
    check();
    if (!Number.isSafeInteger(page.total) || page.total < 0)
      throw new Error("The inventory returned an invalid total. Retry the report.");
    if (expected === undefined) expected = page.total;
    if (page.total !== expected)
      throw new Error(
        "The scan inventory changed while loading. Retry to generate a fresh report.",
      );
    if (
      (!page.items.length && offset < expected) ||
      page.items.length > 200 ||
      offset + page.items.length > expected
    )
      throw new Error("The inventory page was incomplete. Retry the report.");
    for (const asset of page.items) {
      if (asset.scan_job_id !== scanId || ids.has(asset.id))
        throw new Error("The inventory changed or returned duplicate findings. Retry the report.");
      ids.add(asset.id);
      const name = asset.algorithm || "Unknown algorithm";
      let group = algorithms.get(name);
      if (!group) {
        group = {
          name,
          count: 0,
          quantum: 0,
          confirmed: 0,
          capability: 0,
          conflicts: 0,
          maxScore: 0,
          keySizes: [],
          usages: [],
          recommendations: [],
        };
        algorithms.set(name, group);
      }
      group.count++;
      report.risks[asset.priority_label] = (report.risks[asset.priority_label] ?? 0) + 1;
      if (asset.quantum_vulnerable) {
        report.quantum++;
        group.quantum++;
      }
      if (asset.conflict) {
        report.conflicts++;
        group.conflicts++;
      }
      if (asset.confirmed_use && !asset.capability_only) {
        report.confirmed++;
        group.confirmed++;
      } else if (asset.capability_only && !asset.confirmed_use) {
        report.capability++;
        group.capability++;
      } else report.unknown++;
      if (Number.isFinite(asset.confidence)) {
        confidenceSum += asset.confidence;
        confidenceCount++;
      }
      if (!asset.key_size) report.missingKeySize++;
      else if (!group.keySizes.includes(asset.key_size)) group.keySizes.push(asset.key_size);
      if (!asset.protocol) report.missingProtocol++;
      if (asset.usage && !group.usages.includes(asset.usage)) group.usages.push(asset.usage);
      if (asset.pqc_candidate && !group.recommendations.includes(asset.pqc_candidate))
        group.recommendations.push(asset.pqc_candidate);
      group.maxScore = Math.max(group.maxScore, asset.priority_score || 0);
      for (const source of new Set(asset.source ?? []))
        report.sources[source] = (report.sources[source] ?? 0) + 1;
      const kind = asset.evidence_kind || "unknown";
      report.evidenceKinds[kind] = (report.evidenceKinds[kind] ?? 0) + 1;
      const { id, algorithm, key_size, location, priority_score, priority_label, pqc_candidate } =
        asset;
      report.priorities.push({
        id,
        algorithm,
        key_size,
        location,
        priority_score,
        priority_label,
        pqc_candidate,
      });
      report.priorities.sort((a, b) => b.priority_score - a.priority_score || a.id - b.id);
      report.priorities.length = Math.min(20, report.priorities.length);
    }
    offset += page.items.length;
    progress(offset, expected);
    if (offset >= expected) break;
  }
  report.total = offset;
  report.confidenceAverage = confidenceCount ? confidenceSum / confidenceCount : null;
  report.algorithms = [...algorithms.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
  report.generatedAt = new Date().toISOString();
  return report;
}

function md(value: unknown): string {
  return String(value ?? "Not recorded")
    .replace(/\r?\n/g, " ")
    .replace(/[\\`*_[\]<>#|]/g, "\\$&");
}
export function buildScanReport(report: ScanReport): string {
  const { scan } = report;
  return [
    `# ImpactX overall scan report: scan ${scan.id}`,
    "",
    `Generated (UTC): ${report.generatedAt}`,
    `Repository: ${md(scan.repo_path)}`,
    `Status: ${md(scan.status)}`,
    `Started: ${md(scan.started_at)}`,
    `Finished: ${md(scan.finished_at)}`,
    "",
    "## Executive summary",
    `All ${report.total} inventory occurrences were reviewed across ${report.algorithms.length} detected algorithm labels.`,
    `Critical: ${report.risks.CRITICAL}; high: ${report.risks.HIGH}; medium: ${report.risks.MEDIUM}; low: ${report.risks.LOW}.`,
    `Quantum exposure flagged: ${report.quantum}. Evidence conflicts: ${report.conflicts}.`,
    "",
    "## Scan execution and measured coverage",
    `- Coverage: ${scan.coverage_pct}% of the measured scan scope`,
    `- Files discovered: ${scan.total_files}; in scope: ${scan.in_scope_files}; scanned: ${scan.scanned_files}; failed: ${scan.failed_files}`,
    `- Duration: ${scan.duration_ms} ms`,
    `- Collector statistics: ${md(JSON.stringify(scan.collector_stats ?? {}))}`,
    "",
    "## Algorithm inventory (entire scan)",
    "| Algorithm label | Occurrences | Confirmed | Capability only | Quantum | Conflicts | Highest priority score | Recorded key sizes (bits) |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...report.algorithms.map(
      (a) =>
        `| ${md(a.name)} | ${a.count} | ${a.confirmed} | ${a.capability} | ${a.quantum} | ${a.conflicts} | ${a.maxScore} | ${md([...a.keySizes].sort((x, y) => x - y).join(", ") || "Not recorded")} |`,
    ),
    ...(report.total === 0 ? ["No detected occurrences were stored for this scan."] : []),
    "",
    "## Evidence assurance",
    `- Confirmed use: ${report.confirmed}; capability only: ${report.capability}; unknown or conflicting usage flags: ${report.unknown}`,
    `- Mean recorded detection confidence: ${report.confidenceAverage === null ? "Not recorded" : `${Math.round(report.confidenceAverage * 100)}%`}`,
    "Detection confidence is not a security probability. Missing key sizes or protocols are not automatically vulnerabilities.",
    `- Occurrences without a recorded key size: ${report.missingKeySize}`,
    `- Occurrences without a recorded protocol: ${report.missingProtocol}`,
    ...Object.entries(report.sources).map(
      ([source, count]) => `- ${md(source)} source supports ${count} occurrences`,
    ),
    "Source counts can overlap because one occurrence may have multiple sources.",
    ...Object.entries(report.evidenceKinds).map(
      ([kind, count]) => `- Evidence kind ${md(kind)}: ${count}`,
    ),
    "",
    `## Highest-priority occurrences (${report.priorities.length} shown of ${report.total})`,
    ...report.priorities.map(
      (a) =>
        `- Asset ${a.id}: ${md(a.algorithm)} at ${md(a.location)}; ${md(a.priority_label)} (${a.priority_score}/100). Recommendation: ${md(a.pqc_candidate || "Not recorded")}`,
    ),
    "The priority list is limited to 20 occurrences. Export the full inventory CSV for every row; open each occurrence report for exact evidence and planning assumptions.",
    "",
    "## Recorded migration recommendations by algorithm",
    ...report.algorithms.flatMap((a) => [
      `### ${md(a.name)}`,
      `Observed usages: ${md(a.usages.join(", ") || "Not recorded")}`,
      ...(a.recommendations.length
        ? a.recommendations.map((r) => `- ${md(r)}`)
        : ["No recommendation recorded."]),
    ]),
    "Recommendations come from stored per-occurrence risk assessments. Validate each recommendation against that occurrence's operation, configuration, and protocol.",
    "",
    "## Remediation review sequence",
    "1. Validate critical/high-priority occurrences and resolve conflicting or capability-only evidence.",
    "2. Review the occurrence reports and confirm business context, policy defaults, and planning horizons with owners.",
    "3. Confirm migration choices, test compatibility, and prepare rollback before deploying changes.",
    "4. Rescan and compare measured coverage, evidence, and risk priorities.",
    "",
    "## Failures and blind spots",
    ...(scan.failures ?? []).map((f) => `- ${md(f.path)}: ${md(f.reason)}`),
    ...(scan.failed_files > (scan.failures?.length ?? 0)
      ? ["Not every failed file has an individual failure record in the returned scan metadata."]
      : []),
    ...(scan.blind_spots?.length
      ? scan.blind_spots.map((gap) => `- ${md(gap)}`)
      : ["No blind spots recorded; this does not prove complete coverage."]),
    "",
    "## Scope and limitations",
    "Measured scan coverage does not prove complete coverage of runtime behavior.",
    "Algorithm labels are grouped as recorded; distinct variants are not silently merged. Metrics cover all returned inventory occurrences, not just a preview.",
    "Risk classifications and recommendations are scanner-model outputs. No modeled Shor exposure is not a blanket security assessment. Threat horizons in occurrence reports are planning assumptions, not arrival predictions.",
    "This report is generated from paginated reads of stored scan data. Subsequent risk-context edits can change the assessment; regenerate the report after edits.",
    "",
  ].join("\n");
}

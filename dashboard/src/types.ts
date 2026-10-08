// Shared contracts matching the ECDAT FastAPI responses.
export interface EvidenceEntry {
  [key: string]: unknown;
  source?: string;
  evidence?: Record<string, unknown>;
}
export type RiskLabel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export interface CryptoAsset {
  id: number;
  scan_job_id: number;
  logical_asset_id: string;
  algorithm: string;
  category: string;
  source: string[];
  location: string;
  evidence_json: {
    component?: string;
    confidence_by_source?: Record<string, number>;
    evidence_list?: EvidenceEntry[];
    reasons?: string[];
    conflicting_operations?: string[];
  };
  evidence_kind?: string;
  evidence_quality?: string;
  confirmed_use?: boolean;
  capability_only?: boolean;
  confidence: number;
  conflict: boolean;
  quantum_vulnerable: boolean;
  priority_score: number;
  priority_label: RiskLabel;
  pqc_candidate: string;
  business_criticality: string;
  usage: string;
  library: string;
  protocol: string;
  key_size: number | null;
  data_sensitivity: string;
  data_lifetime_years: number;
  migration_time_years: number;
  threat_horizon_years: number;
  exposure: string;
  migration_effort: string;
  risk_reasons: string[];
  hybrid_recommended: boolean;
  risk_context_provenance: Record<string, string>;
  created_at: string;
  review_status?: ReviewStatus | "unreviewed";
  review_version?: number;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_reason?: string | null;
}
export type ReviewStatus = "confirmed_use" | "false_positive" | "uncertain";
export interface AssetReview {
  id: number;
  asset_id: number;
  version: number;
  status: ReviewStatus;
  reason: string;
  reviewer: string;
  reviewed_at: string;
}
export type ComparisonStatus =
  "added" | "changed" | "unchanged" | "no_longer_observed" | "ambiguous" | "unknown";
export interface ComparisonFinding {
  id: number;
  algorithm: string;
  key_size: number | null;
  location: string;
  file: string | null;
  priority_score: number;
  review_status: string;
}
export interface ScanComparison {
  baseline_id: number;
  current_id: number;
  baseline_snapshot: string;
  current_snapshot: string;
  baseline_findings: number;
  current_findings: number;
  totals: Record<ComparisonStatus, number>;
  total: number;
  offset: number;
  limit: number;
  warnings: string[];
  items: {
    status: ComparisonStatus;
    reason: string;
    file: string | null;
    match_method: string;
    changed_fields: string[];
    baseline: ComparisonFinding[];
    current: ComparisonFinding[];
  }[];
}
export interface ScanJob {
  id: number;
  comparison_ready?: boolean;
  snapshot_id?: string;
  repo_path: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  assets_found: number;
  avg_confidence: number | null;
  total_files: number;
  in_scope_files: number;
  scanned_files: number;
  failed_files: number;
  coverage_pct: number;
  duration_ms: number;
  collector_stats: Record<string, number | string>;
  blind_spots: string[];
  failures?: ScanFailure[];
}

export interface ScanFailure {
  path: string;
  reason: "unreadable" | "oversized" | "linked_file" | "parse_error" | "certificate_error";
}
export interface DashboardSummary {
  total_assets: number;
  high_risk_count: number;
  avg_confidence: number;
  coverage_pct: number;
  blind_spots: string[];
  risk_distribution: Record<RiskLabel, number>;
  quantum_vulnerable_count: number;
  conflict_count: number;
  latest_scan_id: number | null;
  collector_stats: Record<string, number | string>;
  confidence_distribution?: Record<string, number>;
}
export interface Evaluation {
  available: boolean;
  message?: string;
  scan_id: number;
  coverage_pct: number;
  duration_ms: number;
  expected?: number;
  found?: number;
  true_positives?: number;
  false_positives?: number;
  false_negatives?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  per_source?: Record<string, { findings: number; precision: number; recall: number }>;
  missed?: Array<{ component: string; algorithm: string }>;
  unexpected?: Array<{ component: string; algorithm: string }>;
  declared_blind_spots?: Array<Record<string, string>>;
}
export interface RiskReport {
  title: string;
  scan_id: number;
  repository: string;
  coverage_pct: number;
  summary: Record<string, unknown>;
  blind_spots: string[];
  migration_priorities: Array<{
    asset_id: number;
    algorithm: string;
    location: string;
    score: number;
    label: RiskLabel;
    reasons: string[];
    recommendation: string;
    hybrid: boolean;
  }>;
}

export interface CbomEntry {
  $schema?: string;
  bomFormat?: string;
  specVersion?: string;
  serialNumber?: string;
  bom_format?: string;
  spec_version?: string;
  serial_number?: string;
  metadata?: Record<string, unknown>;
  components?: CbomComponent[];
  vulnerabilities?: unknown[];
  dependencies?: unknown[];
  services?: unknown[];
  version?: number;
}

export interface CbomComponent {
  cryptoProperties?: Record<string, unknown>;
  type?: string;
  name?: string;
  purl?: string;
  description?: string;
  hashes?: unknown[];
  properties?: Array<{ name: string; value: string }>;
  riskScore?: number;
  riskLabel?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  quantumVulnerable?: boolean;
  keySize?: number | null;
  protocol?: string;
  migrationRecommendation?: string;
  evidence?: {
    algorithm?: string;
    category?: string;
    location?: string;
    usage?: string;
    library?: string;
    confidence?: number;
    source?: string[];
  }[];
}

export interface ScanDetail extends ScanJob {
  assets: CryptoAsset[];
  assets_total: number;
  summary: DashboardSummary;
}

// ── Evidence graph ──────────────────────────────────────────────────────────────
export type GraphNodeType = "asset" | "evidence";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  logical_asset_id?: string;
  operation_anchor?: string | null;
  confidence?: number | null;
  priority_score?: number | null;
  priority_label?: string | null;
  quantum_vulnerable?: boolean | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface EvidenceGraphResponse {
  scan_id: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

import { describe, expect, it } from "vitest";
import type { CryptoAsset } from "../types";
import {
  buildAlgorithmReport,
  evidenceStatus,
  planningWindow,
  provenance,
  reportTitle,
} from "./algorithmReport";

export const occurrence = {
  id: 17,
  scan_job_id: 9,
  logical_asset_id: "rsa-operation-17",
  algorithm: "RSA",
  category: "asymmetric",
  source: ["ast", "rule"],
  location: "src/sign.ts:24",
  evidence_json: {
    component: "signer",
    evidence_list: [{ source: "ast", evidence: { call: "sign" } }],
  },
  confidence: 0.92,
  conflict: false,
  quantum_vulnerable: true,
  priority_score: 80,
  priority_label: "HIGH",
  pqc_candidate: "Evaluate ML-DSA for this signature operation",
  business_criticality: "high",
  usage: "signature",
  library: "crypto",
  protocol: "",
  key_size: 2048,
  data_sensitivity: "high",
  data_lifetime_years: 10,
  migration_time_years: 3,
  threat_horizon_years: 12,
  exposure: "internet",
  migration_effort: "high",
  risk_reasons: ["Recorded quantum exposure", "Required protection overlaps the planning horizon"],
  hybrid_recommended: true,
  risk_context_provenance: { exposure: "user-provided", data_lifetime_years: "policy-default" },
  created_at: "2026-10-09T00:00:00Z",
  confirmed_use: true,
  capability_only: false,
  evidence_kind: "observed_operation",
  evidence_quality: "strong",
} satisfies CryptoAsset;

describe("occurrence report semantics", () => {
  it("preserves the exact occurrence, recommendation, evidence, and scope in export", () => {
    const report = buildAlgorithmReport(occurrence, null, "2026-10-09T01:00:00Z");
    expect(report).toContain("RSA-2048 occurrence report");
    expect(report).toContain("Asset: 17 | Scan: 9");
    expect(report).toContain("src/sign.ts:24");
    expect(report).toContain(occurrence.pqc_candidate);
    expect(report).toContain('"call": "sign"');
    expect(report).toContain("one detected occurrence");
    expect(report).toContain("Scan metadata and blind spots were unavailable");
  });
  it("does not equate absence of modeled quantum exposure with security", () => {
    const asset = { ...occurrence, quantum_vulnerable: false };
    expect(planningWindow(asset)?.overlap).toBe(false);
    expect(buildAlgorithmReport(asset, null, "now")).toContain("not a blanket security assessment");
  });
  it("does not invent provenance or claim confirmed use from capability-only evidence", () => {
    expect(provenance(occurrence, "exposure")).toBe("User-provided");
    expect(provenance(occurrence, "data_lifetime_years")).toBe("Policy default");
    expect(provenance(occurrence, "migration_time_years")).toBe("Not recorded");
    expect(
      evidenceStatus({ ...occurrence, confirmed_use: false, capability_only: true }),
    ).toContain("actual use is not established");
    expect(evidenceStatus({ ...occurrence, capability_only: true })).toContain("Conflicting");
  });
  it("rejects missing planning inputs and avoids duplicating a key-size suffix", () => {
    expect(planningWindow({ ...occurrence, migration_time_years: NaN })).toBeNull();
    expect(reportTitle({ ...occurrence, algorithm: "RSA-2048" })).toBe("RSA-2048");
  });
  it("keeps untrusted evidence text inside a safe Markdown code fence", () => {
    const report = buildAlgorithmReport(
      { ...occurrence, evidence_json: { component: "```\n<script>alert(1)</script>" } },
      null,
      "now",
    );
    expect(report).toContain("````json");
    expect(report).toContain("\\<script\\>");
  });
});

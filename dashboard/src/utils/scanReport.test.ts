import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAssets, getScan } from "../api/client";
import type { CryptoAsset, ScanJob } from "../types";
import { buildScanReport, loadScanReport } from "./scanReport";
vi.mock("../api/client", () => ({ getAssets: vi.fn(), getScan: vi.fn() }));
const scan = {
  id: 7,
  status: "completed",
  repo_path: "/repo",
  blind_spots: ["Native binaries not inspected"],
  failed_files: 1,
  started_at: null,
  finished_at: null,
  assets_found: 201,
  avg_confidence: 0.8,
  total_files: 10,
  in_scope_files: 10,
  scanned_files: 9,
  coverage_pct: 90,
  duration_ms: 1000,
  collector_stats: { ast: 201 },
} satisfies ScanJob;
function asset(id: number, algorithm = "RSA"): CryptoAsset {
  return {
    id,
    scan_job_id: 7,
    algorithm,
    source: ["ast", "ast"],
    confidence: 0.8,
    priority_label: "HIGH",
    priority_score: id,
    evidence_kind: "observed_operation",
    confirmed_use: true,
    capability_only: false,
    quantum_vulnerable: algorithm === "RSA",
    key_size: 2048,
    usage: "encryption",
    pqc_candidate: "Review recorded recommendation",
    location: `src/${id}.ts`,
    conflict: false,
  } as CryptoAsset;
}
beforeEach(() => {
  vi.mocked(getScan).mockReset().mockResolvedValue(scan);
  vi.mocked(getAssets).mockReset();
});
describe("overall scan aggregation", () => {
  it("reads beyond the first page, counts each source once, and bounds the priority list", async () => {
    vi.mocked(getAssets)
      .mockResolvedValueOnce({
        total: 201,
        items: Array.from({ length: 200 }, (_, i) => asset(i + 1)),
      })
      .mockResolvedValueOnce({ total: 201, items: [asset(201, "AES")] });
    const progress = vi.fn();
    const result = await loadScanReport(7, new AbortController().signal, progress);
    expect(result.total).toBe(201);
    expect(result.algorithms.find((a) => a.name === "AES")?.count).toBe(1);
    expect(result.sources.ast).toBe(201);
    expect(result.quantum).toBe(200);
    expect(result.priorities).toHaveLength(20);
    expect(result.priorities[0].id).toBe(201);
    expect(getAssets).toHaveBeenLastCalledWith(
      7,
      expect.objectContaining({ offset: 200, limit: 200 }),
    );
    expect(progress).toHaveBeenLastCalledWith(201, 201);
    expect(buildScanReport(result)).toContain("All 201 inventory occurrences");
    expect(buildScanReport(result)).toContain("Native binaries not inspected");
  });
  it("rejects changing totals instead of presenting a partial report as complete", async () => {
    vi.mocked(getAssets)
      .mockResolvedValueOnce({ total: 2, items: [asset(1)] })
      .mockResolvedValueOnce({ total: 3, items: [asset(2)] });
    await expect(loadScanReport(7, new AbortController().signal, vi.fn())).rejects.toThrow(
      "inventory changed",
    );
  });
  it("rejects duplicate or cross-scan findings", async () => {
    vi.mocked(getAssets).mockResolvedValueOnce({ total: 2, items: [asset(1), asset(1)] });
    await expect(loadScanReport(7, new AbortController().signal, vi.fn())).rejects.toThrow(
      "duplicate",
    );
    vi.mocked(getAssets).mockResolvedValueOnce({
      total: 1,
      items: [{ ...asset(2), scan_job_id: 8 }],
    });
    await expect(loadScanReport(7, new AbortController().signal, vi.fn())).rejects.toThrow(
      "inventory changed",
    );
  });
  it("handles zero findings without implying no cryptographic usage", async () => {
    vi.mocked(getAssets).mockResolvedValue({ total: 0, items: [] });
    const report = await loadScanReport(7, new AbortController().signal, vi.fn());
    expect(report.total).toBe(0);
    expect(report.confidenceAverage).toBeNull();
    expect(buildScanReport(report)).toContain("does not prove complete coverage");
  });
  it("does not generate a final report for an unfinished scan", async () => {
    vi.mocked(getScan).mockResolvedValue({ ...scan, status: "running" });
    await expect(loadScanReport(7, new AbortController().signal, vi.fn())).rejects.toThrow(
      "completed",
    );
    expect(getAssets).not.toHaveBeenCalled();
  });
  it("stops when cancelled and does not invent confirmed-use flags", async () => {
    const abort = new AbortController();
    abort.abort();
    await expect(loadScanReport(7, abort.signal, vi.fn())).rejects.toMatchObject({
      name: "AbortError",
    });
    vi.mocked(getAssets).mockResolvedValue({
      total: 1,
      items: [{ ...asset(1), confirmed_use: undefined, capability_only: undefined }],
    });
    const result = await loadScanReport(7, new AbortController().signal, vi.fn());
    expect(result.unknown).toBe(1);
    expect(result.confirmed).toBe(0);
  });
});

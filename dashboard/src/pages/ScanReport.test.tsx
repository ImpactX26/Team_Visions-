import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadScanReport, type ScanReport } from "../utils/scanReport";
import ScanReportPage from "./ScanReport";
vi.mock("../utils/scanReport", () => ({ loadScanReport: vi.fn(), buildScanReport: vi.fn() }));
vi.mock("../api/client", () => ({ exportAssetsCsv: vi.fn() }));
beforeEach(() => vi.mocked(loadScanReport).mockReset());
function show(id = "7") {
  render(
    <MemoryRouter initialEntries={[`/reports/scans/${id}`]}>
      <Routes>
        <Route path="/reports/scans/:id" element={<ScanReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}
describe("overall report page", () => {
  it("rejects invalid IDs without requesting a report", () => {
    show("invalid");
    expect(
      screen.getByRole("heading", { name: "Overall scan report unavailable" }),
    ).toBeInTheDocument();
    expect(loadScanReport).not.toHaveBeenCalled();
  });
  it("labels full-scan scope, empty inventory, and incomplete coverage honestly", async () => {
    vi.mocked(loadScanReport).mockResolvedValue({
      scan: {
        id: 7,
        status: "completed",
        repo_path: "/repo",
        coverage_pct: 90,
        duration_ms: 1000,
        failed_files: 1,
        blind_spots: [],
        started_at: null,
        finished_at: null,
        assets_found: 0,
        avg_confidence: null,
        total_files: 10,
        in_scope_files: 10,
        scanned_files: 9,
        collector_stats: {},
      },
      generatedAt: "2026-10-09T00:00:00Z",
      total: 0,
      algorithms: [],
      risks: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
      quantum: 0,
      conflicts: 0,
      confirmed: 0,
      capability: 0,
      unknown: 0,
      confidenceAverage: null,
      missingKeySize: 0,
      missingProtocol: 0,
      priorities: [],
      sources: {},
      evidenceKinds: {},
    } satisfies ScanReport);
    show();
    expect(
      await screen.findByRole("heading", { name: "Overall scan #7 report" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/no preview truncation/)).toBeInTheDocument();
    expect(
      screen.getByText(/before concluding the repository has no cryptographic usage/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Not every failed file/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Full inventory CSV" })).toBeInTheDocument();
  });
});

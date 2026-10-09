import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAsset, getScan } from "../api/client";
import AlgorithmReportPage from "./AlgorithmReport";
import type { CryptoAsset } from "../types";

vi.mock("../api/client", () => ({ getAsset: vi.fn(), getScan: vi.fn() }));
const asset = {
  id: 17,
  scan_job_id: 9,
  algorithm: "RSA",
  key_size: 2048,
  category: "asymmetric",
  source: ["ast"],
  location: "src/sign.ts:24",
  evidence_json: {},
  confidence: 0.9,
  priority_label: "HIGH",
  priority_score: 80,
  confirmed_use: true,
  pqc_candidate: "Evaluate ML-DSA",
  risk_reasons: ["Signature exposure"],
  risk_context_provenance: {},
  quantum_vulnerable: true,
  data_lifetime_years: 10,
  migration_time_years: 3,
  threat_horizon_years: 12,
} as CryptoAsset;
function show(path = "/reports/algorithms/17") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reports/algorithms/:id" element={<AlgorithmReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.mocked(getAsset).mockReset();
  vi.mocked(getScan).mockReset();
});
describe("AlgorithmReportPage", () => {
  it("uses the occurrence's own scan and displays missing metadata honestly", async () => {
    vi.mocked(getAsset).mockResolvedValue(asset);
    vi.mocked(getScan).mockRejectedValue(new Error("offline"));
    show();
    expect(await screen.findByRole("heading", { name: "RSA-2048 report" })).toBeInTheDocument();
    expect(getAsset).toHaveBeenCalledWith(17);
    expect(getScan).toHaveBeenCalledWith(9);
    expect(screen.getByText("Signature exposure")).toBeInTheDocument();
    expect(screen.getByText("Evaluate ML-DSA")).toBeInTheDocument();
    expect(screen.getByText(/Scan metadata and blind spots are unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute(
      "href",
      "/reports?scan_id=9",
    );
  });
  it("does not request an invalid occurrence ID", async () => {
    show("/reports/algorithms/not-a-number");
    expect(
      await screen.findByRole("heading", { name: "Algorithm report unavailable" }),
    ).toBeInTheDocument();
    expect(getAsset).not.toHaveBeenCalled();
  });
  it("can retry a failed request", async () => {
    vi.mocked(getAsset).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(asset);
    vi.mocked(getScan).mockRejectedValue(new Error("offline"));
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Retry report" }));
    expect(await screen.findByRole("heading", { name: "RSA-2048 report" })).toBeInTheDocument();
  });
});

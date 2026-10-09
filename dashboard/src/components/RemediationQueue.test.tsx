import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RemediationQueue, { guidance } from "./RemediationQueue";
import type { CryptoAsset } from "../types";
vi.mock("../api/client", () => ({
  getDashboardSummary: vi.fn().mockResolvedValue({ latest_scan_id: 42 }),
  getAssets: vi.fn().mockResolvedValue({
    total: 2,
    items: [
      {
        id: 1,
        algorithm: "RSA",
        location: "signer.py:8",
        priority_label: "HIGH",
        source: ["ast"],
        confidence: 1,
        usage: "signature",
        risk_reasons: ["Quantum exposure"],
      },
      {
        id: 2,
        algorithm: "AES",
        location: "storage.py:12",
        priority_label: "LOW",
        source: ["ast"],
        confidence: 1,
        usage: "encryption",
        risk_reasons: [],
      },
    ],
  }),
}));
describe("inventory remediation", () => {
  it("shows multiple actual finding locations rather than the fixture alone", async () => {
    render(
      <MemoryRouter>
        <RemediationQueue />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/signer.py:8/)).toBeTruthy();
    expect(screen.getByText(/storage.py:12/)).toBeTruthy();
    expect(screen.getByText("Plan a quantum-safe migration")).toBeTruthy();
    expect(screen.getByText("Review mode and key management")).toBeTruthy();
  });
  it("requires evidence review for uncertain capability observations", () => {
    expect(guidance({ algorithm: "RSA", capability_only: true } as CryptoAsset).action).toBe(
      "Validate use before changing code",
    );
  });
});

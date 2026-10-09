import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FindingRemediation from "./FindingRemediation";
import { canWrite, getAssetRemediationPreview, verifyAssetRemediation } from "../api/client";
vi.mock("../api/client", () => ({
  canWrite: vi.fn(),
  getAssetRemediationPreview: vi.fn(),
  verifyAssetRemediation: vi.fn(),
}));
const plan = {
  asset_id: 12,
  scan_id: 8,
  algorithm: "MD5",
  location: "integrity.py",
  target: "SHA-256",
  mode: "patch_available",
  reason: "Matched source",
  checks: ["Confirm usage"],
  limitations: ["File scope only"],
  source_sha256: "a".repeat(64),
  file: "integrity.py",
  before_source: "hashlib.md5(data)",
  after_source: "hashlib.sha256(data)",
  diff: "-md5\n+sha256",
  rollback_diff: "-sha256\n+md5",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(canWrite).mockReturnValue(true);
  vi.mocked(getAssetRemediationPreview).mockResolvedValue(
    plan as Awaited<ReturnType<typeof getAssetRemediationPreview>>,
  );
});
describe("finding-specific review", () => {
  it("requires reviewed checksum usage and submits the finding fingerprint", async () => {
    const user = userEvent.setup();
    vi.mocked(verifyAssetRemediation).mockResolvedValue({
      asset_id: 12,
      scan_id: 8,
      run_id: "run",
      generated_at: "now",
      status: "scanner_verified",
      scope: "Application tests required",
      receipt_sha256: "receipt",
      checks: [{ name: "Observed replacement", passed: true }],
      before: {
        findings: [],
        scanned_files: 1,
        in_scope_files: 1,
        coverage_pct: 100,
        failed_files: 0,
      },
      after: {
        findings: [],
        scanned_files: 1,
        in_scope_files: 1,
        coverage_pct: 100,
        failed_files: 0,
      },
    } as Awaited<ReturnType<typeof verifyAssetRemediation>>);
    render(<FindingRemediation id={12} />);
    const action = await screen.findByRole("button", { name: "Apply to isolated copy & rescan" });
    expect(action).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Before / after source" }));
    expect(screen.getByText("hashlib.md5(data)")).toBeTruthy();
    await user.click(screen.getByRole("checkbox"));
    await user.click(action);
    expect(verifyAssetRemediation).toHaveBeenCalledWith(12, "a".repeat(64));
    expect(
      await screen.findByText("Source scanner checks passed · application tests required"),
    ).toBeTruthy();
  });
  it("shows a manual plan without an apply action when no safe recipe exists", async () => {
    vi.mocked(getAssetRemediationPreview).mockResolvedValue({
      ...plan,
      algorithm: "RSA",
      mode: "manual_review",
      diff: undefined,
      source_sha256: undefined,
    } as Awaited<ReturnType<typeof getAssetRemediationPreview>>);
    render(<FindingRemediation id={19} />);
    expect(await screen.findByText(/Manual implementation required/)).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Apply to isolated/ })).toBeNull();
  });
  it("prevents viewers from running verification even after reviewing", async () => {
    vi.mocked(canWrite).mockReturnValue(false);
    render(<FindingRemediation id={12} />);
    const action = await screen.findByRole("button", { name: /Apply to isolated/ });
    await userEvent.click(screen.getByRole("checkbox"));
    expect(action).toBeDisabled();
    expect(verifyAssetRemediation).not.toHaveBeenCalled();
  });
});

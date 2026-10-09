import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canWrite, getRemediationPreview, verifyRemediation } from "../api/client";
import RemediationLab from "./RemediationLab";
vi.mock("../components/RemediationQueue", () => ({ default: () => null }));

vi.mock("../api/client", async (importOriginal) => ({
  ApiError: (await importOriginal<typeof import("../api/client")>()).ApiError,
  canWrite: vi.fn(),
  getRemediationPreview: vi.fn(),
  verifyRemediation: vi.fn(),
  getDashboardSummary: vi.fn().mockResolvedValue({ latest_scan_id: null }),
  getAssets: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));
const plan = {
  recipe_id: "fixture",
  title: "Fixture",
  before_source: "before",
  after_source: "after",
  source_sha256: "a".repeat(64),
  diff: "- md5\n+ sha256",
  limitations: ["Stored digests require migration."],
  collision_preview: {
    payload_a: "00".repeat(128),
    payload_b: "01".repeat(128),
    changed_offsets: [0],
    md5_a: "same-md5",
    md5_b: "same-md5",
    sha256_a: "sha-original",
    sha256_b: "sha-substitute",
  },
};
function show() {
  return render(
    <MemoryRouter>
      <RemediationLab />
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(canWrite).mockReturnValue(true);
  vi.mocked(getRemediationPreview).mockResolvedValue(plan);
});
describe("RemediationLab", () => {
  it("lets reviewers inspect the collision before any verification runs", async () => {
    show();
    expect(
      await screen.findByText("Identical digests — substitution is invisible to MD5."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^SHA-256$/ }));
    expect(
      screen.getByText("Different digests — SHA-256 distinguishes this pair."),
    ).toBeInTheDocument();
    expect(screen.getByText("sha-original")).toBeInTheDocument();
    expect(screen.getByText("sha-substitute")).toBeInTheDocument();
    expect(verifyRemediation).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Before / after source" }));
    expect(screen.getByText("Before · MD5")).toBeInTheDocument();
  });
  it("requires review and never claims success when verification fails", async () => {
    vi.mocked(verifyRemediation).mockRejectedValue(new Error("offline"));
    show();
    const button = await screen.findByRole("button", { name: "Apply to isolated copy & verify" });
    expect(button).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(button);
    expect(verifyRemediation).toHaveBeenCalledWith(plan.source_sha256);
    expect(await screen.findByRole("alert")).toHaveTextContent("No resolution is claimed");
    expect(
      screen.queryByText("The weak checksum was replaced. The checks passed."),
    ).not.toBeInTheDocument();
    expect(button).toBeEnabled();
  });
  it("keeps verification disabled for read-only accounts", async () => {
    vi.mocked(canWrite).mockReturnValue(false);
    show();
    const button = await screen.findByRole("button", { name: "Apply to isolated copy & verify" });
    await userEvent.click(screen.getByRole("checkbox"));
    expect(button).toBeDisabled();
    expect(verifyRemediation).not.toHaveBeenCalled();
  });
});

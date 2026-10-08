import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import ScanCompare from "./ScanCompare";

const { getScanComparison } = vi.hoisted(() => ({ getScanComparison: vi.fn() }));
vi.mock("../api/client", () => ({ getScanComparison }));
const result = {
  baseline_id: 1,
  current_id: 2,
  baseline_findings: 1,
  current_findings: 1,
  total: 1,
  offset: 0,
  limit: 50,
  totals: { added: 0, changed: 1, unchanged: 0, no_longer_observed: 0, ambiguous: 0, unknown: 0 },
  warnings: ["Absence does not verify remediation."],
  items: [
    {
      status: "changed",
      file: "crypto.py",
      reason: "Unique context",
      changed_fields: ["algorithm"],
      baseline: [
        {
          id: 11,
          algorithm: "MD5",
          location: "crypto.py",
          priority_score: 60,
          review_status: "unreviewed",
        },
      ],
      current: [
        {
          id: 12,
          algorithm: "SHA-256",
          location: "crypto.py",
          priority_score: 0,
          review_status: "unreviewed",
        },
      ],
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  getScanComparison.mockResolvedValue(result);
});

it("shows evidence links and truthful group counts", async () => {
  render(
    <MemoryRouter initialEntries={["/compare?baseline_id=1&current_id=2"]}>
      <ScanCompare />
    </MemoryRouter>,
  );
  expect(await screen.findByText("Unique context")).toBeVisible();
  expect(screen.getByRole("link", { name: "MD5 · #11" })).toHaveAttribute("href", "/assets/11");
  expect(screen.getByRole("link", { name: "SHA-256 · #12" })).toHaveAttribute("href", "/assets/12");
  expect(screen.getByText("Absence does not verify remediation.")).toBeVisible();
  expect(screen.getByText("Showing 1–1 of 1 groups")).toBeVisible();
  expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
});

it("submits scan IDs and filters server-side", async () => {
  render(
    <MemoryRouter initialEntries={["/compare"]}>
      <ScanCompare />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Baseline scan ID"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Current scan ID"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "Compare scans" }));
  await screen.findByText("Unique context");
  fireEvent.change(screen.getByLabelText("Filter comparison"), { target: { value: "unknown" } });
  await waitFor(() => expect(getScanComparison).toHaveBeenLastCalledWith(1, 2, 0, "unknown"));
});

it("shows compatibility failures without stale findings", async () => {
  getScanComparison.mockRejectedValue(
    new Error("Incompatible scanner version; comparison refused"),
  );
  render(
    <MemoryRouter initialEntries={["/compare?baseline_id=1&current_id=2"]}>
      <ScanCompare />
    </MemoryRouter>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Incompatible scanner version");
  expect(screen.queryByText("Unique context")).not.toBeInTheDocument();
});

it("loads subsequent pages with complete totals", async () => {
  getScanComparison.mockResolvedValue({
    ...result,
    total: 201,
    items: Array.from({ length: 50 }, () => result.items[0]),
  });
  render(
    <MemoryRouter initialEntries={["/compare?baseline_id=1&current_id=2"]}>
      <ScanCompare />
    </MemoryRouter>,
  );
  await screen.findByText("Showing 1–50 of 201 groups");
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await waitFor(() => expect(getScanComparison).toHaveBeenLastCalledWith(1, 2, 50, ""));
});

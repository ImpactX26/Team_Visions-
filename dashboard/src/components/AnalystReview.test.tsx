import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import AnalystReview from "./AnalystReview";
import type { CryptoAsset } from "../types";

const { getAssetReviews, reviewAsset, canWrite } = vi.hoisted(() => ({
  getAssetReviews: vi.fn(),
  reviewAsset: vi.fn(),
  canWrite: vi.fn(),
}));
vi.mock("../api/client", () => ({ getAssetReviews, reviewAsset, canWrite }));
const asset = {
  id: 12,
  review_version: 3,
  review_status: "uncertain",
  reviewed_by: "alice",
  review_reason: "dynamic call",
} as CryptoAsset;

beforeEach(() => {
  vi.clearAllMocks();
  getAssetReviews.mockResolvedValue([]);
  canWrite.mockReturnValue(true);
});

it("saves a reason with the current version and displays refreshed history", async () => {
  const updated = { ...asset, review_version: 4, review_status: "confirmed_use" as const };
  const onSaved = vi.fn();
  reviewAsset.mockResolvedValue(updated);
  const { rerender } = render(<AnalystReview asset={asset} onSaved={onSaved} />);
  await screen.findByText("No analyst reviews recorded.");
  expect(screen.getByRole("button", { name: "Save review" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Review decision"), {
    target: { value: "confirmed_use" },
  });
  fireEvent.change(screen.getByLabelText("Review reason"), {
    target: { value: "  verified call  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save review" }));
  await screen.findByText("Review saved.");
  expect(reviewAsset).toHaveBeenCalledWith(12, {
    status: "confirmed_use",
    reason: "verified call",
    expected_version: 3,
  });
  expect(onSaved).toHaveBeenCalledWith(updated);
  getAssetReviews.mockResolvedValue([
    {
      id: 1,
      version: 4,
      status: "confirmed_use",
      reason: "verified call",
      reviewer: "alice",
      reviewed_at: "2026-10-08T12:00:00Z",
    },
  ]);
  rerender(<AnalystReview asset={updated} onSaved={onSaved} />);
  expect(await screen.findByText("verified call")).toBeVisible();
});

it("keeps read-only review history visible without write controls", async () => {
  canWrite.mockReturnValue(false);
  render(<AnalystReview asset={asset} onSaved={vi.fn()} />);
  await screen.findByText("No analyst reviews recorded.");
  expect(screen.getByText("dynamic call")).toBeVisible();
  expect(screen.queryByLabelText("Review decision")).not.toBeInTheDocument();
});

it("preserves the draft and reports failed or stale saves", async () => {
  reviewAsset.mockRejectedValue(new Error("409"));
  const onSaved = vi.fn();
  render(<AnalystReview asset={asset} onSaved={onSaved} />);
  await screen.findByText("No analyst reviews recorded.");
  fireEvent.change(screen.getByLabelText("Review reason"), { target: { value: "needs analysis" } });
  fireEvent.click(screen.getByRole("button", { name: "Save review" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Review was not saved");
  expect(screen.getByLabelText("Review reason")).toHaveValue("needs analysis");
  expect(onSaved).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("button", { name: "Save review" })).toBeEnabled());
});

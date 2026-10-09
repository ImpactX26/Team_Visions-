import { expect, test, type Page } from "@playwright/test";

const session = {
  access_token: "test-access-token",
  role: "admin",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

async function mockApi(page: Page) {
  await page.route("http://127.0.0.1:4173/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/login") {
      const body = route.request().postDataJSON() as { username: string; password: string };
      if (body.username !== "admin" || body.password !== "valid-password") {
        return route.fulfill({ status: 401, json: { detail: "Invalid credentials" } });
      }
      return route.fulfill({ json: session });
    }
    if (path === "/api/dashboard/summary") {
      return route.fulfill({
        json: {
          total_assets: 0,
          high_risk_count: 0,
          avg_confidence: 0,
          coverage_pct: 0,
          blind_spots: [],
          risk_distribution: {},
          quantum_vulnerable_count: 0,
          conflict_count: 0,
          latest_scan_id: null,
          collector_stats: {},
        },
      });
    }
    if (path === "/api/evaluation") {
      return route.fulfill({ status: 404, json: { detail: "No evaluation" } });
    }
    if (path === "/api/scans") return route.fulfill({ json: [] });
    if (path === "/api/scan") return route.fulfill({ json: { scan_id: 41, status: "running" } });
    if (path === "/api/scans/41") {
      return route.fulfill({
        json: {
          id: 41,
          repo_path: "/test-repo",
          status: "running",
          started_at: null,
          finished_at: null,
          assets_found: 0,
          avg_confidence: null,
          total_files: 1,
          in_scope_files: 1,
          scanned_files: 0,
          failed_files: 0,
          coverage_pct: 0,
          duration_ms: 0,
          collector_stats: { _files_processed: 0, _files_total: 1 },
          blind_spots: [],
        },
      });
    }
    return route.fulfill({ status: 404, json: { detail: `Unhandled test route: ${path}` } });
  });
}

test.beforeEach(async ({ page }) => mockApi(page));

test("invalid credentials remain on the sign-in screen", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("invalid");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Invalid username or password");
});

test("an administrator can sign in and start a repository scan", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("valid-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Start with evidence, not assumptions." }),
  ).toBeVisible();

  await page.getByRole("link", { name: "New scan" }).click();
  await page.getByRole("textbox", { name: "Repository path" }).fill("/test-repo");
  await page.getByRole("button", { name: "Start scan" }).click();
  await expect(page.getByRole("heading", { name: "Scanning repository" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel scan" })).toBeVisible();
});

for (const reduced of [false, true]) {
  test(`scan motion preserves measured progress and stops on cancellation (${reduced ? "reduced" : "normal"})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    let status = "running";
    await page.route("**/api/scans/41", (route) =>
      route.fulfill({
        json: {
          id: 41,
          repo_path: "/test-repo",
          status,
          started_at: null,
          finished_at: null,
          assets_found: 2,
          total_files: 10,
          in_scope_files: 10,
          scanned_files: 4,
          failed_files: 0,
          coverage_pct: 40,
          collector_stats: { _phase: "scanning", _files_processed: 4, _files_total: 10 },
          blind_spots: [],
        },
      }),
    );
    await page.route("**/api/scans/41/cancel", (route) => {
      status = "cancelled";
      return route.fulfill({ json: { status } });
    });
    await page.goto("/");
    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password").fill("valid-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("link", { name: "New scan" }).click();
    await page.getByRole("textbox", { name: "Repository path" }).fill("/test-repo");
    await page.getByRole("button", { name: "Start scan" }).click();
    const progress = page.getByRole("progressbar", { name: "File processing progress" });
    await expect(progress).toHaveAttribute("aria-valuenow", "40");
    await expect(page.locator(".scan-activity")).toBeVisible();
    await expect(page.locator(".scan-activity path")).toHaveCount(reduced ? 1 : 2);
    await expect(page.locator(".scan-progress-bar")).toHaveCSS(
      "transform",
      "matrix(0.4, 0, 0, 1, 0, 0)",
    );
    if (!reduced) {
      const signal = page.locator(".scan-activity path").nth(1);
      const offset = await signal.getAttribute("stroke-dashoffset");
      await expect.poll(() => signal.getAttribute("stroke-dashoffset")).not.toBe(offset);
    }
    await page.screenshot({
      path: `../tmp/motion-evidence/scan-${reduced ? "reduced" : "active"}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Cancel scan" }).click();
    await expect(page.getByRole("heading", { name: "Scan cancelled" })).toBeVisible();
    await expect(page.locator(".scan-activity")).toHaveCount(0);
    await expect(progress).toHaveCount(0);
  });
}

// Real scan/edit/rescan comparison, confined to the caller's disposable folder.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(join(root, "dashboard/package.json"));
const { chromium, expect } = require("@playwright/test");
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
const api = process.env.ECDAT_REHEARSAL_API;
const folder = process.env.ECDAT_REHEARSAL_FOLDER;
if (!api?.startsWith("http://127.0.0.1:") || !folder) throw new Error("Disposable rehearsal configuration required");
const repo = join(folder, "comparison-repo");
await mkdir(repo, { recursive: true });
const file = join(repo, "crypto.py");
const baselineSource = "import hashlib\ndef digest(data):\n    result = hashlib.md5(data)\n    return result\n";
await writeFile(file, baselineSource);
const [username, account] = Object.entries(JSON.parse(process.env.ECDAT_USERS_JSON))[0];
const server = await createServer({ configFile: join(root, "dashboard/vite.config.ts"), root: join(root, "dashboard"),
  server: { host: "127.0.0.1", port: 0, strictPort: true, proxy: { "/api": { target: api, changeOrigin: true } } } });
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch();
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => { if (response.url().includes("/api/") && response.status() >= 400) errors.push(`API ${response.status()} ${new URL(response.url()).pathname}`); });
  await page.goto(origin);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Username")).toHaveCount(0);
  const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem("ecdat-session")));
  const get = async path => {
    const response = await fetch(api + path, { headers: { Authorization: `Bearer ${session.accessToken}` } });
    if (!response.ok) throw new Error(`Comparison API ${response.status()}: ${await response.text()}`);
    return response.json();
  };
  async function scan() {
    await page.goto(origin + "/scan");
    await page.getByRole("textbox", { name: "Repository path", exact: true }).fill(repo);
    const accepted = page.waitForResponse(r => r.url().endsWith("/api/scan") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Start scan", exact: true }).click();
    const response = await accepted;
    expect(response.status()).toBe(200);
    const { scan_id: id } = await response.json();
    await expect.poll(async () => (await get(`/api/scans/${id}`)).status, { timeout: 90000 }).toBe("completed");
    // Wait for the UI to consume terminal progress and clear its active-scan state.
    await page.getByRole("button", { name: "New scan", exact: true }).click();
    return id;
  }
  const baselineId = await scan();
  await writeFile(file, "\n\n" + baselineSource.replace("md5", "sha256"));
  const currentId = await scan();
  const result = await get(`/api/scans/compare?baseline_id=${baselineId}&current_id=${currentId}`);
  const changed = result.items.find(item => item.status === "changed" && item.changed_fields.includes("algorithm"));
  expect(changed).toBeTruthy();
  expect(changed.baseline[0].algorithm).toBe("MD5");
  expect(changed.current[0].algorithm).toBe("SHA-256");
  expect(result.totals.unknown).toBe(0);
  expect(result.totals.ambiguous).toBe(0);
  await page.goto(`${origin}/compare?baseline_id=${baselineId}&current_id=${currentId}`);
  await expect(page.getByRole("heading", { name: "Compare scans", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: `MD5 · #${changed.baseline[0].id}`, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: `SHA-256 · #${changed.current[0].id}`, exact: true })).toBeVisible();
  await page.getByRole("link", { name: `SHA-256 · #${changed.current[0].id}`, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Discovery assurance", exact: true })).toBeVisible();
  await page.goto(`${origin}/compare?baseline_id=${baselineId}&current_id=${currentId}`);
  await page.getByLabel("Filter comparison").selectOption("changed");
  await expect(page.getByText("Showing 1–1 of 1 groups")).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await expect(page.getByRole("button", { name: "Compare scans", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  await writeFile(join(folder, "comparison-result.json"), JSON.stringify({ baselineId, currentId, result }));
  console.log("PASS real baseline scan → moved/changed source → rescan → evidence-linked comparison");
  console.log("PASS comparison filter, 375px layout and no browser/API errors");
} finally {
  if (browser) await browser.close();
  await server.close();
}

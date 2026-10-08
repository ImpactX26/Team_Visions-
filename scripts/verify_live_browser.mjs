// Real browser/API rehearsal; the caller must supply a disposable API/database.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(join(root, "dashboard/package.json"));
const { chromium, expect } = require("@playwright/test");
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
const api = process.env.ECDAT_REHEARSAL_API;
const folder = process.env.ECDAT_REHEARSAL_FOLDER;
if (!api?.startsWith("http://127.0.0.1:") || !folder) throw new Error("Disposable rehearsal configuration required");
const [username, account] = Object.entries(JSON.parse(process.env.ECDAT_USERS_JSON))[0];
const server = await createServer({
  configFile: join(root, "dashboard/vite.config.ts"), root: join(root, "dashboard"),
  server: { host: "127.0.0.1", port: 0, strictPort: true, proxy: { "/api": { target: api, changeOrigin: true } } },
});
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch();
  const page = await browser.newPage({ acceptDownloads: true });
  const failures = [];
  page.on("pageerror", error => failures.push(error.message));
  page.on("response", response => {
    if (response.url().includes("/api/") && response.status() >= 400) failures.push(`API ${response.status()}`);
  });
  await page.goto(origin);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Username")).toHaveCount(0);
  console.log("PASS live browser sign-in");
  await page.goto(`${origin}/scan`);
  await page.getByRole("textbox", { name: "Repository path", exact: true }).fill(join(root, "test-repo"));
  const accepted = page.waitForResponse(r => r.url().endsWith("/api/scan") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Start scan", exact: true }).click();
  const job = await (await accepted).json();
  const session = await page.evaluate(() => JSON.parse(sessionStorage.getItem("ecdat-session")));
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const get = async path => {
    const response = await fetch(api + path, { headers });
    if (!response.ok) throw new Error(`Rehearsal API ${response.status}`);
    return response.json();
  };
  await expect.poll(async () => (await get(`/api/scans/${job.scan_id}`)).status, { timeout: 90000 }).toBe("completed");
  console.log("PASS live browser scan submission and real worker completion");
  const inventory = await get(`/api/assets?scan_job_id=${job.scan_id}&limit=200`);
  const before = inventory.items.find(a => a.algorithm === "RSA" && a.evidence_kind === "observed_operation");
  if (!before) throw new Error("Fixture RSA operation missing");
  await page.goto(`${origin}/assets/${before.id}`);
  await expect(page.locator("select#exposure")).toHaveValue(before.exposure);
  const exposure = before.exposure === "internet" ? "internal" : "internet";
  const edited = page.waitForResponse(r => r.url().endsWith(`/api/assets/${before.id}`) && r.request().method() === "PATCH");
  await page.locator("select#exposure").selectOption(exposure);
  const updated = await (await edited).json();
  expect(updated.evidence_json).toEqual(before.evidence_json);
  expect(updated.confidence).toBe(before.confidence);
  for (const [field, value] of Object.entries(before.risk_context_provenance)) {
    if (field !== "exposure") expect(updated.risk_context_provenance[field]).toBe(value);
  }
  await page.reload();
  await expect(page.locator("select#exposure")).toHaveValue(exposure);
  console.log("PASS live browser risk edit and reload with evidence/provenance preserved");
  for (const [path, heading] of [
    [`/assets?scan_id=${job.scan_id}`, "Cryptographic assets"],
    [`/scans/${job.scan_id}`, `Scan #${job.scan_id}`],
    [`/reports?scan_id=${job.scan_id}`, "ECDAT Cryptographic Risk and PQC Migration Report"],
    [`/evidence-graph?scan_id=${job.scan_id}`, "Dependency Graph"],
  ]) {
    await page.goto(origin + path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await page.goto(`${origin}/cbom?scan_id=${job.scan_id}`);
  const button = page.getByRole("button", { name: "Full JSON", exact: true });
  await expect(button).toBeEnabled();
  const downloadEvent = page.waitForEvent("download");
  await button.click();
  const download = await downloadEvent;
  const output = join(folder, "browser-cbom.json");
  await download.saveAs(output);
  const document = JSON.parse(await readFile(output, "utf8"));
  expect(document.components).toHaveLength(inventory.total);
  const component = document.components.find(c => c["bom-ref"] === `ecdat:asset:${before.id}`);
  const props = Object.fromEntries(component.properties.map(p => [p.name, p.value]));
  expect(Number(props["ecdat:asset:priority_score"])).toBe(updated.priority_score);
  expect(JSON.parse(props["ecdat:asset:risk_context_provenance"])).toEqual(updated.risk_context_provenance);
  const validation = spawnSync(join(root, ".venv/Scripts/python.exe"),
    [join(root, "scripts/validate_schema.py"), "--cbom", "--file", output], { encoding: "utf8", env: process.env });
  if (validation.status !== 0) throw new Error("Browser download failed offline schema validation");
  console.log(`PASS live browser complete JSON download: ${inventory.total} findings, offline schema valid`);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(button).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  expect(failures).toEqual([]);
  await writeFile(join(folder, "browser-result.json"), JSON.stringify({ scanId: job.scan_id, assetId: before.id, updated }));
  console.log("PASS inventory/detail/report/graph routes and 375px CBOM layout; no browser/API errors");
} finally {
  if (browser) await browser.close();
  await server.close();
}

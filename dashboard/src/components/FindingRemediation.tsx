import { useEffect, useState } from "react";
import { canWrite, getAssetRemediationPreview, verifyAssetRemediation } from "../api/client";
import type { AssetRemediationPlan, AssetRemediationResult } from "../types";

export default function FindingRemediation({ id }: { id: number }) {
  const [plan, setPlan] = useState<AssetRemediationPlan | null>(null);
  const [result, setResult] = useState<AssetRemediationResult | null>(null);
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setPlan(null);
    setResult(null);
    setReviewed(false);
    setError("");
    getAssetRemediationPreview(id)
      .then((value) => {
        if (active) setPlan(value);
      })
      .catch(() => {
        if (active) setError("Could not prepare this finding. Retry the source review.");
      });
    return () => {
      active = false;
    };
  }, [id, retry]);
  function download(content: string, name: string) {
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function verify() {
    if (!plan?.source_sha256 || !reviewed || busy || !canWrite()) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await verifyAssetRemediation(id, plan.source_sha256));
    } catch {
      setError(
        "Verification did not finish. Source or eligibility may have changed; reload the plan and review again. No resolution is claimed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="lab-finding-workflow">
      {error && (
        <p role="alert">
          {error}{" "}
          <button disabled={busy} onClick={() => setRetry((v) => v + 1)}>
            Reload finding plan
          </button>
        </p>
      )}
      {!plan && !error && <p role="status">Preparing finding-specific review…</p>}
      {plan && (
        <>
          <p className="eyebrow">
            {plan.mode === "patch_available"
              ? "Source patch available"
              : "Manual implementation required"}{" "}
            · Finding #{id}
          </p>
          <h3>
            {plan.algorithm} → {plan.target}
          </h3>
          <p>{plan.reason}</p>
          <div className="lab-review-grid">
            <section>
              <h3>Review the proposed change</h3>
              {plan.diff ? (
                <>
                  <div className="lab-actions">
                    <button aria-pressed={!source} onClick={() => setSource(false)}>
                      Unified diff
                    </button>
                    <button aria-pressed={source} onClick={() => setSource(true)}>
                      Before / after source
                    </button>
                  </div>
                  {source ? (
                    <>
                      <h4>Before · {plan.file}</h4>
                      <pre className="lab-diff">{plan.before_source}</pre>
                      <h4>After · {plan.file}</h4>
                      <pre className="lab-diff">{plan.after_source}</pre>
                    </>
                  ) : (
                    <pre className="lab-diff">{plan.diff}</pre>
                  )}
                  <button onClick={() => download(plan.diff!, `impactx-finding-${id}.patch`)}>
                    Download reviewed patch
                  </button>
                  <button
                    onClick={() =>
                      download(plan.rollback_diff!, `impactx-finding-${id}-rollback.patch`)
                    }
                  >
                    Download reverse patch
                  </button>
                </>
              ) : (
                <p>
                  A concrete code diff needs an operation-specific implementation. Use the source
                  evidence and migration checklist below to prepare it.
                </p>
              )}
            </section>
            <section>
              <h3>Review compatibility first</h3>
              <ul>
                {plan.checks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <ul>
                {plan.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {plan.mode === "patch_available" && (
                <>
                  <label className="lab-review-check">
                    <input
                      type="checkbox"
                      checked={reviewed}
                      disabled={busy}
                      onChange={(e) => setReviewed(e.target.checked)}
                    />
                    I reviewed the diff and confirm this operation is an integrity checksum, not
                    password storage, signing, or authentication.
                  </label>
                  <button
                    className="button"
                    disabled={!reviewed || busy || !canWrite()}
                    onClick={verify}
                  >
                    {busy
                      ? "Scanning disposable before / after copies…"
                      : "Apply to isolated copy & rescan"}
                  </button>
                  {!canWrite() && (
                    <p>Your account can review plans. Verification requires write access.</p>
                  )}
                </>
              )}
              <button
                onClick={() =>
                  download(JSON.stringify(plan, null, 2), `impactx-finding-${id}-plan.json`)
                }
              >
                Download migration plan
              </button>
            </section>
          </div>
          {result && (
            <section aria-live="polite">
              <h3>
                {result.status === "scanner_verified"
                  ? "Source scanner checks passed · application tests required"
                  : "Verification inconclusive"}
              </h3>
              <p>{result.scope}</p>
              <ul>
                {result.checks.map((check) => (
                  <li key={check.name}>
                    {check.passed ? "PASS" : "FAIL"} · {check.name}
                  </li>
                ))}
              </ul>
              <p>
                Files processed: before {result.before.scanned_files}/{result.before.in_scope_files}
                ; after {result.after.scanned_files}/{result.after.in_scope_files}.
              </p>
              <p>
                Before:{" "}
                {result.before.findings.map((f) => f.algorithm).join(", ") || "No observations"}
                <br />
                After:{" "}
                {result.after.findings.map((f) => f.algorithm).join(", ") || "No observations"}
              </p>
              <button
                onClick={() =>
                  download(
                    JSON.stringify(result, null, 2),
                    `impactx-finding-${id}-verification.json`,
                  )
                }
              >
                Download verification evidence
              </button>
              <p>
                Receipt SHA-256 (checksum, not a signature): <code>{result.receipt_sha256}</code>
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

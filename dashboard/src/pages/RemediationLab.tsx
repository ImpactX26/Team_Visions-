import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ApiError, canWrite, getRemediationPreview, verifyRemediation } from "../api/client";
import type { RemediationPlan, RemediationResult } from "../types";
import RemediationQueue from "../components/RemediationQueue";

export default function RemediationLab() {
  const reduced = useReducedMotion();
  const [plan, setPlan] = useState<RemediationPlan | null>(null);
  const [result, setResult] = useState<RemediationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [sourceView, setSourceView] = useState<"diff" | "source">("diff");
  const [resultView, setResultView] = useState<"summary" | "checks" | "evidence">("summary");
  const [reload, setReload] = useState(0);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!result) return;
    const frame = requestAnimationFrame(() => {
      resultHeading.current?.focus({ preventScroll: true });
      resultHeading.current?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "center",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [result, reduced]);
  useEffect(() => {
    let active = true;
    setError("");
    getRemediationPreview()
      .then((p) => {
        if (active) setPlan(p);
      })
      .catch(() => {
        if (active) setError("The rehearsal could not be loaded. Refresh to retry.");
      });
    return () => {
      active = false;
    };
  }, [reload]);
  async function verify() {
    if (!plan || busy || !reviewed || !canWrite()) return;
    setBusy(true);
    setError("");
    try {
      setResult(await verifyRemediation(plan.source_sha256));
      setResultView("summary");
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 429
          ? "Too many rehearsals. Wait a minute before trying again. Your last result remains available."
          : failure instanceof ApiError && failure.status === 409
            ? "The recipe preview changed. Reload the page and review the new diff before retrying."
            : "Verification could not finish. No resolution is claimed. Retry the rehearsal.",
      );
    } finally {
      setBusy(false);
    }
  }
  function downloadPatch(rollback = false) {
    if (!plan) return;
    try {
      const url = URL.createObjectURL(
        new Blob([rollback ? (plan.rollback_diff ?? "") : plan.diff], { type: "text/plain" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = rollback ? "impactx-checksum-rollback.patch" : "impactx-checksum.patch";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Patch download failed. Please retry.");
    }
  }
  function download(format: "json" | "markdown" = "json") {
    if (!result) return;
    setDownloadError("");
    try {
      const content =
        format === "json"
          ? JSON.stringify(result, null, 2)
          : [
              "# ImpactX remediation verification",
              `Run: ${result.run_id}`,
              `Generated: ${result.generated_at}`,
              `Verdict: ${result.status}`,
              `Scope: ${result.scope}`,
              "",
              "## Change",
              "```diff",
              result.diff,
              "```",
              "## Checks",
              ...result.checks.map((c) => `- ${c.passed ? "PASS" : "FAIL"}: ${c.name}`),
              "",
              "## Scanner comparison",
              ...(["removed", "introduced", "unchanged"] as const).flatMap((kind) =>
                result.comparison[kind].map(
                  ([algorithm, file]) => `- ${kind}: ${algorithm} in ${file}`,
                ),
              ),
              "",
              "## Coverage",
              `Before: ${result.before.scanned_files}/${result.before.in_scope_files} files; ${result.before.failed_files} failures.`,
              `After: ${result.after.scanned_files}/${result.after.in_scope_files} files; ${result.after.failed_files} failures.`,
              "",
              "## Compatibility and scope",
              ...result.limitations.map((item) => `- ${item}`),
              "",
              `Source SHA-256: ${result.source_sha256}`,
              `Patched source SHA-256: ${result.after_source_sha256}`,
              `Receipt checksum: ${result.receipt_sha256}`,
              "This checksum is not a digital signature.",
            ].join("\n");
      const url = URL.createObjectURL(
        new Blob([content], { type: format === "json" ? "application/json" : "text/markdown" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `impactx-remediation-${result.run_id}.${format === "json" ? "json" : "md"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setDownloadError("Evidence download failed. Please retry.");
    }
  }
  return (
    <div className="remediation-lab">
      <section className="hero">
        <div>
          <p className="eyebrow">Verified remediation rehearsal</p>
          <h1>Show the fix. Prove the difference.</h1>
          <p>
            Two different payloads. The same MD5 checksum. See the failure, review the fix, and
            verify the result.
          </p>
        </div>
        <Link className="button secondary" to="/reports">
          Back to reports
        </Link>
      </section>
      <RemediationQueue />
      <nav className="lab-path" aria-label="Remediation workflow">
        {[
          "Inspect the weakness",
          "Review the code diff",
          "Apply to isolated copy",
          "Verify & rescan",
        ].map((label, i) => (
          <span
            key={label}
            className={
              result && !busy
                ? "lab-step-complete"
                : busy && i === 2
                  ? "lab-step-current"
                  : i < 2 && plan
                    ? "lab-step-current"
                    : ""
            }
          >
            <b>{i + 1}</b>
            {label}
          </span>
        ))}
      </nav>
      <p className="lab-scope">
        Controlled checksum demonstration · Your project source stays untouched · Every result comes
        from this run
      </p>
      {error && (
        <p role="alert" className="callout error">
          {error}
          {!plan && (
            <button className="button secondary" onClick={() => setReload((n) => n + 1)}>
              Retry loading recipe
            </button>
          )}
        </p>
      )}
      {!plan && !error && <p role="status">Loading the supported recipe…</p>}
      {plan && (
        <>
          {plan.collision_preview && <CollisionExplorer evidence={plan.collision_preview} />}
          <div className="lab-recipe-heading">
            <div>
              <p className="eyebrow">Supported recipe · Python integrity checksum</p>
              <h2>Review one precise change.</h2>
            </div>
            <span className="report-chip">1 file · 1 replacement · Isolated copy</span>
          </div>
          <div className="lab-grid">
            <section className="panel lab-diff">
              <div className="panel-title">
                <h2>Review the proposed change</h2>
                <p>checksum.py · MD5 → SHA-256</p>
              </div>
              <div className="lab-view-controls" aria-label="Code view">
                <button aria-pressed={sourceView === "diff"} onClick={() => setSourceView("diff")}>
                  Unified diff
                </button>
                <button
                  aria-pressed={sourceView === "source"}
                  onClick={() => setSourceView("source")}
                >
                  Before / after source
                </button>
              </div>
              <button className="row-link lab-patch-download" onClick={() => downloadPatch()}>
                Download reviewed patch
              </button>
              {sourceView === "diff" ? (
                <pre className="lab-code" aria-label="Proposed code diff">
                  {plan.diff.split("\n").map((line, i) => (
                    <span
                      className={
                        line.startsWith("+")
                          ? "lab-added"
                          : line.startsWith("-")
                            ? "lab-removed"
                            : ""
                      }
                      key={i}
                    >
                      {line}
                    </span>
                  ))}
                </pre>
              ) : (
                <div className="lab-source-pair">
                  {[
                    ["Before · MD5", plan.before_source],
                    ["After · SHA-256", plan.after_source],
                  ].map(([label, source]) => (
                    <div key={label}>
                      <h3>{label}</h3>
                      <pre className="lab-code">
                        {source.split("\n").map((line, i) => (
                          <span key={i}>
                            <span className="lab-line-number">{i + 1}</span>
                            {line || " "}
                          </span>
                        ))}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="panel">
              <div className="panel-title">
                <h2>Review compatibility first</h2>
              </div>
              <ul className="lab-limitations">
                {plan.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <label className="lab-review">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                  disabled={busy}
                />
                <span>I reviewed the diff and checksum migration requirements.</span>
              </label>
              <button
                className="button wide"
                onClick={verify}
                disabled={busy || !reviewed || !canWrite()}
              >
                {busy
                  ? "Running checks and rescanning…"
                  : result
                    ? "Run verification again"
                    : "Apply to isolated copy & verify"}
              </button>
              {!canWrite() && <p>A security analyst or administrator can run this rehearsal.</p>}
              {busy && (
                <p role="status" aria-live="polite">
                  Running real scanner passes and checksum checks. A result appears when
                  verification finishes.
                </p>
              )}
            </section>
          </div>
        </>
      )}
      {result && (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.3 }}
        >
          <section className={`lab-verdict lab-verdict--${result.status}`} role="status">
            <div>
              <p className="eyebrow">
                {result.status === "verified"
                  ? "Verified in this rehearsal"
                  : "Verification incomplete"}
              </p>
              <h2 ref={resultHeading} tabIndex={-1}>
                {result.status === "verified"
                  ? "The weak checksum was replaced. The checks passed."
                  : "Evidence is insufficient to claim resolution."}
              </h2>
              <p>
                {result.checks.filter((check) => check.passed).length}/{result.checks.length} checks
                passed · Before and after coverage: {result.before.coverage_pct}% /{" "}
                {result.after.coverage_pct}%
                {result.duration_ms != null && (
                  <> · Completed in {result.duration_ms.toFixed(0)} ms</>
                )}
              </p>
            </div>
            <button className="button secondary" onClick={() => download()}>
              Download verification evidence
            </button>
          </section>
          {downloadError && <p role="alert">{downloadError}</p>}
          {busy && (
            <p role="status">
              A new verification is running. The evidence below is from the previous completed run.
            </p>
          )}
          <div className="lab-result-controls">
            <div className="lab-view-controls" aria-label="Verification result view">
              {(["summary", "checks", "evidence"] as const).map((view) => (
                <button
                  key={view}
                  aria-pressed={resultView === view}
                  onClick={() => setResultView(view)}
                >
                  {view === "summary"
                    ? "Outcome"
                    : view === "checks"
                      ? `Checks (${result.checks.length})`
                      : "Scanner evidence"}
                </button>
              ))}
            </div>
            <button className="button secondary" onClick={() => download("markdown")}>
              Download report
            </button>
          </div>
          <div hidden={resultView !== "summary"}>
            <section className="panel">
              <h2>What this run established</h2>
              <ul className="lab-limitations">
                {(result.verification_reasons ?? []).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <div className="lab-run-stats">
                <span>
                  <strong>
                    {result.before.scanned_files}/{result.before.in_scope_files}
                  </strong>{" "}
                  baseline files processed
                </span>
                <span>
                  <strong>
                    {result.after.scanned_files}/{result.after.in_scope_files}
                  </strong>{" "}
                  patched files processed
                </span>
                <span>
                  <strong>{result.before.failed_files + result.after.failed_files}</strong>{" "}
                  processing failures
                </span>
              </div>
              {result.stages && (
                <ol className="lab-execution">
                  {result.stages.map((stage) => (
                    <li key={stage.name}>
                      <span>{stage.name}</span>
                      <code>{stage.duration_ms.toFixed(1)} ms</code>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <div className="lab-grid">
              <section className="panel">
                <p className="eyebrow">Before · MD5</p>
                <h2>Different bytes. Identical checksums.</h2>
                <p>
                  The two {result.collision.payload_bytes}-byte fixtures differ at{" "}
                  {result.collision.different_bytes} byte positions.
                </p>
                <dl className="lab-digests">
                  <dt>Payload A</dt>
                  <dd>{result.collision.md5_a}</dd>
                  <dt>Payload B</dt>
                  <dd>{result.collision.md5_b}</dd>
                </dl>
                <p>
                  MD5 cannot distinguish this pair. A checksum-only comparison accepts the
                  substituted payload.
                </p>
              </section>
              <section className="panel">
                <p className="eyebrow">After · SHA-256</p>
                <h2>The substituted payload is distinguishable.</h2>
                <dl className="lab-digests">
                  <dt>Payload A</dt>
                  <dd>{result.collision.sha256_a}</dd>
                  <dt>Payload B</dt>
                  <dd>{result.collision.sha256_b}</dd>
                </dl>
                <p>
                  SHA-256 produces different digests for this pair. This demonstrates the fix for
                  these inputs.
                </p>
              </section>
            </div>
          </div>
          <div hidden={resultView !== "checks"}>
            <section className="panel">
              <div className="panel-title">
                <h2>Verification checks</h2>
                <p>Executed against the patched fixture and measured scanner output.</p>
              </div>
              <ul className="lab-checks">
                {result.checks.map((check) => (
                  <li key={check.name}>
                    <span className={check.passed ? "lab-pass" : "lab-fail"}>
                      {check.passed ? "PASS" : "FAIL"}
                    </span>
                    {check.name}
                  </li>
                ))}
              </ul>
            </section>
          </div>
          <div hidden={resultView !== "evidence"}>
            <div className="lab-comparison">
              {(["removed", "introduced", "unchanged"] as const).map((kind) => (
                <section className="panel" key={kind}>
                  <h2>
                    {kind === "removed"
                      ? "Removed observations"
                      : kind === "introduced"
                        ? "New observations"
                        : "Unchanged observations"}
                  </h2>
                  {result.comparison[kind].length ? (
                    result.comparison[kind].map(([algorithm, file]) => (
                      <p key={`${algorithm}-${file}`}>
                        <strong>{algorithm}</strong>
                        <br />
                        <code>{file}</code>
                      </p>
                    ))
                  ) : (
                    <p>None observed.</p>
                  )}
                  {result.status !== "verified" && kind === "removed" && (
                    <p>Absence alone does not establish resolution.</p>
                  )}
                </section>
              ))}
            </div>
            <section className="panel">
              <div className="panel-title">
                <h2>Scanner evidence</h2>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Pass</th>
                      <th>Algorithm</th>
                      <th>Location</th>
                      <th>Sources</th>
                      <th>Detection confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["before", "after"] as const).flatMap((pass) =>
                      result[pass].findings.map((finding, i) => (
                        <tr key={`${pass}-${i}`}>
                          <td>{pass}</td>
                          <td>{finding.algorithm}</td>
                          <td>
                            <code>{finding.location}</code>
                          </td>
                          <td>{finding.sources.join(", ")}</td>
                          <td>{Math.round(finding.confidence * 100)}%</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
              <p>Confidence is an evidence score, not a probability of security.</p>
            </section>
            <section className="panel">
              <h2>Reproducible evidence receipt</h2>
              <dl className="lab-digests">
                <dt>Original source SHA-256</dt>
                <dd>{result.source_sha256}</dd>
                <dt>Patched source SHA-256</dt>
                <dd>{result.after_source_sha256}</dd>
                <dt>Evidence checksum</dt>
                <dd>{result.receipt_sha256}</dd>
              </dl>
              <p>
                These hashes identify the source and exported evidence. They are not digital
                signatures or independent attestations.
              </p>
            </section>
          </div>
          <section className="panel lab-next">
            <div>
              <p className="eyebrow">Before applying this pattern in your application</p>
              <h2>Plan the checksum migration.</h2>
              <p>
                Update producers and consumers together, regenerate trusted stored digests, test
                compatibility, and prepare rollback. This rehearsal establishes behavior only for
                its controlled fixtures.
              </p>
            </div>
            <Link className="button secondary" to="/assets">
              Review your inventory →
            </Link>
          </section>
          {plan?.rollback_diff && (
            <details className="panel">
              <summary>Inspect rollback readiness</summary>
              <p>
                The reverse patch reconstructs the original fixture source. It restores MD5 and
                should only be used to rehearse rollback in this controlled example.
              </p>
              <pre className="lab-code">{plan.rollback_diff}</pre>
              <button className="button secondary" onClick={() => downloadPatch(true)}>
                Download reverse patch
              </button>
            </details>
          )}
          <p className="lab-scope">
            Run {result.run_id} · {result.generated_at}
            <br />
            {result.scope}
          </p>
        </motion.div>
      )}
    </div>
  );
}

function CollisionExplorer({
  evidence,
}: {
  evidence: NonNullable<RemediationPlan["collision_preview"]>;
}) {
  const [algorithm, setAlgorithm] = useState<"md5" | "sha256">("md5");
  const same = evidence[`${algorithm}_a`] === evidence[`${algorithm}_b`];
  return (
    <section className="panel lab-explorer" aria-label="Interactive collision evidence">
      <div className="lab-explorer-heading">
        <div>
          <p className="eyebrow">Inspect the failure before the fix</p>
          <h2>Would your integrity check detect the substitution?</h2>
          <p>
            Two controlled 128-byte payloads differ at {evidence.changed_offsets.length} positions.
            Compare their actual digests.
          </p>
        </div>
        <div className="lab-view-controls" aria-label="Compare digest algorithms">
          <button aria-pressed={algorithm === "md5"} onClick={() => setAlgorithm("md5")}>
            MD5
          </button>
          <button aria-pressed={algorithm === "sha256"} onClick={() => setAlgorithm("sha256")}>
            SHA-256
          </button>
        </div>
      </div>
      <div className="lab-payloads">
        {(["a", "b"] as const).map((id) => (
          <div key={id}>
            <span className="eyebrow">
              Payload {id.toUpperCase()} · {id === "a" ? "Original" : "Substitute"}
            </span>
            <code className="lab-live-digest">{evidence[`${algorithm}_${id}`]}</code>
          </div>
        ))}
      </div>
      <div className={same ? "lab-collision-alert" : "lab-collision-distinct"} role="status">
        <strong>
          {same
            ? "Identical digests — substitution is invisible to MD5."
            : "Different digests — SHA-256 distinguishes this pair."}
        </strong>
        <p>
          {same
            ? "A verifier comparing only these MD5 values cannot tell which payload it received."
            : "The same pair produces distinct SHA-256 values. The rehearsal below checks the patched verifier and rescans the source."}
        </p>
      </div>
      <details>
        <summary>Inspect the changed bytes ({evidence.changed_offsets.length} differences)</summary>
        <div className="lab-byte-comparison">
          {(["a", "b"] as const).map((id) => (
            <div key={id}>
              <h3>Payload {id.toUpperCase()}</h3>
              <div className="lab-byte-grid">
                {evidence[`payload_${id}`].match(/.{2}/g)?.map((byte, i) => (
                  <span
                    key={i}
                    className={evidence.changed_offsets.includes(i) ? "lab-byte-changed" : ""}
                    title={`Byte ${i}: ${byte}${evidence.changed_offsets.includes(i) ? " (changed)" : ""}`}
                  >
                    {byte}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p>
          Changed byte offsets: {evidence.changed_offsets.join(", ")} (zero-based). Highlighted
          bytes differ. These fixtures are inert data, not executable files.
        </p>
      </details>
    </section>
  );
}

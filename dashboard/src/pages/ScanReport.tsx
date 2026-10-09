import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { exportAssetsCsv } from "../api/client";
import Breadcrumb from "../components/Breadcrumb";
import { RiskBadge } from "../components/RiskBadge";
import { SkeletonPanel } from "../components/Skeletons";
import { buildScanReport, loadScanReport, type ScanReport } from "../utils/scanReport";

export default function ScanReportPage() {
  const { id } = useParams();
  const scanId = Number(id);
  const valid = /^\d+$/.test(id ?? "") && Number.isSafeInteger(scanId) && scanId > 0;
  const [report, setReport] = useState<ScanReport | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setReport(null);
    setError("");
    setProgress({ loaded: 0, total: 0 });
    setExportError("");
    if (valid)
      void loadScanReport(scanId, controller.signal, (loaded, total) => {
        if (!controller.signal.aborted) setProgress({ loaded, total });
      })
        .then((value) => {
          if (!controller.signal.aborted) setReport(value);
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(e instanceof Error ? e.message : "Unable to load the scan report.");
        });
    return () => controller.abort();
  }, [scanId, valid, reload]);
  if (!valid || error)
    return (
      <section className="state" role="alert">
        <h1>Overall scan report unavailable</h1>
        <p>{error || "Choose a valid scan from Scan history."}</p>
        {valid && (
          <button className="button secondary" onClick={() => setReload((v) => v + 1)}>
            Retry report
          </button>
        )}
        <Link className="button secondary" to={valid ? `/scans/${scanId}` : "/scans"}>
          Return to scan details
        </Link>
      </section>
    );
  if (!report || report.scan.id !== scanId)
    return (
      <div role="status" aria-live="polite">
        <p>
          Preparing overall scan report
          {progress.total
            ? `: ${progress.loaded.toLocaleString()} of ${progress.total.toLocaleString()} occurrences reviewed`
            : ""}
        </p>
        <p className="muted">Reviewing every inventory page. Large scans can take longer.</p>
        <SkeletonPanel />
        <SkeletonPanel />
      </div>
    );
  const { scan } = report;
  const download = () => {
    setExportError("");
    try {
      const url = URL.createObjectURL(
        new Blob([buildScanReport(report)], { type: "text/markdown;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `impactx-overall-scan-${scan.id}.md`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError("Markdown export failed. Retry or use Print / save PDF.");
    }
  };
  const csv = async () => {
    setExportError("");
    setExporting(true);
    try {
      await exportAssetsCsv(scan.id, { sort: "priority" });
    } catch {
      setExportError("Full inventory export failed. Please retry.");
    } finally {
      setExporting(false);
    }
  };
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Scan history", to: "/scans" },
          { label: `Scan #${scan.id}`, to: `/scans/${scan.id}` },
          { label: "Overall report" },
        ]}
      />
      <section className="hero compact">
        <div>
          <p className="eyebrow">Complete scan assessment</p>
          <h1>Overall scan #{scan.id} report</h1>
          <p className="path">{scan.repo_path}</p>
          <p>
            {report.total.toLocaleString()} occurrences · {report.algorithms.length} algorithm
            labels · {scan.coverage_pct}% measured coverage
          </p>
        </div>
        <div className="hero-actions">
          <button className="button secondary" onClick={download}>
            Download Markdown
          </button>
          <button className="button secondary" onClick={csv} disabled={exporting}>
            {exporting ? "Exporting inventory…" : "Full inventory CSV"}
          </button>
          <button className="button" onClick={() => window.print()}>
            Print / save PDF
          </button>
        </div>
      </section>
      {exportError && (
        <p className="callout error" role="alert">
          {exportError}
        </p>
      )}
      <section className="report-summary" aria-label="Overall risk summary">
        {Object.entries(report.risks).map(([label, count]) => (
          <span className="report-chip" key={label}>
            {count.toLocaleString()} {label.toLowerCase()}
          </span>
        ))}
        <span className="report-chip">{report.quantum.toLocaleString()} quantum-exposed</span>
        <span className="report-chip">{report.conflicts.toLocaleString()} evidence conflicts</span>
      </section>
      <section className="dashboard-grid" aria-label="Detailed overall scan report">
        <article className="panel span-full">
          <div className="panel-title">
            <h2>Executive summary</h2>
          </div>
          <p>
            This completed scan contains{" "}
            <strong>{report.total.toLocaleString()} detected occurrences</strong> across{" "}
            {report.algorithms.length} distinct algorithm labels.{" "}
            {(report.risks.CRITICAL + report.risks.HIGH).toLocaleString()} occurrences have critical
            or high migration priority.
          </p>
          <p>
            {report.quantum.toLocaleString()} occurrences have modeled quantum exposure.{" "}
            {report.conflicts.toLocaleString()} have conflicting evidence that requires review.
            These are risk-model flags, not proof of an exploitable vulnerability.
          </p>
          {report.total === 0 && (
            <p>
              No detected occurrences were stored. Review coverage and blind spots before concluding
              the repository has no cryptographic usage.
            </p>
          )}
          <dl className="facts">
            <dt>Report generated (IST)</dt>
            <dd>
              {new Date(report.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
            </dd>
            <dt>Report scope</dt>
            <dd>
              All {report.total.toLocaleString()} inventory occurrences; no preview truncation
            </dd>
            <dt>Repository</dt>
            <dd className="path">{scan.repo_path}</dd>
          </dl>
        </article>
        <article className="panel span-full">
          <div className="panel-title">
            <h2>Scan execution and coverage</h2>
            <p>Coverage applies to the measured scan scope.</p>
          </div>
          <dl className="facts">
            <dt>Status</dt>
            <dd>{scan.status}</dd>
            <dt>Started</dt>
            <dd>{scan.started_at || "Not recorded"}</dd>
            <dt>Finished</dt>
            <dd>{scan.finished_at || "Not recorded"}</dd>
            <dt>Duration</dt>
            <dd>{(scan.duration_ms / 1000).toFixed(2)} seconds</dd>
            <dt>Discovered files</dt>
            <dd>{scan.total_files}</dd>
            <dt>In-scope files</dt>
            <dd>{scan.in_scope_files}</dd>
            <dt>Scanned files</dt>
            <dd>{scan.scanned_files}</dd>
            <dt>Failed files</dt>
            <dd>{scan.failed_files}</dd>
            <dt>Measured coverage</dt>
            <dd>{scan.coverage_pct}%</dd>
          </dl>
          <details>
            <summary>Recorded collector statistics</summary>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {JSON.stringify(scan.collector_stats ?? {}, null, 2)}
            </pre>
          </details>
        </article>
        <article className="panel span-full">
          <div className="panel-title">
            <h2>Algorithm inventory</h2>
            <p>Grouped by the exact algorithm labels recorded across the entire scan.</p>
          </div>
          {report.algorithms.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Algorithm</th>
                    <th scope="col">Occurrences</th>
                    <th scope="col">Confirmed use</th>
                    <th scope="col">Capability only</th>
                    <th scope="col">Quantum</th>
                    <th scope="col">Conflicts</th>
                    <th scope="col">Highest score</th>
                    <th scope="col">Key sizes (bits)</th>
                  </tr>
                </thead>
                <tbody>
                  {report.algorithms.map((a) => (
                    <tr key={a.name}>
                      <th scope="row">{a.name}</th>
                      <td>{a.count}</td>
                      <td>{a.confirmed}</td>
                      <td>{a.capability}</td>
                      <td>{a.quantum}</td>
                      <td>{a.conflicts}</td>
                      <td>{a.maxScore}</td>
                      <td>{a.keySizes.join(", ") || "Not recorded"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No algorithm occurrences recorded.</p>
          )}
        </article>
        <article className="panel span-full">
          <div className="panel-title">
            <h2>Evidence assurance</h2>
          </div>
          <dl className="facts">
            <dt>Confirmed use</dt>
            <dd>{report.confirmed}</dd>
            <dt>Capability only</dt>
            <dd>{report.capability}</dd>
            <dt>Usage unknown / conflicting</dt>
            <dd>{report.unknown}</dd>
            <dt>Mean detection confidence</dt>
            <dd>
              {report.confidenceAverage === null
                ? "Not recorded"
                : `${Math.round(report.confidenceAverage * 100)}%`}
            </dd>
            <dt>Key size not recorded</dt>
            <dd>{report.missingKeySize}</dd>
            <dt>Protocol not recorded</dt>
            <dd>{report.missingProtocol}</dd>
          </dl>
          <p>
            Detection confidence is not a security probability. Missing key sizes and protocols are
            not automatically vulnerabilities.
          </p>
          <h3>Evidence sources</h3>
          {Object.entries(report.sources).map(([source, count]) => (
            <p key={source}>
              {source}: {count} supported occurrences
            </p>
          ))}
          <p className="muted">
            Source counts can overlap because a finding can have multiple sources.
          </p>
          <h3>Evidence kinds</h3>
          {Object.entries(report.evidenceKinds).map(([kind, count]) => (
            <p key={kind}>
              {kind}: {count} occurrences
            </p>
          ))}
        </article>
        <article className="panel span-full">
          <div className="panel-title">
            <h2>Highest-priority occurrences</h2>
            <p>
              Showing {report.priorities.length} of {report.total.toLocaleString()} occurrences,
              ranked by stored priority score. Full inventory CSV includes every row.
            </p>
          </div>
          {report.priorities.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Occurrence report</th>
                    <th scope="col">Location</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Recorded recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {report.priorities.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link to={`/reports/algorithms/${a.id}`}>
                          {a.algorithm} · Asset #{a.id}
                        </Link>
                      </td>
                      <td className="path">{a.location}</td>
                      <td>
                        <RiskBadge label={a.priority_label} score={a.priority_score} />
                      </td>
                      <td>{a.pqc_candidate || "Not recorded"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No occurrences to prioritize.</p>
          )}
          <Link className="button secondary" to={`/assets?scan_id=${scan.id}`}>
            Review complete inventory
          </Link>
        </article>
        <article className="panel span-full">
          <div className="panel-title">
            <h2>Recorded migration recommendations</h2>
            <p>
              Validate each recommendation against its occurrence's actual usage and configuration.
            </p>
          </div>
          {report.algorithms.map((a) => (
            <details key={a.name} open>
              <summary>
                {a.name} · {a.count} occurrences
              </summary>
              <p>Observed usages: {a.usages.join(", ") || "Not recorded"}</p>
              {a.recommendations.length ? (
                <ul>
                  {a.recommendations.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p>No recommendation recorded.</p>
              )}
            </details>
          ))}
        </article>
        <article className="panel span-full">
          <div className="panel-title">
            <h2>Remediation review sequence</h2>
          </div>
          <ol>
            <li>
              Validate critical/high-priority occurrences and resolve conflicting or capability-only
              evidence.
            </li>
            <li>
              Review occurrence reports and confirm business context, policy defaults, and planning
              horizons with owners.
            </li>
            <li>
              Confirm migration choices, test compatibility, and prepare rollback before deploying
              changes.
            </li>
            <li>Rescan and compare measured coverage, evidence, and risk priorities.</li>
          </ol>
        </article>
        <article className="panel span-full">
          <div className="panel-title">
            <h2>Failures, blind spots, and limitations</h2>
          </div>
          {scan.failures?.length ? (
            <ul>
              {scan.failures.map((f, i) => (
                <li key={i}>
                  {f.path}: {f.reason}
                </li>
              ))}
            </ul>
          ) : (
            <p>No individual failure records returned.</p>
          )}
          {scan.failed_files > (scan.failures?.length ?? 0) && (
            <p>Not every failed file has an individual record in the returned metadata.</p>
          )}
          {scan.blind_spots?.length ? (
            <ul>
              {scan.blind_spots.map((gap, i) => (
                <li key={i}>{gap}</li>
              ))}
            </ul>
          ) : (
            <p>No blind spots recorded; this does not prove complete coverage.</p>
          )}
          <p>
            No modeled Shor exposure is not a blanket security assessment. Threat horizons in
            occurrence reports are planning assumptions, not arrival predictions.
          </p>
          <p>
            This report uses paginated reads of stored scan data. Regenerate it after editing risk
            context or remediating findings.
          </p>
        </article>
      </section>
    </>
  );
}

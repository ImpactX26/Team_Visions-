import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { getAsset, getScan } from "../api/client";
import type { CryptoAsset, ScanJob } from "../types";
import Breadcrumb from "../components/Breadcrumb";
import { RiskBadge } from "../components/RiskBadge";
import { SkeletonPanel } from "../components/Skeletons";
import {
  buildAlgorithmReport,
  CONTEXT_FIELDS,
  evidenceStatus,
  planningWindow,
  provenance,
  reportTitle,
} from "../utils/algorithmReport";

function Fact({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

export default function AlgorithmReportPage() {
  const { id } = useParams();
  const assetId = Number(id);
  const validId = /^\d+$/.test(id ?? "") && Number.isSafeInteger(assetId) && assetId > 0;
  const [snapshot, setSnapshot] = useState<{
    asset: CryptoAsset;
    scan: ScanJob | null;
    generatedAt: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    let active = true;
    setSnapshot(null);
    setError("");
    setExportError("");
    if (!validId) return;
    void getAsset(assetId)
      .then(async (asset) => {
        const scan = await getScan(asset.scan_job_id).catch(() => null);
        if (active) setSnapshot({ asset, scan, generatedAt: new Date().toISOString() });
      })
      .catch(() => {
        if (active)
          setError(
            "This occurrence report could not be loaded. Check your connection or return to Inventory.",
          );
      });
    return () => {
      active = false;
    };
  }, [assetId, validId, reload]);

  if (!validId || error)
    return (
      <section className="state" role="alert">
        <h1>Algorithm report unavailable</h1>
        <p>{error || "Choose a valid detected occurrence from Inventory."}</p>
        {validId && (
          <button className="button secondary" onClick={() => setReload((value) => value + 1)}>
            Retry report
          </button>
        )}
        <Link to="/assets" className="button secondary">
          Return to Inventory
        </Link>
      </section>
    );
  if (!snapshot || snapshot.asset.id !== assetId)
    return (
      <div role="status" aria-live="polite">
        <p>Loading occurrence report</p>
        <SkeletonPanel />
        <SkeletonPanel />
      </div>
    );

  const { asset, scan, generatedAt } = snapshot;
  const title = reportTitle(asset);
  const window = planningWindow(asset);
  const sources = [...new Set(asset.source ?? [])];
  const download = () => {
    setExportError("");
    try {
      const blob = new Blob([buildAlgorithmReport(asset, scan, generatedAt)], {
        type: "text/markdown;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `impactx-${title.replace(/[^a-z0-9_-]/gi, "-")}-asset-${asset.id}-scan-${asset.scan_job_id}.md`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError(
        "The report could not be exported. Use Print / save PDF, or retry the download.",
      );
    }
  };

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Reports", to: `/reports?scan_id=${asset.scan_job_id}` },
          { label: `Asset #${asset.id}`, to: `/assets/${asset.id}` },
          { label: "Occurrence report" },
        ]}
      />
      <section className="hero compact">
        <div>
          <p className="eyebrow">Algorithm occurrence report</p>
          <h1>{title} report</h1>
          <p>
            Asset #{asset.id} · Scan #{asset.scan_job_id} · One detected occurrence
          </p>
          <p className="path">{asset.location}</p>
        </div>
        <div className="hero-actions">
          <button className="button secondary" onClick={download}>
            Download Markdown
          </button>
          <button className="button" onClick={() => globalThis.window.print()}>
            Print / save PDF
          </button>
        </div>
      </section>
      {exportError && (
        <p className="callout error" role="alert">
          {exportError}
        </p>
      )}
      <section className="report-summary" aria-label="Occurrence summary">
        <RiskBadge label={asset.priority_label} score={asset.priority_score} />
        <span className="report-chip">{evidenceStatus(asset)}</span>
        <span className="report-chip">
          {Number.isFinite(asset.confidence)
            ? `${Math.round(asset.confidence * 100)}% detection confidence`
            : "Confidence not recorded"}
        </span>
        <span className="report-chip">
          {sources.length} evidence source{sources.length === 1 ? "" : "s"}
        </span>
      </section>
      <section className="dashboard-grid" aria-label="Detailed occurrence report">
        <article className="panel span-full">
          <div className="panel-title">
            <h2>Executive summary</h2>
          </div>
          <p>
            The scanner recorded <strong>{title}</strong> at <code>{asset.location}</code>. Its risk
            engine assigned <strong>{asset.priority_label}</strong> migration priority with a score
            of {asset.priority_score}/100.
          </p>
          <p>
            {asset.capability_only
              ? "This finding indicates an available capability; actual use is not established."
              : asset.confirmed_use
                ? "The scanner marks this occurrence as confirmed use."
                : "The scanner has not established whether this occurrence represents actual use."}
          </p>
          <p>
            This report covers this occurrence only. Other uses of the same algorithm can have
            different configurations and risk.
          </p>
          <dl className="facts">
            <Fact label="Repository" value={scan?.repo_path ?? "Unavailable"} />
            <Fact label="Scan status" value={scan?.status ?? "Unavailable"} />
            <Fact label="Scan completed" value={scan?.finished_at} />
            <Fact
              label="Coverage"
              value={scan ? `${scan.coverage_pct}% of measured scan scope` : "Unavailable"}
            />
            <Fact label="Report generated (UTC)" value={generatedAt} />
            <Fact label="Logical asset ID" value={asset.logical_asset_id} />
          </dl>
        </article>
        <article className="panel span-full">
          <div className="panel-title">
            <h2>Observed configuration</h2>
            <p>Only configuration recorded for this occurrence is shown.</p>
          </div>
          <dl className="facts">
            <Fact label="Algorithm" value={asset.algorithm} />
            <Fact label="Category" value={asset.category} />
            <Fact label="Key size" value={asset.key_size ? `${asset.key_size} bits` : null} />
            <Fact label="Operation / usage" value={asset.usage} />
            <Fact label="Library" value={asset.library} />
            <Fact label="Protocol" value={asset.protocol} />
            <Fact label="Component" value={asset.evidence_json?.component} />
            <Fact label="Exact location" value={asset.location} />
          </dl>
        </article>
        <article className="panel span-full">
          <div className="panel-title">
            <h2>Discovery evidence and confidence</h2>
          </div>
          <p>
            Detection confidence measures the evidence supporting a finding. It is not the
            probability that the algorithm is secure.
          </p>
          <dl className="facts">
            <Fact label="Usage status" value={evidenceStatus(asset)} />
            <Fact label="Evidence kind" value={asset.evidence_kind} />
            <Fact label="Evidence quality" value={asset.evidence_quality} />
            <Fact label="Sources" value={sources.join(", ")} />
            <Fact
              label="Conflicting evidence"
              value={
                asset.conflict
                  ? "Conflict flagged; review before remediation"
                  : "No conflict flag recorded"
              }
            />
          </dl>
          <details open>
            <summary>Recorded evidence</summary>
            <pre
              className="evidence-pre"
              style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
            >
              {JSON.stringify(asset.evidence_json ?? {}, null, 2)}
            </pre>
          </details>
        </article>
        <article className="panel span-full">
          <div className="panel-title">
            <h2>Risk analysis</h2>
            <p>Stored risk-model output for this occurrence.</p>
          </div>
          <p>
            {asset.quantum_vulnerable
              ? "The risk engine flags quantum exposure for this occurrence."
              : "No modeled Shor exposure is flagged. This does not establish security against every attack."}
          </p>
          {asset.risk_reasons?.length ? (
            <ul>
              {asset.risk_reasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p>No risk reasons recorded.</p>
          )}
        </article>
        <article className="panel span-full">
          <div className="panel-title">
            <h2>Planning assumptions and provenance</h2>
            <p>
              Distinguish operator inputs from policy defaults before making a migration decision.
            </p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Input</th>
                  <th scope="col">Recorded value</th>
                  <th scope="col">Provenance</th>
                </tr>
              </thead>
              <tbody>
                {CONTEXT_FIELDS.map(([field, label]) => (
                  <tr key={field}>
                    <th scope="row">{label}</th>
                    <td>{asset[field] ?? "Not recorded"}</td>
                    <td>{provenance(asset, field)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            {window
              ? `Required protection (${asset.data_lifetime_years} years) + migration (${asset.migration_time_years} years) = ${window.years} years, compared with the selected ${asset.threat_horizon_years}-year threat horizon. ${window.overlap ? "The modeled quantum planning window overlaps." : "No modeled quantum overlap is flagged."}`
              : "The planning window cannot be calculated from the recorded values."}
          </p>
          <p>
            The threat horizon is a planning scenario, not a prediction of quantum-computer
            availability.
          </p>
        </article>
        <article className="panel span-full">
          <div className="panel-title">
            <h2>Migration recommendation and validation</h2>
            <p>Use-case-aware recommendation stored by the risk engine.</p>
          </div>
          <p>
            <strong>
              {asset.pqc_candidate || "No recommendation recorded; review with the security owner."}
            </strong>
          </p>
          <p>
            Hybrid transition recommended by the risk engine:{" "}
            {asset.hybrid_recommended ? "Yes" : "No"}.
          </p>
          <ol>
            <li>
              Confirm the operation, location, and configuration against the original evidence.
            </li>
            <li>
              Resolve capability-only findings, evidence conflicts, and unrecorded configuration
              before prioritizing implementation.
            </li>
            <li>
              Have the security and application owners validate the recorded recommendation for this
              usage and protocol.
            </li>
            <li>Plan compatibility testing and rollback before deploying a change.</li>
            <li>Rescan after remediation and compare the evidence and risk assessment.</li>
          </ol>
          <Link className="button secondary" to={`/assets/${asset.id}`}>
            Review evidence and edit risk context
          </Link>
        </article>
        <article className="panel span-full">
          <div className="panel-title">
            <h2>Coverage and limitations</h2>
          </div>
          {!scan ? (
            <p>
              Scan metadata and blind spots are unavailable. The occurrence's stored findings remain
              available above.
            </p>
          ) : scan.blind_spots?.length ? (
            <ul>
              {scan.blind_spots.map((gap, index) => (
                <li key={index}>{gap}</li>
              ))}
            </ul>
          ) : (
            <p>No blind spots recorded by this scan; this does not prove complete coverage.</p>
          )}
          <p>
            This report reflects stored scanner evidence and risk-model outputs. Runtime behavior
            and unrecorded settings are not established by this report.
          </p>
        </article>
      </section>
    </>
  );
}

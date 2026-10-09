import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAssets, getDashboardSummary } from "../api/client";
import type { CryptoAsset } from "../types";
import FindingRemediation from "./FindingRemediation";

export function guidance(asset: CryptoAsset) {
  const algorithm = asset.algorithm.toUpperCase();
  if (asset.capability_only || asset.conflict || asset.review_status === "uncertain")
    return {
      action: "Validate use before changing code",
      steps:
        "Inspect the source and conflicting evidence. Confirm the operation, owner, and runtime use before selecting a replacement.",
      checks: "Record the evidence review, then rescan the affected scope.",
    };
  if (/MD5|SHA.?1/.test(algorithm))
    return {
      action: "Migrate the weak digest",
      steps:
        "For integrity checks, use SHA-256 or stronger and migrate stored digests and all consumers together. Password storage needs a dedicated password hashing scheme; authentication needs a keyed construction. Confirm usage first.",
      checks:
        "Test known vectors, tampering, legacy digest handling, and producer/consumer compatibility; rescan for the retired algorithm.",
    };
  if (/RSA|ECDSA|ECDH|DSA|DIFFIE/.test(algorithm))
    return {
      action: "Plan a quantum-safe migration",
      steps: `Confirm whether this is signing or key establishment. Evaluate ${asset.pqc_candidate || "a supported post-quantum replacement"} for that operation with your library and protocol; stage interoperability and key/certificate rotation.`,
      checks:
        "Verify signatures or key agreement, compatibility, payload sizes, latency, failure handling, and rollback; rescan after rollout.",
    };
  if (/DES|RC4|BLOWFISH/.test(algorithm))
    return {
      action: "Replace legacy encryption",
      steps:
        "Use a supported authenticated encryption implementation. Design unique nonces, key rotation, and a versioned decrypt-old/encrypt-new migration before moving stored data.",
      checks:
        "Test round trips, authentication failures, nonce uniqueness, legacy data migration, and compatibility; rescan.",
    };
  if (/AES/.test(algorithm))
    return {
      action: "Review mode and key management",
      steps:
        "Inspect mode, key length, nonce generation, and authentication. Prefer supported authenticated encryption where appropriate; algorithm presence alone does not establish insecure use.",
      checks:
        "Test tamper rejection, nonce handling, rotation, and interoperability. Verify configuration evidence and rescan.",
    };
  return {
    action: "Review the observed cryptographic use",
    steps:
      "Confirm the operation and library against source evidence. Review key strength, protocol configuration, lifecycle, and the recorded risk reasons with the component owner.",
    checks:
      "Add operation-specific regression tests and rescan the same scope. Compare coverage and findings before declaring resolution.",
  };
}

export default function RemediationQueue() {
  const [items, setItems] = useState<CryptoAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [scan, setScan] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getDashboardSummary()
      .then(async (summary) => {
        if (controller.signal.aborted) return;
        setScan(summary.latest_scan_id);
        if (summary.latest_scan_id == null) {
          setItems([]);
          setTotal(0);
          return;
        }
        const result = await getAssets(summary.latest_scan_id, {
          limit: 20,
          offset: page * 20,
          query,
          sort: "priority",
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setItems(result.items);
          setTotal(result.total);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Inventory remediation could not load. Retry to fetch your findings.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, query, retry]);
  return (
    <section className="lab-inventory panel">
      <p className="eyebrow">Your inventory · {scan == null ? "Latest scan" : `Scan #${scan}`}</p>
      <h2>Remediation for every finding</h2>
      <p>
        Open each finding for its source evidence and recommended migration checks. These are review
        plans with source patches and isolated rescanning where supported. Select a finding to
        review its change and compatibility requirements. The checksum demonstration is below.
      </p>
      <label>
        Search algorithm or location
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
      </label>
      {error ? (
        <p role="alert">
          {error} <button onClick={() => setRetry((v) => v + 1)}>Retry inventory</button>
        </p>
      ) : loading ? (
        <p role="status">Loading inventory findings…</p>
      ) : (
        <>
          <p>{total} findings · ordered by priority</p>
          {!items.length && (
            <p>
              {query
                ? "No matching findings. Try another search."
                : "No findings in the latest scan. Run a scan to build your remediation queue."}{" "}
              <Link to="/scan">Start scan</Link>
            </p>
          )}
          {items.map((asset) => {
            const plan = guidance(asset);
            return (
              <details key={asset.id} className="lab-finding">
                <summary>
                  <strong>{asset.algorithm}</strong> · {asset.priority_label} · {asset.location}
                </summary>
                <p>
                  {asset.review_status === "false_positive"
                    ? "Marked false positive — no migration action until evidence is reassessed."
                    : plan.action}
                </p>
                <p>{plan.steps}</p>
                <p>
                  <strong>Evidence:</strong> {asset.source.join(", ")} ·{" "}
                  {Math.round(asset.confidence * 100)}% confidence ·{" "}
                  {asset.usage || "Usage needs review"}
                </p>
                {asset.risk_reasons.length > 0 && (
                  <ul>
                    {asset.risk_reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                )}
                <p>
                  <strong>Verify before resolving:</strong> {plan.checks}
                </p>
                <Link className="button secondary" to={`/assets/${asset.id}`}>
                  Inspect finding & source evidence →
                </Link>
                <button
                  className="button secondary"
                  onClick={() => setSelected(selected === asset.id ? null : asset.id)}
                  aria-expanded={selected === asset.id}
                >
                  Review change & verification
                </button>
                {selected === asset.id && <FindingRemediation id={asset.id} />}
              </details>
            );
          })}
          <div className="lab-actions">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous findings
            </button>
            <span>
              Page {page + 1} of {Math.max(1, Math.ceil(total / 20))}
            </span>
            <button disabled={(page + 1) * 20 >= total} onClick={() => setPage((p) => p + 1)}>
              Next findings
            </button>
          </div>
        </>
      )}
    </section>
  );
}

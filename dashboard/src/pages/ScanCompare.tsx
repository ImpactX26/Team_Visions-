import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getScanComparison } from "../api/client";
import type { ScanComparison } from "../types";

const labels = {
  added: "Added",
  changed: "Changed",
  unchanged: "Unchanged",
  no_longer_observed: "No longer observed",
  ambiguous: "Ambiguous",
  unknown: "Unknown",
};

export default function ScanCompare() {
  const [params, setParams] = useSearchParams();
  const baselineId = Number(params.get("baseline_id"));
  const currentId = Number(params.get("current_id"));
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const status = params.get("status") ?? "";
  const [baseline, setBaseline] = useState(params.get("baseline_id") ?? "");
  const [current, setCurrent] = useState(params.get("current_id") ?? "");
  const [data, setData] = useState<ScanComparison>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (
      !Number.isSafeInteger(baselineId) ||
      baselineId < 1 ||
      !Number.isSafeInteger(currentId) ||
      currentId < 1
    )
      return;
    let active = true;
    setLoading(true);
    setError("");
    setData(undefined);
    getScanComparison(baselineId, currentId, offset, status)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Comparison failed.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [baselineId, currentId, offset, status]);

  const paginate = (nextOffset: number) => {
    const next = new URLSearchParams(params);
    next.set("offset", String(nextOffset));
    setParams(next);
  };

  return (
    <div className="scan-compare">
      <header className="hero compact">
        <div>
          <p className="eyebrow">Evidence across scans</p>
          <h1>Compare scans</h1>
          <p>
            Inspect what changed in the same repository scope. Missing evidence does not verify a
            fix.
          </p>
        </div>
        <Link className="button secondary" to="/scans">
          Scan history
        </Link>
      </header>
      <form
        className="panel compare-controls"
        onSubmit={(event) => {
          event.preventDefault();
          setParams({ baseline_id: baseline, current_id: current });
        }}
      >
        <label>
          Baseline scan ID
          <input
            type="number"
            min="1"
            step="1"
            required
            value={baseline}
            onChange={(e) => setBaseline(e.target.value)}
          />
        </label>
        <label>
          Current scan ID
          <input
            type="number"
            min="1"
            step="1"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <button className="button" type="submit" disabled={loading}>
          Compare scans
        </button>
        <p className="muted">
          Use an earlier scan as the baseline. Legacy scans without snapshot metadata require fresh
          scans.
        </p>
      </form>
      {loading && <p role="status">Comparing findings…</p>}
      {error && (
        <p className="callout error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <p>
            Baseline <Link to={`/scans/${data.baseline_id}`}>#{data.baseline_id}</Link>:{" "}
            {data.baseline_findings} findings · Current{" "}
            <Link to={`/scans/${data.current_id}`}>#{data.current_id}</Link>:{" "}
            {data.current_findings} findings
          </p>
          <dl className="compare-counts">
            {Object.entries(data.totals).map(([name, count]) => (
              <div key={name}>
                <dt>{labels[name as keyof typeof labels]}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
          {data.warnings.map((warning) => (
            <p className="muted" key={warning}>
              {warning}
            </p>
          ))}
          <label>
            Filter comparison
            <select
              value={status}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                next.set("status", e.target.value);
                next.set("offset", "0");
                setParams(next);
              }}
            >
              <option value="">All groups</option>
              {Object.entries(labels).map(([name, label]) => (
                <option key={name} value={name}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p role="status">
            {data.total === 0
              ? "No comparison groups match."
              : `Showing ${data.offset + 1}–${Math.min(data.offset + data.items.length, data.total)} of ${data.total} groups`}
          </p>
          {data.items.map((entry, index) => (
            <article className="panel compare-entry" key={index}>
              <h2>{labels[entry.status]}</h2>
              <p className="path">{entry.file ?? "File identity unavailable"}</p>
              <p>{entry.reason}</p>
              {entry.changed_fields.length > 0 && (
                <p>
                  Changed:{" "}
                  {entry.changed_fields.map((field) => field.replace(/_/g, " ")).join(", ")}
                </p>
              )}
              <div className="compare-sides">
                {(["baseline", "current"] as const).map((side) => (
                  <section key={side}>
                    <h3>{side === "baseline" ? "Baseline evidence" : "Current evidence"}</h3>
                    {entry[side].length === 0 ? (
                      <p>No matched finding</p>
                    ) : (
                      <ul>
                        {entry[side].map((finding) => (
                          <li key={finding.id}>
                            <Link to={`/assets/${finding.id}`}>
                              {finding.algorithm}
                              {finding.key_size ? `-${finding.key_size}` : ""} · #{finding.id}
                            </Link>
                            <p className="path">{finding.location}</p>
                            <p>
                              Risk score {finding.priority_score} · Review:{" "}
                              {finding.review_status.replace(/_/g, " ")}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            </article>
          ))}
          <nav aria-label="Comparison pages">
            <button
              className="button secondary"
              disabled={offset === 0}
              onClick={() => paginate(Math.max(0, offset - 50))}
            >
              Previous page
            </button>{" "}
            <button
              className="button secondary"
              disabled={offset + data.items.length >= data.total}
              onClick={() => paginate(offset + 50)}
            >
              Next page
            </button>
          </nav>
        </>
      )}
    </div>
  );
}

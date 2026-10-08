import { useEffect, useState } from "react";
import { canWrite, getAssetReviews, reviewAsset } from "../api/client";
import type { AssetReview, CryptoAsset, ReviewStatus } from "../types";
import { useDirtyGuard } from "../utils/hooks";

const labels = {
  confirmed_use: "Confirmed use",
  false_positive: "False positive",
  uncertain: "Uncertain",
  unreviewed: "Unreviewed",
};

export default function AnalystReview({
  asset,
  onSaved,
}: {
  asset: CryptoAsset;
  onSaved: (asset: CryptoAsset) => void;
}) {
  const [status, setStatus] = useState<ReviewStatus>("uncertain");
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<AssetReview[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [more, setMore] = useState(false);
  const [notice, setNotice] = useState("");
  useDirtyGuard(Boolean(reason.trim()));

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getAssetReviews(asset.id)
      .then((rows) => {
        if (active) {
          setHistory(rows);
          setMore(rows.length === 50);
        }
      })
      .catch(() => {
        if (active) setError("Review history could not be loaded. Reload to retry.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [asset.id, asset.review_version]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await reviewAsset(asset.id, {
        status,
        reason: reason.trim(),
        expected_version: asset.review_version ?? 0,
      });
      onSaved(updated);
      setReason("");
      setNotice("Review saved.");
    } catch (e) {
      setError(
        `Review was not saved. Reload if another analyst changed it, then retry. (${String(e)})`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel analyst-review" aria-labelledby="analyst-review-heading">
      <h2 id="analyst-review-heading">Analyst review</h2>
      <p>
        Current decision: <strong>{labels[asset.review_status ?? "unreviewed"]}</strong>
      </p>
      {asset.reviewed_by && (
        <p>
          Reviewed by {asset.reviewed_by} ·{" "}
          {asset.reviewed_at && new Date(asset.reviewed_at).toLocaleString()}
        </p>
      )}
      {asset.review_reason && <p>{asset.review_reason}</p>}
      <p className="muted">
        Reviews record an analyst decision. Scanner evidence, confidence and risk scores remain
        available for inspection.
      </p>
      {error && (
        <p role="alert" className="callout error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {canWrite() && (
        <form onSubmit={save}>
          <label htmlFor="review-decision">Review decision</label>
          <select
            id="review-decision"
            value={status}
            onChange={(e) => setStatus(e.target.value as ReviewStatus)}
            disabled={saving}
          >
            <option value="confirmed_use">Confirmed use</option>
            <option value="false_positive">False positive</option>
            <option value="uncertain">Uncertain</option>
          </select>
          <label htmlFor="review-reason">Review reason</label>
          <textarea
            id="review-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            maxLength={2000}
            disabled={saving}
          />
          <button className="button" type="submit" disabled={saving || !reason.trim()}>
            {saving ? "Saving review…" : "Save review"}
          </button>
        </form>
      )}
      <h3>Review history</h3>
      {loading ? (
        <p role="status">Loading reviews…</p>
      ) : history.length === 0 ? (
        <p>No analyst reviews recorded.</p>
      ) : (
        <ol>
          {history.map((entry) => (
            <li key={entry.id}>
              <strong>{labels[entry.status]}</strong> · {entry.reviewer} ·{" "}
              {new Date(entry.reviewed_at).toLocaleString()}
              <p>{entry.reason}</p>
            </li>
          ))}
        </ol>
      )}
      {more && (
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setError("");
            try {
              const rows = await getAssetReviews(asset.id, history.length);
              setHistory((old) => [...old, ...rows]);
              setMore(rows.length === 50);
            } catch {
              setError("More reviews could not be loaded. Retry.");
            } finally {
              setLoading(false);
            }
          }}
        >
          Load more reviews
        </button>
      )}
    </section>
  );
}

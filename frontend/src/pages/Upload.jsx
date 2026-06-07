import { useState, useRef } from "react";
import API from "../services/api";
import { useToast } from "../context/ToastContext";

function Upload() {
  const toast = useToast();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [resetting, setResetting] = useState(false);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSet(dropped);
  };

  const validateAndSet = (f) => {
    const ext = f.name.toLowerCase();
    if (!ext.endsWith(".csv") && !ext.endsWith(".pdf")) {
      toast("Only CSV and PDF files are supported.", "error");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast("File too large. Max 10 MB.", "error");
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) { toast("Please select a file first.", "error"); return; }
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", file);
      const res = await API.post("/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      toast(`Imported ${res.data.stats?.inserted ?? 0} transactions!`, "success");
      window.dispatchEvent(new Event("finghitBudgetUpdated"));
    } catch (err) {
      const msg = err?.response?.data?.error || err.message;
      setResult({ error: true, message: msg });
      toast("Upload failed: " + msg, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Delete uploaded statement transactions and all budget entries? Account details will be kept.")) return;
    try {
      setResetting(true);
      const res = await API.delete("/upload/reset", { params: { includeBudgets: true } });
      setResult(null);
      setFile(null);
      const txDeleted = res?.data?.deletedCount ?? 0;
      const budgetsDeleted = res?.data?.deletedBudgets ?? 0;
      toast(`Deleted ${txDeleted} uploaded transactions and ${budgetsDeleted} budgets.`, "success");
      window.dispatchEvent(new Event("finghitBudgetUpdated"));
    } catch (err) {
      toast("Reset failed: " + (err?.response?.data?.error || err.message), "error");
    } finally {
      setResetting(false);
    }
  };

  const { stats = {}, errors = [], duplicates = [] } = result || {};

  return (
    <div className="page-wrapper">
      <div className="section-header mb-32">
        <div>
          <h1 className="page-title">Upload Statement</h1>
          <p className="page-subtitle">
            Import CSV or PDF bank statements with multiline PDF extraction
          </p>
        </div>
      </div>

      <div className="content-wide">
        {/* Drop zone */}
        <div className="card mb-24">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>📤 Import Transactions</h3>

          <div
            className={`drop-zone${dragOver ? " drag-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div className="drop-zone-icon">☁️</div>
            <div className="drop-zone-title">Drag & drop your file here</div>
            <p className="drop-zone-sub">or click to browse</p>
            <p className="drop-zone-sub" style={{ marginTop: 8 }}>
              Supports: <strong style={{ color: "var(--brand-light)" }}>CSV</strong> and{" "}
              <strong style={{ color: "var(--brand-light)" }}>PDF</strong>
            </p>
            <p className="drop-zone-sub" style={{ marginTop: 8 }}>
              PDF uploads preserve wrapped narrations and repeated same-day entries
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.pdf"
              style={{ display: "none" }}
              onChange={(e) => validateAndSet(e.target.files[0])}
            />
          </div>

          {/* Selected file */}
          {file && (
            <div
              style={{
                marginTop: 16, padding: "12px 16px",
                background: "var(--income-bg)",
                border: "1px solid rgba(16,185,129,0.3)",
                borderRadius: "var(--r-sm)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                fontSize: 13,
              }}
            >
              <span style={{ color: "var(--income)" }}>
                ✅ <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
              </span>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-12 mt-16 upload-actions">
            <button
              className="btn btn-primary"
              disabled={!file || uploading}
              onClick={handleUpload}
            >
              {uploading ? (
                <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Uploading…</>
              ) : (
                "⬆️ Upload & Import"
              )}
            </button>
            <button
              className="btn btn-danger"
              disabled={resetting}
              onClick={handleReset}
            >
              {resetting ? "Deleting…" : "🗑 Reset All Data"}
            </button>
          </div>
        </div>

        {/* Result panel */}
        {result && (
          <div className="card">
            {result.error ? (
              <>
                <h4 style={{ color: "var(--expense)", marginBottom: 12 }}>❌ Upload Failed</h4>
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{result.message}</p>
                <div style={{ marginTop: 16, padding: "14px", background: "rgba(244,63,94,0.06)", borderRadius: "var(--r-sm)", fontSize: 12 }}>
                  <strong style={{ color: "var(--text-secondary)" }}>Tips:</strong>
                  <ul style={{ marginTop: 8, paddingLeft: 20, color: "var(--text-muted)", lineHeight: 1.8 }}>
                    <li>Accepted: CSV and PDF bank statements</li>
                    <li>Columns: date, amount/debit/credit, type, description</li>
                    <li>Max file size: 10 MB</li>
                  </ul>
                </div>
              </>
            ) : (
              <>
                <h4 style={{ color: "var(--income)", marginBottom: 20 }}>✅ Import Complete</h4>

                {/* Stats grid */}
                <div className="grid-4 mb-24" style={{ gap: 12 }}>
                  {[
                    { label: "Total Rows", value: stats.totalRows ?? 0, color: "var(--text-primary)" },
                    { label: "Inserted", value: stats.inserted ?? 0, color: "var(--income)" },
                    { label: "Categorised", value: stats.categorized ?? 0, color: "var(--brand-light)" },
                    { label: "Duplicates", value: stats.duplicatesSkipped ?? 0, color: "var(--investment)" },
                    { label: "Failed", value: stats.failed ?? stats.errors ?? 0, color: "var(--expense)" },
                    { label: "Budgets", value: stats.budgetsUpdated ?? 0, color: "var(--savings)" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ background: "var(--bg-input)", padding: "12px 14px", borderRadius: "var(--r-sm)" }}>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</p>
                      <p style={{ fontSize: 22, fontWeight: 800, color }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Error rows */}
                {errors.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ color: "var(--expense)", fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
                      ❌ Errors (first {Math.min(errors.length, 10)})
                    </p>
                    <ul style={{ paddingLeft: 20, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.9 }}>
                      {errors.slice(0, 10).map((e, i) => (
                        <li key={i}>
                          Row {e.row}: {e.reason || e.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Duplicates */}
                {duplicates.length > 0 && (
                  <div>
                    <p style={{ color: "var(--investment)", fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
                      ⚠️ Duplicates skipped ({duplicates.length})
                    </p>
                    <ul style={{ paddingLeft: 20, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.9 }}>
                      {duplicates.slice(0, 5).map((d, i) => (
                        <li key={i}>
                          ₹{d.amount} — {d.description || "no description"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Info card */}
        <div
          style={{
            marginTop: 20,
            padding: "16px",
            background: "rgba(99,102,241,0.06)",
            border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: "var(--r-md)",
            fontSize: 13,
            color: "var(--text-muted)",
            lineHeight: 1.8,
          }}
        >
          <p style={{ fontWeight: 600, color: "var(--brand-light)", marginBottom: 6 }}>📋 Supported formats</p>
          <ul style={{ paddingLeft: 18 }}>
            <li><strong style={{ color: "var(--text-secondary)" }}>CSV:</strong> Standard bank statement exports</li>
            <li><strong style={{ color: "var(--text-secondary)" }}>PDF:</strong> Line-by-line extraction with wrapped transaction merging</li>
            <li>Repeated transactions on the same date are preserved instead of merged away</li>
            <li>Categories are auto-detected using AI — no manual editing needed</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Upload;

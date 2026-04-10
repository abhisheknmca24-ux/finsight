import { useEffect, useState, useCallback } from "react";
import API from "../services/api";

const PRIORITY_STYLES = {
  critical: { color: "var(--expense)",    bg: "rgba(244,63,94,0.06)",  border: "rgba(244,63,94,0.2)",  label: "🚨 Critical" },
  high:     { color: "var(--investment)", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.2)", label: "⚠️ High" },
  medium:   { color: "#eab308",           bg: "rgba(234,179,8,0.06)",  border: "rgba(234,179,8,0.2)",  label: "ℹ️ Medium" },
  low:      { color: "var(--income)",     bg: "rgba(44,182,125,0.06)", border: "rgba(44,182,125,0.2)", label: "✅ Low" },
};

const COLORS = ["#7F5AF0","#2CB67D","#f43f5e","#f59e0b","#00C2FF","#8b5cf6"];

function Recommendations() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalInfo, setModalInfo] = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/recommendations");
      setData(res.data);
    } catch {
      setError("Failed to load recommendations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const refresh = () => fetch();
    window.addEventListener("finghitBudgetUpdated", refresh);
    window.addEventListener("finghitDataUpdated", refresh);
    return () => {
      window.removeEventListener("finghitBudgetUpdated", refresh);
      window.removeEventListener("finghitDataUpdated", refresh);
    };
  }, [fetch]);

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="loading-screen"><div className="spinner" /><p>Generating personalised insights…</p></div>
      </div>
    );
  }

  if (error || !data?.recommendations) {
    return (
      <div className="page-wrapper">
        <div className="empty-state">
          <div className="empty-state-icon">💡</div>
          <div className="empty-state-title">No recommendations yet</div>
          <div className="empty-state-desc">
            {error || "Add transactions or upload a statement to get AI-powered tips."}
          </div>
          <button className="btn btn-primary mt-16" onClick={fetch}>Retry</button>
        </div>
      </div>
    );
  }

  const { recommendations, analysis, summary } = data;
  const totalSpend = (summary?.topSpenders ?? []).reduce((s, x) => s + x[1], 0);

  return (
    <div className="page-wrapper">
      <div className="section-header mb-32">
        <div>
          <h1 className="page-title">AI Recommendations</h1>
          <p className="page-subtitle">
            Personalised insights based on {summary?.totalTransactions ?? 0} transactions
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetch}>🔄 Refresh</button>
      </div>

      {/* Summary metrics */}
      <div className="grid-auto mb-32">
        {[
          { label: "Savings Ratio",    value: `${summary?.savingsRatio ?? 0}%`,  color: "var(--income)",      info: `Calculated as: (Total Income - Total Expense - Total Investments) / Total Income\n\n(₹${summary?.income?.toLocaleString("en-IN") || 0} - ₹${summary?.expense?.toLocaleString("en-IN") || 0} - ₹${summary?.investment?.toLocaleString("en-IN") || 0}) / ₹${summary?.income?.toLocaleString("en-IN") || 0} = ${summary?.savingsRatio ?? 0}%\n\nIt tracks the percentage of your monthly income that is retained as unspent, liquid savings.` },
          { label: "Expense Ratio",    value: `${summary?.expenseRatio ?? 0}%`,  color: "var(--expense)",     info: `Calculated as: Total Expenses / Total Income\n\n₹${summary?.expense?.toLocaleString("en-IN") || 0} / ₹${summary?.income?.toLocaleString("en-IN") || 0} = ${summary?.expenseRatio ?? 0}%\n\nIt measures how much of your total incoming cash is being spent on housing, groceries, bills, shopping, and everyday wants.` },
          { label: "Investment Ratio", value: `${summary?.investmentRatio ?? 0}%`,color: "var(--investment)",  info: `Calculated as: Total Investments / Total Income\n\n₹${summary?.investment?.toLocaleString("en-IN") || 0} / ₹${summary?.income?.toLocaleString("en-IN") || 0} = ${summary?.investmentRatio ?? 0}%\n\nIt tracks the percentage of your income purposefully allocated directly toward long-term wealth building, such as SIPs or stocks.` },
          { label: "Budget Categories",value: summary?.budgetCount ?? 0,         color: "var(--brand-light)", info: `The total number of unique categories where you have registered spending or established budget limits this month. You currently have ${summary?.budgetCount ?? 0} active mapped categories.` },
        ].map(({ label, value, color, info }, idx) => (
          <div
            key={label}
            className="card"
            onClick={() => setModalInfo({ title: label, value, color, text: info })}
            style={{ padding: "20px", cursor: "pointer", animationDelay: `${idx * 0.05}s` }}
          >
            <p className="card-title" style={{ marginBottom: 6 }}>
              {label} <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 4 }}>ⓘ</span>
            </p>
            <p style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: "-0.5px" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Recommendation cards */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>💡 Smart Actions</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
        {recommendations.map((rec, i) => {
          const style = PRIORITY_STYLES[rec.priority] ?? PRIORITY_STYLES.low;
          return (
            <div
              key={i}
              className="card"
              style={{
                background: style.bg,
                borderColor: style.border,
                borderLeft: `4px solid ${style.color}`,
                animation: `fadeInUp var(--dur-md) var(--ease) both`,
                animationDelay: `${i * 0.06}s`,
              }}
            >
              <div className="flex-between mb-16">
                <div className="flex gap-12" style={{ alignItems: "center" }}>
                  <span style={{ fontSize: 28 }}>{rec.icon}</span>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
                      {rec.title}
                    </h3>
                    <span className="badge" style={{
                      color: style.color,
                      background: `${style.color}15`,
                      border: `1px solid ${style.color}35`,
                    }}>
                      {style.label}
                    </span>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>
                {rec.description}
              </p>

              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, letterSpacing: "1px" }}>
                  Recommended Actions
                </p>
                <ul style={{ paddingLeft: 18, lineHeight: 1.9, fontSize: 13, color: "var(--text-secondary)" }}>
                  {rec.actions.map((a, j) => <li key={j}>{a}</li>)}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Top spending */}
      {summary?.topSpenders?.length > 0 && (
        <>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>📊 Top Spending Categories</h2>
          <div className="card mb-32">
            {summary.topSpenders.map(([cat, amt], i) => {
              const pct = totalSpend > 0 ? (amt / totalSpend) * 100 : 0;
              return (
                <div key={cat} style={{ marginBottom: i < summary.topSpenders.length - 1 ? 16 : 0 }}>
                  <div className="flex-between mb-8">
                    <span style={{ fontSize: 14, fontWeight: 600, textTransform: "capitalize", color: "var(--text-primary)" }}>{cat}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: COLORS[i % COLORS.length] }}>
                      ₹{amt.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{pct.toFixed(1)}% of top spending</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal Overlay */}
      {modalInfo && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
            animation: "fadeIn 0.2s ease",
          }}
          onClick={() => setModalInfo(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 420, width: "90%", padding: "32px", position: "relative", cursor: "default", animation: "fadeInUp 0.3s ease" }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setModalInfo(null)}
              style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}
            >
              ✕
            </button>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: modalInfo.color }}>{modalInfo.title}</h3>
            <p style={{ fontSize: 36, fontWeight: 800, color: modalInfo.color, marginBottom: 24, letterSpacing: "-1px" }}>{modalInfo.value}</p>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>Calculation & Context</h4>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-line" }}>{modalInfo.text}</p>
            <button className="btn btn-primary btn-full mt-24" onClick={() => setModalInfo(null)}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Recommendations;
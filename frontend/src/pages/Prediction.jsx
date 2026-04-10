import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import {
  RadialBarChart, RadialBar, PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";

function Prediction() {
  const navigate = useNavigate();
  const [score, setScore] = useState(null);
  const [yearendPred, setYearendPred] = useState(null);
  const [selectedPrediction, setSelectedPrediction] = useState("savings");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalInfo, setModalInfo] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const scoreRes = await API.get("/score");
        setScore(scoreRes.data);
      } catch (err) {
        setError("Failed to load financial health data.");
      }

      try {
        const yearendRes = await API.post("/predict/yearend");
        setYearendPred(yearendRes.data);
      } catch (err) {
        setYearendPred(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="loading-screen"><div className="spinner" /><p>Analysing your finances…</p></div>
      </div>
    );
  }

  if (error || !score) {
    return (
      <div className="page-wrapper">
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">No data yet</div>
          <div className="empty-state-desc">{error || "Add transactions or upload a statement to see your score."}</div>
        </div>
      </div>
    );
  }

  if (score.noData) {
    return (
      <div className="page-wrapper">
        <div className="empty-state">
          <div className="empty-state-icon">📉</div>
          <div className="empty-state-title">No financial data yet</div>
          <div className="empty-state-desc">Upload a statement or add transactions to generate your health score and AI predictions.</div>
        </div>
      </div>
    );
  }

  const statusColorMap = { green: "var(--income)", yellow: "var(--investment)", red: "var(--expense)" };
  const statusColor = statusColorMap[score.statusColor] ?? "var(--brand-light)";

  const radialData = [{ name: "Score", value: score.healthScore ?? 0, fill: statusColor }];
  const predictedExpenseValue = Number(score.predictedExpense || 0);
  const monthlyIncomeValue = Number(score.income || 0);
  const savingsPotentialValue = Math.max(0, monthlyIncomeValue - predictedExpenseValue);
  const monthlyGapValue = predictedExpenseValue - Number(score.avgMonthlyExpense || 0);

  const metrics = [
    { label: "Total Income",        value: `₹${Number(score.income || 0).toLocaleString("en-IN")}`,           color: "var(--income)",     info: `Total credited amount classified as income during the selected period.` },
    { label: "Total Expense",       value: `₹${Number(score.expense || 0).toLocaleString("en-IN")}`,          color: "var(--expense)",    info: `Total debited amount classified as operational/living expenses (excluding investments) during the selected period.` },
    { label: "Net Savings",         value: `₹${Number(score.savings || 0).toLocaleString("en-IN")}`,          color: "var(--savings)",    info: `Leftover cash after deducting both expenses and investments.\n\n₹${Number(score.income || 0).toLocaleString("en-IN")} (Income) - ₹${Number(score.expense || 0).toLocaleString("en-IN")} (Expenses) - ₹${Number(score.investment || 0).toLocaleString("en-IN")} (Investments)\n= ₹${Number(score.savings || 0).toLocaleString("en-IN")}` },
    { label: "Savings Ratio",       value: `${score.savingsRatio ?? 0}%`,                                      color: "var(--income)",     info: `Percentage of your income securely saved or invested.\n\n(₹${Number(score.savings || 0).toLocaleString("en-IN")} / ₹${Number(score.income || 0).toLocaleString("en-IN")}) * 100\n= ${score.savingsRatio ?? 0}%` },
    { label: "Expense Ratio",       value: `${score.expenseRatio ?? 0}%`,                                      color: "var(--expense)",    info: `Percentage of your income burned on expenses.\n\n(₹${Number(score.expense || 0).toLocaleString("en-IN")} / ₹${Number(score.income || 0).toLocaleString("en-IN")}) * 100\n= ${score.expenseRatio ?? 0}%` },
    { label: "Avg Monthly Expense", value: `₹${Number(score.avgMonthlyExpense || 0).toLocaleString("en-IN")}`, color: "var(--investment)", info: `Your average historical spending rate per month, used by our machine learning models (Linear Regression & Random Forest) as a baseline to predict future behavior.` },
  ];

  const predictions = [
    {
      key: "predicted",
      label: "Predicted Next Month",
      value: `₹${predictedExpenseValue.toLocaleString("en-IN")}`,
      sub: "Estimated total expense for next month",
      color: "var(--investment)",
      bg: "var(--investment-bg)",
    },
    {
      key: "savings",
      label: "Savings Potential",
      value: `₹${savingsPotentialValue.toLocaleString("en-IN")}`,
      sub: "Expected leftover if forecast is accurate",
      color: "var(--income)",
      bg: "var(--income-bg)",
    },
    ...(yearendPred ? [{
      key: "yearend",
      label: "Year-End Savings Projection",
      value: `₹${Number(yearendPred.yearEndSavings || 0).toLocaleString("en-IN")}`,
      sub: `Over ${yearendPred.monthsToProject || 0} months remaining`,
      color: "var(--savings)",
      bg: "var(--savings-bg)",
    }] : []),
  ];

  const tips = score.healthScore >= 70 ? [
    "✅ Excellent savings ratio — keep it up!",
    "✅ Consider investing your surplus for long-term growth.",
    "✅ Your expense ratio is well under control.",
  ] : score.healthScore >= 50 ? [
    "⚠️ Financial health is average. Target higher savings.",
    "⚠️ Aim to save 20–30% of your income monthly.",
    "⚠️ Review spending categories to find savings opportunities.",
  ] : [
    "🔴 Expenses are dangerously high relative to income.",
    "🔴 Create a strict budget and cut non-essentials immediately.",
    "🔴 Consider increasing income or reducing fixed costs.",
  ];

  return (
    <div className="page-wrapper">
      <div className="section-header mb-32">
        <div>
          <h1 className="page-title">Financial Health Score</h1>
          <p className="page-subtitle">AI-powered analysis using monthly time-series expenses (Linear Regression + Random Forest)</p>
        </div>
      </div>

      {/* Score + status */}
      <div className="grid-2 mb-32" style={{ alignItems: "start" }}>
        {/* Radial gauge */}
        <div className="card" style={{ textAlign: "center", padding: "32px 24px", position: "relative", overflow: "hidden" }}>
          {/* Ambient glow behind chart */}
          <div style={{
            position: "absolute", top: "30%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "300px", height: "300px",
            background: `radial-gradient(circle, ${statusColor}15 0%, transparent 70%)`,
            pointerEvents: "none",
          }} />

          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, position: "relative" }}>Financial Health Score</h3>
          <div className="health-score-wrap" style={{ position: "relative" }}>
            <ResponsiveContainer width="100%" height={260}>
              <RadialBarChart
                innerRadius="64%"
                outerRadius="92%"
                data={radialData}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar
                  angleAxisId={0}
                  dataKey="value"
                  background={{ fill: "rgba(255,255,255,0.04)" }}
                  cornerRadius={10}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="health-score-center" style={{ color: statusColor }}>
              <div className="health-score-value" style={{ textShadow: `0 6px 24px ${statusColor}44` }}>
                {score.healthScore ?? 0}
              </div>
              <div className="health-score-sub">out of 100</div>
            </div>
          </div>
          <div style={{
            display: "inline-block",
            marginTop: 24,
            padding: "10px 28px",
            borderRadius: 24,
            background: `${statusColor}15`,
            border: `2px solid ${statusColor}44`,
            color: statusColor,
            fontWeight: 800,
            fontSize: 18,
            boxShadow: `0 4px 16px ${statusColor}18`,
            animation: "glowPulse 3s ease-in-out infinite",
          }}>
            {score.status}
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid-2" style={{ gap: 14 }}>
          {metrics.map(({ label, value, color, info }, idx) => (
            <div
              key={label}
              className="card"
              onClick={() => setModalInfo({ title: label, value, color, text: info })}
              style={{ padding: "18px", cursor: "pointer", animation: `fadeInUp var(--dur-md) var(--ease) both`, animationDelay: `${idx * 0.05}s` }}
            >
              <p className="card-title" style={{ marginBottom: 4 }}>
                {label} <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 4 }}>ⓘ</span>
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, color, marginTop: 6, letterSpacing: "-0.5px" }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Predictions */}
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>📅 AI Predictions</h2>
      <div className="grid-2 mb-32" style={{ gap: 20 }}>
        {predictions.map(({ key, label, value, sub, color, bg }, idx) => (
          <button
            type="button"
            key={key}
            className={`card prediction-card ${selectedPrediction === key ? "active" : ""}`}
            style={{ background: bg, border: `1px solid ${color}33`, animation: `fadeInUp var(--dur-md) var(--ease) both`, animationDelay: `${idx * 0.08}s` }}
            onClick={() => {
              if (key === "predicted") {
                navigate("/prediction/categories");
                return;
              }
              setSelectedPrediction(key);
            }}
          >
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{label}</p>
            <p style={{ fontSize: 32, fontWeight: 900, color, letterSpacing: "-1px" }}>{value}</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{sub}</p>
          </button>
        ))}
      </div>

      <div className="card mb-32">
        {selectedPrediction === "predicted" ? (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Predicted Next Month: What is included</h3>
            <div className="grid-2" style={{ gap: 14 }}>
              <div className="prediction-detail-block">
                <p className="prediction-detail-label">Predicted Expense</p>
                <p className="prediction-detail-value">₹{predictedExpenseValue.toLocaleString("en-IN")}</p>
                <p className="prediction-detail-note">ML forecast from your monthly expense history (time-series).</p>
              </div>
              <div className="prediction-detail-block">
                <p className="prediction-detail-label">Compared to Average</p>
                <p className="prediction-detail-value">
                  {monthlyGapValue >= 0 ? "+" : "-"}₹{Math.abs(monthlyGapValue).toLocaleString("en-IN")}
                </p>
                <p className="prediction-detail-note">Difference vs your average monthly expense.</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Savings Potential: How it is calculated</h3>
            <div className="grid-2" style={{ gap: 14 }}>
              <div className="prediction-detail-block">
                <p className="prediction-detail-label">Expected Monthly Income</p>
                <p className="prediction-detail-value">₹{monthlyIncomeValue.toLocaleString("en-IN")}</p>
                <p className="prediction-detail-note">Income recorded in your current period.</p>
              </div>
              <div className="prediction-detail-block">
                <p className="prediction-detail-label">Predicted Expense</p>
                <p className="prediction-detail-value">₹{predictedExpenseValue.toLocaleString("en-IN")}</p>
                <p className="prediction-detail-note">Forecasted spending for next month.</p>
              </div>
            </div>
            <div className="prediction-equation">
              <strong>Savings Potential</strong> = ₹{monthlyIncomeValue.toLocaleString("en-IN")} - ₹{predictedExpenseValue.toLocaleString("en-IN")} = <strong>₹{savingsPotentialValue.toLocaleString("en-IN")}</strong>
            </div>
          </>
        )}
      </div>

      {/* Year-End Details */}
      {yearendPred && (
        <div className="card mb-32" style={{ background: "var(--income-bg)", border: "1px solid rgba(44,182,125,0.2)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "var(--income)" }}>📈 Year-End Projection Details</h3>
          <div className="grid-2" style={{ gap: 16 }}>
            <div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Total Projected Income</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: "var(--income)", marginTop: 4 }}>₹{Number(yearendPred.totalProjectedIncome || 0).toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Total Projected Expenses</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: "var(--expense)", marginTop: 4 }}>₹{Number(yearendPred.totalProjectedExpenses || 0).toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Monthly Avg Savings</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: "var(--savings)", marginTop: 4 }}>₹{Number(yearendPred.monthlyAverageSavings || 0).toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>Monthly Avg Expense</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: "var(--investment)", marginTop: 4 }}>₹{Number(yearendPred.monthlyAverageExpense || 0).toLocaleString("en-IN")}</p>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: "12px", background: "rgba(44,182,125,0.06)", borderRadius: "var(--r-md)", border: "1px solid rgba(44,182,125,0.1)" }}>
            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Confidence: <strong style={{ color: "var(--income)" }}>{yearendPred.confidence || "medium"}</strong>
              {yearendPred.confidence === "low" && " (Add more transaction history for accurate predictions)"}
            </p>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="card">
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>💡 Personalised Tips</h3>
        <ul style={{ paddingLeft: 20, lineHeight: 2, color: "var(--text-secondary)", fontSize: 14 }}>
          {tips.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      </div>

      {/* Modal */}
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
            <button onClick={() => setModalInfo(null)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}>✕</button>
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

export default Prediction;
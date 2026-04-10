import { useState, useEffect, useMemo, useCallback } from "react";
import API from "../services/api";
import { useToast } from "../context/ToastContext";

const CATEGORIES = [
  "rent", "emi", "groceries", "bills", "insurance", 
  "food", "entertainment", "shopping", "other", "hobbies", "emergency", 
  "investment", "goals", "travel", "health", "education",
];

function getProgressColor(pct) {
  if (pct >= 100) return "var(--expense)";
  if (pct >= 80)  return "var(--investment)";
  if (pct >= 50)  return "#eab308";
  return "var(--income)";
}

function Budget() {
  const toast = useToast();
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [salary, setSalary] = useState("");
  const [target, setTarget] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");

  // Loan Calculator State
  const [loanParams, setLoanParams] = useState({ amount: "", rate: "", tenure: "" });
  const [loanResult, setLoanResult] = useState(null);
  const [loanSubmitting, setLoanSubmitting] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const monthOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      opts.push({ val, label });
    }
    return opts;
  }, []);

  useEffect(() => {
    if (!selectedMonth && monthOptions.length > 0) {
      setSelectedMonth(monthOptions[0].val);
    }
  }, [monthOptions, selectedMonth]);

  const fetchData = useCallback(async () => {
    if (!selectedMonth) return;
    try {
      setLoading(true);
      const res = await API.get("/budget/status", { params: { month: selectedMonth } });
      const seen = new Set();
      const deduped = (res.data || []).filter((item) => {
        const cat = String(item.category || "").trim().toLowerCase();
        if (!cat || seen.has(cat)) return false;
        seen.add(cat);
        return true;
      });
      setData(deduped);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (selectedMonth) {
      fetchData();
    }
    const refresh = () => { if (selectedMonth) fetchData(); };
    window.addEventListener("finghitBudgetUpdated", refresh);
    window.addEventListener("storage", (e) => e.key === "finghitBudgetUpdate" && refresh());
    return () => window.removeEventListener("finghitBudgetUpdated", refresh);
  }, [fetchData, selectedMonth]);

  const setBudget = async (e) => {
    e?.preventDefault();
    if (!category.trim() || !limit || Number(limit) <= 0) {
      toast("Enter a valid category and monthly limit.", "error"); return;
    }
    try {
      setSubmitting(true);
      await API.post("/budget", { category, monthlyLimit: Number(limit) });
      toast(`Budget for "${category}" saved!`, "success");
      setCategory(""); setLimit("");
      fetchData();
    } catch (err) {
      toast(err?.response?.data?.message || "Failed to save budget.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const calcTarget = () => {
    const sal = Number(salary);
    if (!sal || sal <= 0) { toast("Enter a valid monthly salary.", "error"); return; }
    const needs = sal * 0.5;
    const wants = sal * 0.3;
    const sav   = sal * 0.2;
    setTarget({
      salary: sal, needs, wants, savings: sav,
      items: [
        // Needs (50%)
        { category: "rent",      label: "House Rent",           limit: needs * 0.40 },
        { category: "emi",       label: "EMI / Loan",           limit: needs * 0.20 },
        { category: "groceries", label: "Groceries & Kitchen",  limit: needs * 0.18 },
        { category: "bills",     label: "Utilities",            limit: needs * 0.15 },
        { category: "insurance", label: "Insurance & Health",   limit: needs * 0.07 },
        
        // Wants (30%)
        { category: "food",      label: "Dining Out",            limit: wants * 0.25 },
        { category: "entertainment", label: "Entertainment",   limit: wants * 0.20 },
        { category: "shopping",  label: "Shopping",              limit: wants * 0.20 },
        { category: "travel",    label: "Travel & Transport",    limit: wants * 0.20 },
        { category: "hobbies",   label: "Hobbies",               limit: wants * 0.15 },
        
        // Savings (20%)
        { category: "emergency", label: "Emergency Fund", limit: sav * 0.40 },
        { category: "investment",label: "Investments",    limit: sav * 0.35 },
        { category: "goals",     label: "Future Goals",   limit: sav * 0.15 },
        { category: "other",     label: "Annual Bills",   limit: sav * 0.10 },
      ],
    });
  };

  const applyTarget = async () => {
    if (!target) return;
    try {
      setSubmitting(true);
      for (const item of target.items) {
        await API.post("/budget", { category: item.category, monthlyLimit: Math.round(item.limit) });
      }
      toast("50/30/20 budgets applied!", "success");
      fetchData();
    } catch (err) {
      toast(err?.response?.data?.message || "Failed to apply budgets.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const calcLoan = async (e) => {
    e?.preventDefault();
    if (!loanParams.amount || !loanParams.rate || !loanParams.tenure) {
      toast("Please fill all loan fields.", "error"); return;
    }
    try {
      setLoanSubmitting(true);
      const res = await API.post("/loan/calculate", {
        loanAmount: Number(loanParams.amount),
        interestRate: Number(loanParams.rate),
        tenureMonths: Number(loanParams.tenure)
      });
      setLoanResult(res.data);
      setShowSchedule(false);
      toast("Loan evaluated successfully!", "success");
    } catch (err) {
      toast(err?.response?.data?.message || err?.response?.data?.error || "Failed to calculate loan.", "error");
    } finally {
      setLoanSubmitting(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="section-header mb-32">
        <div>
          <h1 className="page-title">Budget Management</h1>
          <p className="page-subtitle">Set limits and track spending by category</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchData}>🔄 Refresh</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginBottom: 32 }}>
        {/* Manual budget form */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>📝 Set Budget Limit</h3>
          <form onSubmit={setBudget}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Monthly Limit (₹)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                placeholder="e.g. 5000"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? "Saving…" : "✨ Save Budget"}
            </button>
          </form>
        </div>

        {/* 50/30/20 calculator */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>🎯 50/30/20 Rule</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            Enter your salary to auto-generate smart budgets
          </p>
          <div className="form-group">
            <label className="form-label">Monthly Salary (₹)</label>
            <input
              className="form-input"
              type="number"
              min="1"
              placeholder="e.g. 50000"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
          </div>

          {target ? (
            <>
              <div className="grid-3 mb-16" style={{ gap: 8 }}>
                {[
                  { label: "Needs 50%", value: target.needs, bg: "var(--savings-bg)", color: "var(--savings)" },
                  { label: "Wants 30%", value: target.wants, bg: "var(--expense-bg)",  color: "var(--expense)" },
                  { label: "Savings 20%", value: target.savings, bg: "var(--income-bg)", color: "var(--income)" },
                ].map(({ label, value, bg, color }) => (
                  <div key={label} style={{ background: bg, padding: "10px 12px", borderRadius: "var(--r-sm)" }}>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</p>
                    <p style={{ fontSize: 16, fontWeight: 800, color }}>₹{Math.round(value).toLocaleString("en-IN")}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-8">
                <button className="btn btn-success" onClick={applyTarget} disabled={submitting}>
                  {submitting ? "Applying…" : "Apply All Budgets"}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={calcTarget}>Recalc</button>
              </div>
            </>
          ) : (
            <button className="btn btn-secondary btn-full" onClick={calcTarget}>
              Calculate Budget
            </button>
          )}
        </div>

        {/* Loan & EMI Smart Calculator */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>🏦 Loan & EMI Calculator</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            Evaluate EMI affordability against your budget
          </p>

          {!loanResult ? (
            <form onSubmit={calcLoan}>
              <div className="form-group mb-12">
                <label className="form-label">Loan Amount (₹)</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="e.g. 500000"
                  value={loanParams.amount}
                  onChange={(e) => setLoanParams({ ...loanParams, amount: e.target.value })}
                />
              </div>
              <div className="grid-2 mb-12" style={{ gap: 12 }}>
                <div className="form-group mb-0">
                  <label className="form-label">Interest Rate (%)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.1"
                    placeholder="e.g. 10.5"
                    value={loanParams.rate}
                    onChange={(e) => setLoanParams({ ...loanParams, rate: e.target.value })}
                  />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label">Tenure (Months)</label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="e.g. 60"
                    value={loanParams.tenure}
                    onChange={(e) => setLoanParams({ ...loanParams, tenure: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-full mt-8" disabled={loanSubmitting}>
                {loanSubmitting ? "Calculating…" : "Evaluate Loan"}
              </button>
            </form>
          ) : (
            <div>
              <div className="flex-between mb-16 pb-12" style={{ borderBottom: "1px solid var(--border-color)" }}>
                <div>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>MONTHLY EMI</p>
                  <h4 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>₹{loanResult.emi.toLocaleString("en-IN", {maximumFractionDigits: 0})}</h4>
                </div>
                <span className={`badge ${loanResult.loanStatus === 'Risky' ? 'badge-expense' : 'badge-income'}`} style={{ padding: "6px 12px", fontSize: 13, background: loanResult.loanStatus === 'Risky' ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)', color: loanResult.loanStatus === 'Risky' ? 'var(--expense)' : 'var(--income)' }}>
                  {loanResult.loanStatus === 'Risky' ? '⚠️ Risky' : '✅ Safe'}
                </span>
              </div>

              <div className="mb-16">
                <h5 style={{ fontSize: 13, marginBottom: 8, color: "var(--text-primary)" }}>AI Recommendations:</h5>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  {loanResult.recommendations.map((rec, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{rec}</li>
                  ))}
                </ul>
              </div>

              <div className="grid-2 gap-8 mb-16">
                <div style={{ background: "var(--bg-secondary)", padding: 10, borderRadius: "var(--r-sm)" }}>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Current Savings</p>
                  <p style={{ fontSize: 15, fontWeight: 700, margin:0, color: "var(--income)" }}>₹{loanResult.updatedBudget.currentSavings.toLocaleString("en-IN", {maximumFractionDigits: 0})}</p>
                </div>
                <div style={{ background: "var(--bg-secondary)", padding: 10, borderRadius: "var(--r-sm)" }}>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Est. Post-EMI</p>
                  <p style={{ fontSize: 15, fontWeight: 700, margin:0, color: loanResult.updatedBudget.newSavings < 0 ? "var(--expense)" : "var(--income)" }}>₹{loanResult.updatedBudget.newSavings.toLocaleString("en-IN", {maximumFractionDigits: 0})}</p>
                </div>
              </div>

              <div className="flex gap-8">
                <button className="btn btn-secondary btn-full" onClick={() => setShowSchedule(!showSchedule)}>
                  {showSchedule ? 'Hide' : 'View'} Schedule
                </button>
                <button className="btn btn-secondary btn-full" onClick={() => setLoanResult(null)}>
                  Reset
                </button>
              </div>

              {showSchedule && (
                <div style={{ marginTop: 16, maxHeight: 200, overflowY: "auto", border: "1px solid var(--border-color)", borderTop: "none", borderRadius: "10px",  scrollbarWidth: "thin",  msOverflowStyle: "none" }}>
                  <table style={{ width: "100%", fontSize: 12, textAlign: "left", borderCollapse: "collapse" }}>
                    <thead style={{ background: "var(--bg-secondary)", position: "sticky", top: 0, zIndex: 1 }}>
                      <tr>
                        <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-color)" }}>M</th>
                        <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-color)" }}>Principal</th>
                        <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-color)" }}>Interest</th>
                        <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-color)" }}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loanResult.repaymentSchedule.map(row => (
                        <tr key={row.month}>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" }}>{row.month}</td>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-color)", color: "var(--income)", fontWeight: 600 }}>₹{row.principalPaid.toFixed(0)}</td>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-color)", color: "var(--expense)" }}>₹{row.interestPaid.toFixed(0)}</td>
                          <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-color)" }}>₹{row.remainingBalance.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Budget cards */}
      <div className="flex-between mb-20" style={{ alignItems: "flex-end" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
          📊 Your Budget Status
        </h2>
        <div style={{ position: "relative", display: "inline-block" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", borderRight: "1px solid var(--border-color)", paddingRight: 8 }}>🗓️</span>
          <select 
            className="form-select" 
            style={{ 
              width: "auto", 
              padding: "8px 16px 8px 48px", 
              fontSize: 14,
              fontWeight: 600,
              borderRadius: "12px",
              cursor: "pointer",
              appearance: "none",
              backgroundPosition: "right 14px center",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--card-bg, #ffffff)",
              color: "var(--text-primary)",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
              transition: "all 0.2s ease"
            }} 
            onMouseEnter={(e) => e.target.style.transform = "translateY(-1px)"}
            onMouseLeave={(e) => e.target.style.transform = "translateY(0)"}
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {monthOptions.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /><p>Loading budgets…</p></div>
      ) : data.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No budgets yet</div>
            <div className="empty-state-desc">Create your first budget above to start tracking!</div>
          </div>
        </div>
      ) : (
        <div className="grid-auto">
          {data.map((item) => {
            const pct = item.limit > 0
              ? Math.min(Math.round((item.spent / item.limit) * 100), 999)
              : (item.spent > 0 ? 100 : 0);
            const over = item.spent > item.limit;
            const color = getProgressColor(pct);

            return (
              <div
                key={item.category}
                className="card"
                style={{ border: over ? "1px solid rgba(244,63,94,0.4)" : undefined }}
              >
                <div className="flex-between mb-16">
                  <h3 style={{ fontSize: 15, fontWeight: 700, textTransform: "capitalize", color: "var(--text-primary)" }}>
                    {item.category}
                  </h3>
                  {over && (
                    <span className="badge badge-expense">⚠️ Over</span>
                  )}
                </div>

                {/* Progress */}
                <div className="progress-track mb-8">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(pct, 100)}%`, background: color }}
                  />
                </div>

                <div className="flex-between mb-16">
                  <span style={{ fontSize: 12, color, fontWeight: 600 }}>{pct}% used</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {item.limit === 0
                      ? "No limit set"
                      : item.remaining >= 0
                      ? `₹${item.remaining.toFixed(0)} left`
                      : `₹${Math.abs(item.remaining).toFixed(0)} over`}
                  </span>
                </div>

                <div className="grid-2" style={{ gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>SPENT</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: over ? "var(--expense)" : "var(--text-primary)" }}>
                      ₹{(item.spent || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>LIMIT</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: "var(--text-secondary)" }}>
                      ₹{(item.limit || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Budget;
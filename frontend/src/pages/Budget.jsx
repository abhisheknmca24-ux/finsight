import { useState, useEffect, useMemo, useCallback } from "react";
import API from "../services/api";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";

const CATEGORIES = [
  "rent", "emi", "groceries", "bills", "insurance", 
  "food", "entertainment", "shopping", "other", "hobbies", "emergency", 
  "investment", "goals", "travel", "health", "education",
];

const DEFAULT_RULE = {
  needs: 50,
  wants: 30,
  savings: 20,
};

const RULE_INPUTS = [
  { key: "needs", label: "Needs %", helper: "Rent, groceries, bills" },
  { key: "wants", label: "Wants %", helper: "Lifestyle and flexible spending" },
  { key: "savings", label: "Savings %", helper: "Emergency fund and investments" },
];

const parseRuleValues = (rule) => ({
  needs: Number(rule.needs),
  wants: Number(rule.wants),
  savings: Number(rule.savings),
});

const validateRule = (rule) => {
  const parsedRule = parseRuleValues(rule);
  const values = Object.values(parsedRule);

  if (values.some((value) => Number.isNaN(value) || value < 0)) {
    return { isValid: false, message: "Enter valid percentages for needs, wants, and savings." };
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 100) > 0.01) {
    return { isValid: false, message: "Your custom rule must total 100% before calculating." };
  }

  return { isValid: true, message: "", rule: parsedRule, total };
};

const formatPct = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return "0";
  if (Number.isInteger(num)) return String(num);
  return num.toFixed(2).replace(/\.?0+$/, "");
};

const formatRuleText = (rule) => `${formatPct(rule.needs)}/${formatPct(rule.wants)}/${formatPct(rule.savings)}`;

function getProgressColor(pct) {
  if (pct >= 100) return "var(--expense)";
  if (pct >= 80)  return "var(--investment)";
  if (pct >= 50)  return "#eab308";
  return "var(--income)";
}

function Budget() {
  const toast = useToast();
  const { theme } = useTheme();
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [salary, setSalary] = useState("");
  const [target, setTarget] = useState(null);
  const [ruleMode, setRuleMode] = useState("standard");
  const [customRule, setCustomRule] = useState({
    needs: String(DEFAULT_RULE.needs),
    wants: String(DEFAULT_RULE.wants),
    savings: String(DEFAULT_RULE.savings),
  });
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

  const customRuleValidation = useMemo(() => validateRule(customRule), [customRule]);

  const handleSalaryChange = (value) => {
    setSalary(value);
    if (target) setTarget(null);
  };

  const handleCustomRuleChange = (key, value) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setCustomRule((current) => ({
        ...current,
        [key]: value,
      }));
      if (target) setTarget(null);
    }
  };

  const handleRuleModeChange = (mode) => {
    setRuleMode(mode);
    if (target) setTarget(null);
  };

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

    const selectedRule = ruleMode === "custom"
      ? customRuleValidation
      : { isValid: true, rule: DEFAULT_RULE };

    if (!selectedRule.isValid) {
      toast(selectedRule.message, "error");
      return;
    }

    const { needs: needsPct, wants: wantsPct, savings: savingsPct } = selectedRule.rule;

    const needs = sal * (needsPct / 100);
    const wants = sal * (wantsPct / 100);
    const sav   = sal * (savingsPct / 100);
    setTarget({
      salary: sal, needs, wants, savings: sav,
      rule: selectedRule.rule,
      ruleLabel: ruleMode === "custom"
        ? `${formatRuleText(selectedRule.rule)} custom rule`
        : "50/30/20 budgeting rule",
      items: [
        // Needs allocation
        { category: "rent",      label: "House Rent",           limit: needs * 0.40 },
        { category: "emi",       label: "EMI / Loan",           limit: needs * 0.20 },
        { category: "groceries", label: "Groceries & Kitchen",  limit: needs * 0.18 },
        { category: "bills",     label: "Utilities",            limit: needs * 0.15 },
        { category: "insurance", label: "Insurance & Health",   limit: needs * 0.07 },
        
        // Wants allocation
        { category: "food",      label: "Dining Out",            limit: wants * 0.25 },
        { category: "entertainment", label: "Entertainment",   limit: wants * 0.20 },
        { category: "shopping",  label: "Shopping",              limit: wants * 0.20 },
        { category: "travel",    label: "Travel & Transport",    limit: wants * 0.20 },
        { category: "hobbies",   label: "Hobbies",               limit: wants * 0.15 },
        
        // Savings allocation
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
      toast(`Budgets applied using the ${target.ruleLabel}!`, "success");
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

        {/* Budget rule calculator */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>🎯 Budget Rule</h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
            Choose 50/30/20 or set a custom split to auto-generate smart budgets
          </p>

          {/* Rule mode selector */}
          <div className="type-selector" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 14, gap: 10 }}>
            <button
              type="button"
              className={`type-btn ${ruleMode === "standard" ? "active" : ""}`}
              onClick={() => handleRuleModeChange("standard")}
              style={{
                borderColor: ruleMode === "standard" ? "var(--brand)" : undefined,
                padding: "10px 12px",
                fontSize: 13,
              }}
            >
              📊 50/30/20
            </button>
            <button
              type="button"
              className={`type-btn ${ruleMode === "custom" ? "active" : ""}`}
              onClick={() => handleRuleModeChange("custom")}
              style={{
                borderColor: ruleMode === "custom" ? "var(--brand)" : undefined,
                padding: "10px 12px",
                fontSize: 13,
              }}
            >
              🎨 Custom
            </button>
          </div>

          {ruleMode === "custom" && (
            <div style={{
              border: "1px solid var(--border-color)",
              borderRadius: "var(--r-md)",
              padding: "12px",
              background: "rgba(127,90,240,0.06)",
              marginBottom: 14,
            }}>
              <div className="grid-3" style={{ gap: 10 }}>
                {RULE_INPUTS.map((item) => (
                  <div key={item.key} className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{item.label}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-input"
                      value={customRule[item.key]}
                      onChange={(e) => handleCustomRuleChange(item.key, e.target.value)}
                      placeholder="0"
                      style={{ padding: "10px 12px" }}
                    />
                    <span style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4, display: "block" }}>
                      {item.helper}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: "var(--r-sm)",
                background: customRuleValidation.isValid ? "rgba(44,182,125,0.08)" : "rgba(244,63,94,0.08)",
                border: `1px solid ${customRuleValidation.isValid ? "rgba(44,182,125,0.25)" : "rgba(244,63,94,0.25)"}`,
                color: customRuleValidation.isValid ? "var(--income)" : "var(--expense)",
                fontWeight: 600,
                fontSize: 12,
              }}>
                {customRuleValidation.isValid
                  ? `Custom rule ready: ${formatRuleText(customRuleValidation.rule)} = 100%`
                  : customRuleValidation.message}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Monthly Salary (₹)</label>
            <input
              className="form-input"
              type="number"
              min="1"
              placeholder="e.g. 50000"
              value={salary}
              onChange={(e) => handleSalaryChange(e.target.value)}
            />
          </div>

          {target ? (
            <>
              <div className="grid-3 mb-16" style={{ gap: 8 }}>
                {[
                  { label: `Needs ${formatPct(target.rule?.needs ?? DEFAULT_RULE.needs)}%`, value: target.needs, bg: "var(--savings-bg)", color: "var(--savings)" },
                  { label: `Wants ${formatPct(target.rule?.wants ?? DEFAULT_RULE.wants)}%`, value: target.wants, bg: "var(--expense-bg)",  color: "var(--expense)" },
                  { label: `Savings ${formatPct(target.rule?.savings ?? DEFAULT_RULE.savings)}%`, value: target.savings, bg: "var(--income-bg)", color: "var(--income)" },
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
          <select 
            className="form-select" 
            style={{ 
              width: "auto", 
              minWidth: "160px",
              padding: "10px 40px 10px 14px", 
              fontSize: 14,
              fontWeight: 600,
              borderRadius: "14px",
              cursor: "pointer",
              appearance: "none",
              border: theme === "dark" ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.1)",
              backgroundColor: theme === "dark" ? "rgba(15, 23, 42, 0.4)" : "rgba(255, 255, 255, 0.8)",
              color: "var(--text-primary)",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23${theme === "dark" ? "94a3b8" : "6B7280"}' d='M1 1l5 5 5-5'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
              boxShadow: theme === "dark" ? "0 4px 12px rgba(0, 0, 0, 0.2)" : "0 2px 8px rgba(0, 0, 0, 0.06)",
              transition: "all 0.2s cubic-bezier(0.3, 0, 0.5, 1)"
            }} 
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = theme === "dark" ? "rgba(30, 41, 59, 0.6)" : "rgba(255, 255, 255, 0.95)";
              e.target.style.borderColor = theme === "dark" ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.15)";
              e.target.style.boxShadow = theme === "dark" ? "0 8px 16px rgba(0, 0, 0, 0.3), 0 0 20px rgba(127, 90, 240, 0.1)" : "0 4px 12px rgba(0, 0, 0, 0.08)";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = theme === "dark" ? "rgba(15, 23, 42, 0.4)" : "rgba(255, 255, 255, 0.8)";
              e.target.style.borderColor = theme === "dark" ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";
              e.target.style.boxShadow = theme === "dark" ? "0 4px 12px rgba(0, 0, 0, 0.2)" : "0 2px 8px rgba(0, 0, 0, 0.06)";
            }}
            onFocus={(e) => {
              e.target.style.outline = "none";
              e.target.style.borderColor = theme === "dark" ? "rgba(127, 90, 240, 0.6)" : "rgba(109, 77, 224, 0.5)";
              e.target.style.boxShadow = theme === "dark" ? "0 0 0 3px rgba(127, 90, 240, 0.15)" : "0 0 0 3px rgba(109, 77, 224, 0.1)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = theme === "dark" ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";
              e.target.style.boxShadow = theme === "dark" ? "0 4px 12px rgba(0, 0, 0, 0.2)" : "0 2px 8px rgba(0, 0, 0, 0.06)";
            }}
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

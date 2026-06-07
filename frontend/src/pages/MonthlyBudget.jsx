import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import API from "../services/api";
import { useToast } from "../context/ToastContext";

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

const NEEDS_ALLOCATION = [
  { key: "rent", label: "House Rent", emoji: "🏠", ratio: 0.4, note: "Essential" },
  { key: "emi", label: "EMI / Loan Repayment", emoji: "🏦", ratio: 0.2, note: "Essential" },
  { key: "groceries", label: "Groceries & Kitchen", emoji: "🛒", ratio: 0.18, note: "Essential" },
  { key: "bills", label: "Utilities (Power, Water, Internet)", emoji: "💡", ratio: 0.15, note: "Essential" },
  { key: "insurance", label: "Insurance & Medicines", emoji: "🏥", ratio: 0.07, note: "Essential" },
];

const WANTS_ALLOCATION = [
  { key: "food", label: "Dining Out & Cafes", emoji: "🍽️", ratio: 0.25, note: "Flexible" },
  { key: "entertainment", label: "Entertainment & OTT", emoji: "🎬", ratio: 0.2, note: "Flexible" },
  { key: "shopping", label: "Shopping & Lifestyle", emoji: "🛍️", ratio: 0.2, note: "Flexible" },
  { key: "travel", label: "Travel & Transport", emoji: "✈️🚗", ratio: 0.2, note: "Flexible" },
  { key: "hobbies", label: "Hobbies & Subscriptions", emoji: "🎮", ratio: 0.15, note: "Flexible" },
];

const SAVINGS_ALLOCATION = [
  { key: "emergency", label: "Emergency Fund", emoji: "🛡️", ratio: 0.4, note: "Priority" },
  { key: "investment", label: "SIP / Long-Term Investment", emoji: "📈", ratio: 0.35, note: "Priority" },
  { key: "goals", label: "Future Goals Fund", emoji: "🎯", ratio: 0.15, note: "Planned" },
  { key: "other", label: "Annual Bills Reserve", emoji: "🧾", ratio: 0.1, note: "Planned" },
];

const SECTION_CONFIG = {
  needs: {
    title: "Needs",
    color: "#7F5AF0",
    gradient: "linear-gradient(135deg, #7F5AF0 0%, #6C47D9 100%)",
    description: "Necessary monthly obligations (must-pay expenses)",
    items: NEEDS_ALLOCATION,
  },
  wants: {
    title: "Wants",
    color: "#f43f5e",
    gradient: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
    description: "Lifestyle and comfort spend (reduce these first if budget is tight)",
    items: WANTS_ALLOCATION,
  },
  savings: {
    title: "Savings",
    color: "#2CB67D",
    gradient: "linear-gradient(135deg, #2CB67D 0%, #22a06b 100%)",
    description: "Future-ready allocation for emergencies, wealth, and planned goals",
    items: SAVINGS_ALLOCATION,
  },
};

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

const formatRuleText = (rule) => `${rule.needs}/${rule.wants}/${rule.savings}`;

const buildBreakdown = (total, items) =>
  items.map((item) => ({
    ...item,
    value: total * item.ratio,
  }));

function MonthlyBudget() {
  const toast = useToast();
  const [salary, setSalary] = useState("");
  const [ruleMode, setRuleMode] = useState("standard");
  const [customRule, setCustomRule] = useState({
    needs: String(DEFAULT_RULE.needs),
    wants: String(DEFAULT_RULE.wants),
    savings: String(DEFAULT_RULE.savings),
  });
  const [budgetData, setBudgetData] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [loadingBudgets, setLoadingBudgets] = useState(false);

  const customRuleValidation = validateRule(customRule);

  const displayedRule = submitted && budgetData
    ? budgetData.rule
    : ruleMode === "custom"
      ? parseRuleValues(customRule)
      : DEFAULT_RULE;

  const handleCustomRuleChange = (key, value) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setCustomRule((current) => ({
        ...current,
        [key]: value,
      }));
    }
  };

  const calculateBudget = () => {
    const sal = Number(salary);
    if (Number.isNaN(sal) || sal <= 0) {
      toast("Please enter a valid salary.", "error");
      return;
    }

    const selectedRule = ruleMode === "custom"
      ? customRuleValidation
      : { isValid: true, rule: DEFAULT_RULE };

    if (!selectedRule.isValid) {
      toast(selectedRule.message, "error");
      return;
    }

    const { needs, wants, savings } = selectedRule.rule;

    setBudgetData({
      salary: Number(sal.toFixed(2)),
      needs: Number(((sal * needs) / 100).toFixed(2)),
      wants: Number(((sal * wants) / 100).toFixed(2)),
      savings: Number(((sal * savings) / 100).toFixed(2)),
      rule: { needs, wants, savings },
      ruleLabel: ruleMode === "custom" ? `${formatRuleText(selectedRule.rule)} custom rule` : "50/30/20 budgeting rule",
    });
    setSubmitted(true);
  };

  const setAutoBudgets = async () => {
    if (!budgetData) return;

    try {
      setLoadingBudgets(true);

      const budgets = [
        ...NEEDS_ALLOCATION.map((item) => ({
          category: item.key,
          monthlyLimit: budgetData.needs * item.ratio,
        })),
        ...WANTS_ALLOCATION.map((item) => ({
          category: item.key,
          monthlyLimit: budgetData.wants * item.ratio,
        })),
        ...SAVINGS_ALLOCATION.map((item) => ({
          category: item.key,
          monthlyLimit: budgetData.savings * item.ratio,
        })),
      ];

      for (const budget of budgets) {
        await API.post("/budget", budget);
      }

      toast(`Budgets created using the ${budgetData.ruleLabel}!`, "success");
    } catch (err) {
      console.error(err);
      toast("Error creating budgets.", "error");
    } finally {
      setLoadingBudgets(false);
    }
  };

  const chartData = budgetData
    ? [
      {
        key: "needs",
        name: "Needs",
        fullName: `Needs (${budgetData.rule.needs}%)`,
        value: Number(budgetData.needs),
        color: SECTION_CONFIG.needs.color,
      },
      {
        key: "wants",
        name: "Wants",
        fullName: `Wants (${budgetData.rule.wants}%)`,
        value: Number(budgetData.wants),
        color: SECTION_CONFIG.wants.color,
      },
      {
        key: "savings",
        name: "Savings",
        fullName: `Savings (${budgetData.rule.savings}%)`,
        value: Number(budgetData.savings),
        color: SECTION_CONFIG.savings.color,
      },
    ]
    : [];

  const needsBreakdown = budgetData ? buildBreakdown(budgetData.needs, NEEDS_ALLOCATION) : [];
  const wantsBreakdown = budgetData ? buildBreakdown(budgetData.wants, WANTS_ALLOCATION) : [];
  const savingsBreakdown = budgetData ? buildBreakdown(budgetData.savings, SAVINGS_ALLOCATION) : [];

  const fixedNeedsAmount = budgetData
    ? budgetData.needs * (
      (NEEDS_ALLOCATION.find((item) => item.key === "rent")?.ratio || 0) +
      (NEEDS_ALLOCATION.find((item) => item.key === "emi")?.ratio || 0)
    )
    : 0;

  const fixedNeedsRatio = budgetData?.salary ? (fixedNeedsAmount / budgetData.salary) * 100 : 0;

  const aiRecommendation = budgetData
    ? {
      profile: fixedNeedsRatio > 35 ? "High fixed-cost profile" : "Balanced fixed-cost profile",
      note:
        fixedNeedsRatio > 35
          ? "Rent plus EMI is consuming a large share of your income. Tighten wants and keep the savings bucket protected."
          : "Your fixed obligations are under control. You can steadily grow long-term investments without squeezing daily life.",
    }
    : null;

  const resetPlanner = () => {
    setSalary("");
    setSubmitted(false);
    setBudgetData(null);
  };

  return (
    <div className="page-wrapper">
      <div className="section-header mb-32">
        <div>
          <h1 className="page-title">💡 Smart Budget Planning</h1>
          <p className="page-subtitle">
            {submitted && budgetData
              ? `Using the ${budgetData.ruleLabel}`
              : ruleMode === "custom"
                ? "Create your own budget rule and divide your salary your way"
                : "Using the 50/30/20 Budgeting Rule"}
          </p>
        </div>
      </div>

      {!submitted ? (
        <div className="content-narrow">
          <div className="glass-card" style={{ padding: "40px 32px", textAlign: "center" }}>
            <div style={{ fontSize: "56px", marginBottom: "20px" }}>💰</div>
            <h2 style={{ margin: "0 0 10px 0", color: "var(--text-primary)", fontSize: "22px", fontWeight: 700 }}>
              Enter Your Monthly Salary
            </h2>
            <p style={{ margin: "0 0 28px 0", color: "var(--text-muted)", fontSize: "14px" }}>
              Choose the default rule or create your own percentage split for needs, wants, and savings
            </p>

            {/* Rule mode selector */}
            <div className="type-selector mb-24" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <button
                type="button"
                className={`type-btn ${ruleMode === "standard" ? "active" : ""}`}
                onClick={() => setRuleMode("standard")}
                style={{ borderColor: ruleMode === "standard" ? "var(--brand)" : undefined }}
              >
                📊 50/30/20 Rule
              </button>
              <button
                type="button"
                className={`type-btn ${ruleMode === "custom" ? "active" : ""}`}
                onClick={() => setRuleMode("custom")}
                style={{ borderColor: ruleMode === "custom" ? "var(--brand)" : undefined }}
              >
                🎨 Custom Rule
              </button>
            </div>

            {ruleMode === "custom" && (
              <div className="card mb-24" style={{ textAlign: "left" }}>
                <div className="grid-3" style={{ gap: "14px" }}>
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
                      />
                      <span style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: 4, display: "block" }}>{item.helper}</span>
                    </div>
                  ))}
                </div>

                <div style={{
                  marginTop: "16px",
                  padding: "12px 14px",
                  borderRadius: "var(--r-sm)",
                  background: customRuleValidation.isValid ? "rgba(44,182,125,0.08)" : "rgba(244,63,94,0.08)",
                  border: `1px solid ${customRuleValidation.isValid ? "rgba(44,182,125,0.25)" : "rgba(244,63,94,0.25)"}`,
                  color: customRuleValidation.isValid ? "var(--income)" : "var(--expense)",
                  fontWeight: 600,
                  fontSize: "13px",
                }}>
                  {customRuleValidation.isValid
                    ? `Custom rule ready: ${formatRuleText(customRuleValidation.rule)} = 100%`
                    : customRuleValidation.message}
                </div>
              </div>
            )}

            <div className="form-group" style={{ textAlign: "left" }}>
              <label className="form-label">Monthly Salary (₹)</label>
              <input
                type="number"
                className="form-input"
                placeholder="Enter monthly salary"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                style={{ fontSize: "18px", fontWeight: 700 }}
              />
            </div>

            <button
              className="btn btn-primary btn-full btn-lg"
              onClick={calculateBudget}
              style={{ marginTop: 8 }}
            >
              📊 Calculate Budget Allocation
            </button>

            {/* Preview */}
            <div className="card mt-24" style={{ textAlign: "left" }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: 15, fontWeight: 700 }}>
                {ruleMode === "custom" ? "Custom Rule Preview:" : "Real-Life 50/30/20 Mapping:"}
              </h3>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text-secondary)", lineHeight: "1.9", fontSize: 13 }}>
                <li>
                  <strong>{displayedRule.needs}% - Needs</strong>: House Rent, EMI, Groceries, Utilities, Insurance
                </li>
                <li>
                  <strong>{displayedRule.wants}% - Wants</strong>: Dining Out, Entertainment, Shopping, Travel & Transport, Hobbies
                </li>
                <li>
                  <strong>{displayedRule.savings}% - Savings</strong>: Emergency Fund, SIP/Investments, Goal-Based Savings
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div>
          {/* Summary cards */}
          <div className="grid-4 mb-32" style={{ gap: 16 }}>
            <div className="hero-card" style={{ padding: "24px", gridColumn: "span 1" }}>
              <p style={{ margin: "0 0 8px 0", fontSize: "11px", opacity: 0.8, textTransform: "uppercase", letterSpacing: "1px" }}>
                Monthly Income
              </p>
              <h2 style={{ margin: 0, fontSize: "28px", fontWeight: 800 }}>₹{budgetData.salary.toFixed(0)}</h2>
            </div>

            <div className="card" style={{ padding: "24px" }}>
              <p style={{ margin: "0 0 8px 0", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>
                Active Rule
              </p>
              <h2 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: 800, color: "var(--brand-light)" }}>
                {formatRuleText(budgetData.rule)}
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{budgetData.ruleLabel}</p>
            </div>

            <button
              className="card"
              onClick={setAutoBudgets}
              disabled={loadingBudgets}
              style={{ padding: "24px", cursor: loadingBudgets ? "not-allowed" : "pointer", textAlign: "left", border: "1px solid rgba(44,182,125,0.3)" }}
            >
              <p style={{ margin: "0 0 8px 0", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>
                Auto-Setup Budgets
              </p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--income)" }}>
                {loadingBudgets ? "Creating..." : "✨ Click to Auto-Create"}
              </p>
            </button>

            <button
              onClick={resetPlanner}
              className="card"
              style={{ padding: "24px", cursor: "pointer", textAlign: "left", border: "1px solid rgba(244,63,94,0.3)" }}
            >
              <p style={{ margin: "0 0 8px 0", fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>
                Start Over
              </p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--expense)" }}>
                🔄 Reset Planner
              </p>
            </button>
          </div>

          {/* Charts */}
          <div className="grid-charts mb-32">
            <div className="chart-card">
              <div className="chart-title">📊 Budget Allocation Overview</div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="fullName"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={40}
                    paddingAngle={3}
                    label={({ fullName, value }) => `${fullName}: ₹${value.toFixed(0)}`}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `₹${Number(value).toFixed(2)}`}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="chart-title">💹 Monthly Allocation Chart</div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(value) => `₹${Number(value).toFixed(2)}`} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>📋 Monthly Breakdown</h2>

          {Object.entries(SECTION_CONFIG).map(([key, config]) => {
            const total = budgetData[key];
            const percent = budgetData.rule[key];
            const breakdown = key === "needs"
              ? needsBreakdown
              : key === "wants"
                ? wantsBreakdown
                : savingsBreakdown;

            return (
              <div key={key} style={{ marginBottom: "24px" }}>
                <div style={{
                  background: config.gradient,
                  padding: "20px 24px",
                  borderRadius: "var(--r-2xl) var(--r-2xl) 0 0",
                  color: "white",
                }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
                    {config.title} ({percent}%) — ₹{total.toFixed(0)}
                  </h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.9 }}>{config.description}</p>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: "12px",
                  background: "var(--card-bg)",
                  padding: "16px",
                  borderRadius: "0 0 var(--r-2xl) var(--r-2xl)",
                  border: "1px solid var(--border-color)",
                  borderTop: "none",
                }}>
                  {breakdown.map((item) => (
                    <div
                      key={item.key}
                      className="card"
                      style={{
                        borderLeft: `3px solid ${config.color}`,
                        padding: "14px",
                      }}
                    >
                      <p style={{ margin: "0 0 6px 0", color: "var(--text-muted)", fontSize: "12px", fontWeight: 600 }}>
                        {item.emoji} {item.label} ({Math.round(item.ratio * 100)}%)
                      </p>
                      <p style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
                        ₹{item.value.toFixed(0)}
                      </p>
                      <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: config.color, fontWeight: 600 }}>
                        {item.note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* AI Guidance */}
          <div className="card mb-24" style={{ borderLeft: "4px solid var(--savings)", background: "rgba(0,194,255,0.04)" }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: 700, color: "var(--savings)" }}>
              🤖 AI Real-Life Scenario Guidance
            </h3>
            <p style={{ margin: "0 0 10px 0", fontWeight: 600, fontSize: 14 }}>
              Profile: <span style={{ color: "var(--brand-light)" }}>{aiRecommendation.profile}</span>
            </p>
            <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "var(--text-muted)" }}>
              Rule in use: {budgetData.ruleLabel}
            </p>
            <p style={{ margin: "0 0 14px 0", color: "var(--text-secondary)", lineHeight: 1.7, fontSize: 13 }}>
              {aiRecommendation.note}
            </p>
            <p style={{ margin: "0 0 14px 0", fontWeight: 600, fontSize: 13 }}>
              Fixed obligation check (Rent + EMI): ₹{fixedNeedsAmount.toFixed(0)} ({fixedNeedsRatio.toFixed(1)}% of income)
            </p>
            <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text-secondary)", lineHeight: "1.9", fontSize: 13 }}>
              <li>Cover needs first so rent, EMI, groceries, bills, and insurance stay protected every month.</li>
              <li>Use wants as the first adjustment area when a month becomes tight or irregular.</li>
              <li>Keep your savings bucket close to {budgetData.rule.savings}% of income so future goals do not get delayed.</li>
              <li>If fixed obligations move above 35% to 40% of income, reduce wants before touching savings.</li>
              <li>Use Auto-Setup to create real category budgets from the rule you selected.</li>
            </ul>
          </div>

          {/* Pro Tips */}
          <div className="card" style={{ borderLeft: "4px solid var(--investment)", background: "rgba(245,158,11,0.04)" }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", fontWeight: 700, color: "var(--investment)" }}>
              💡 Pro Tips for Financial Success
            </h3>
            <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text-secondary)", lineHeight: "1.9", fontSize: 13 }}>
              <li>Track your spending categories weekly so your real spending matches your chosen rule.</li>
              <li>Revisit the rule every few months if your rent, EMI, or savings goals change.</li>
              <li>Automate savings and SIP transfers on salary day so the savings bucket happens first.</li>
              <li>Keep a 3 to 6 month emergency fund for rent and EMI safety.</li>
              <li>If overspending happens, cut wants first and keep long-term discipline steady.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default MonthlyBudget;

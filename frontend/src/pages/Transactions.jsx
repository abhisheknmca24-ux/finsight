import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import API from "../services/api";

import useRealtimeTransactions from "../hooks/useRealtimeTransactions";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "income", label: "Income" },
  { key: "expense", label: "Expense" },
  { key: "investment", label: "Investment" },
  { key: "cashflow", label: "Cashflow" },
];

const isValidView = (view) => FILTERS.some((f) => f.key === view);

const monthKeyFromDate = (dateStr) => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

const amountForTrend = (tx, activeView) => {
  const amount = Number(tx?.amount || 0);
  if (!amount) return 0;

  if (activeView === "income") return tx.type === "income" ? amount : 0;
  if (activeView === "expense") return tx.type === "expense" ? amount : 0;
  if (activeView === "investment") return tx.type === "investment" ? amount : 0;

  if (activeView === "cashflow" || activeView === "all") {
    return tx.type === "expense" || tx.type === "investment" ? amount : 0;
  }

  return 0;
};

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const MONTHLY_BAR_MAX_WIDTH = 56;
const DAILY_BAR_MAX_WIDTH = 32;

const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="trend-tooltip">
      <div className="trend-tooltip-label">{label}</div>
      <div className="trend-tooltip-value">{money(payload[0].value)}</div>
    </div>
  );
};

function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMonthKey, setSelectedMonthKey] = useState("");
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [ruleKeyword, setRuleKeyword] = useState("");
  const [ruleCategory, setRuleCategory] = useState("food");
  const [isAddingRule, setIsAddingRule] = useState(false);

  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;
  const { transactions: rtTransactions, loading: rtLoading, error: rtError } = useRealtimeTransactions(user?._id || user?.id, 2000);

  const handleAddRule = async () => {
    if (!ruleKeyword.trim()) return;
    try {
      setIsAddingRule(true);
      await API.post("/transactions/rules", { keyword: ruleKeyword, category: ruleCategory });
      setRuleKeyword("");
      window.dispatchEvent(new Event("finghitBudgetUpdated"));
    } catch (err) {
      alert(err?.response?.data?.message || err.message);
    } finally {
      setIsAddingRule(false);
    }
  };

  useEffect(() => {
    setSelectedDay(null);
    setSelectedCategory("all");
  }, [selectedMonthKey]);

  const queryType = searchParams.get("type");
  const queryView = searchParams.get("view");
  const activeView = useMemo(() => {
    if (queryType && ["income", "expense", "investment"].includes(queryType)) {
      return queryType;
    }
    if (queryView && isValidView(queryView)) {
      return queryView;
    }
    return "all";
  }, [queryType, queryView]);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const { data } = await API.get("/transactions?limit=1000");
        setTransactions(data.transactions);
        setError("");
      } catch (err) {
        console.error("API fetch error:", err);
        // Don't set error yet, maybe Firebase will work
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  useEffect(() => {
    // If realtime transactions exist, use them as they represent the live state
    if (!rtLoading) {
      if (rtError) {
        console.warn("Firestore real-time sync is unavailable:", rtError);
        // We don't set the global error here because we might have API data
      } else if (rtTransactions && rtTransactions.length > 0) {
        setTransactions(rtTransactions);
      }
    }
  }, [rtTransactions, rtLoading, rtError]);

  const visibleTransactions = useMemo(() => {
    if (activeView === "cashflow") {
      return transactions.filter((tx) => tx.type === "income" || tx.type === "expense");
    }
    return transactions;
  }, [activeView, transactions]);

  const totalAmount = useMemo(() => {
    if (activeView === "cashflow") {
      return visibleTransactions.reduce((acc, tx) => {
        if (tx.type === "income") return acc + Number(tx.amount || 0);
        if (tx.type === "expense") return acc - Number(tx.amount || 0);
        return acc;
      }, 0);
    }
    return visibleTransactions.reduce((acc, tx) => acc + Number(tx.amount || 0), 0);
  }, [activeView, visibleTransactions]);

  const monthlyTrend = useMemo(() => {
    const bucket = new Map();

    visibleTransactions.forEach((tx) => {
      const monthKey = monthKeyFromDate(tx.date);
      const amount = amountForTrend(tx, activeView);
      if (!monthKey || amount <= 0) return;

      if (!bucket.has(monthKey)) {
        bucket.set(monthKey, {
          monthKey,
          total: 0,
          label: new Date(`${monthKey}-01`).toLocaleDateString("en-IN", {
            month: "short",
            year: "2-digit",
          }),
        });
      }

      bucket.get(monthKey).total += amount;
    });

    return Array.from(bucket.values()).sort((a, b) =>
      a.monthKey.localeCompare(b.monthKey)
    );
  }, [activeView, visibleTransactions]);

  useEffect(() => {
    if (!monthlyTrend.length) {
      setSelectedMonthKey("");
      return;
    }

    const hasMonth = monthlyTrend.some((m) => m.monthKey === selectedMonthKey);
    if (!hasMonth) {
      setSelectedMonthKey(monthlyTrend[monthlyTrend.length - 1].monthKey);
    }
  }, [monthlyTrend, selectedMonthKey]);

  const selectedMonthLabel = useMemo(() => {
    const month = monthlyTrend.find((m) => m.monthKey === selectedMonthKey);
    return month?.label || "";
  }, [monthlyTrend, selectedMonthKey]);

  const selectedMonthTotal = useMemo(() => {
    const month = monthlyTrend.find((m) => m.monthKey === selectedMonthKey);
    return month?.total || 0;
  }, [monthlyTrend, selectedMonthKey]);

  const selectedMonthTransactions = useMemo(() => {
    if (!selectedMonthKey) return visibleTransactions;
    return visibleTransactions.filter(
      (tx) => monthKeyFromDate(tx.date) === selectedMonthKey
    );
  }, [selectedMonthKey, visibleTransactions]);

  const categoryFilteredTransactions = useMemo(() => {
    if (selectedCategory === "all") return selectedMonthTransactions;
    return selectedMonthTransactions.filter((tx) => tx.category === selectedCategory);
  }, [selectedMonthTransactions, selectedCategory]);

  const dailyTrend = useMemo(() => {
    if (!selectedMonthKey) return [];
    const [yearStr, monthStr] = selectedMonthKey.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (Number.isNaN(year) || Number.isNaN(monthIndex)) return [];

    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const totals = new Array(daysInMonth).fill(0);

    categoryFilteredTransactions.forEach((tx) => {
      const date = new Date(tx.date);
      if (Number.isNaN(date.getTime())) return;
      const day = date.getDate();
      const amount = amountForTrend(tx, activeView);
      if (amount > 0) totals[day - 1] += amount;
    });

    return totals
      .map((total, i) => ({
        day: i + 1,
        label: String(i + 1),
        total,
      }))
      .filter((d) => d.total > 0);
  }, [activeView, selectedMonthKey, categoryFilteredTransactions]);

  const displayedTransactions = useMemo(() => {
    if (selectedDay === null) return categoryFilteredTransactions;
    return categoryFilteredTransactions.filter(
      (tx) => new Date(tx.date).getDate() === selectedDay
    );
  }, [categoryFilteredTransactions, selectedDay]);

  const heading =
    activeView === "income"
      ? "Income Transactions"
      : activeView === "expense"
        ? "Expense Transactions"
        : activeView === "investment"
          ? "Investment Transactions"
          : activeView === "cashflow"
            ? "Cashflow Transactions"
            : "All Transactions";

  const subtitle =
    activeView === "cashflow"
      ? "Income and expenses together so you can track net savings"
      : "View and review all detailed entries";

  const setView = (view) => {
    if (view === "all") {
      setSearchParams({});
      return;
    }
    if (["income", "expense", "investment"].includes(view)) {
      setSearchParams({ type: view });
      return;
    }
    setSearchParams({ view });
  };

  return (
    <div className="page-wrapper">
      <div className="section-header mb-24">
        <div>
          <h1 className="page-title">{heading}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <Link to="/add" className="btn btn-primary">+ Add Transaction</Link>
      </div>

      <div className="card mb-24">
        <div className="flex-between" style={{ gap: 12, flexWrap: "wrap" }}>
          <div className="filter-row">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`filter-chip ${activeView === filter.key ? "active" : ""}`}
                onClick={() => setView(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="text-right">
            <div className="text-muted" style={{ fontSize: 12 }}>Entries: {visibleTransactions.length}</div>
            <div className={activeView === "cashflow" ? (totalAmount >= 0 ? "text-income font-bold" : "text-expense font-bold") : "text-brand font-bold"}>
              {activeView === "cashflow" && totalAmount >= 0 ? "+" : ""}₹{Math.abs(totalAmount).toLocaleString("en-IN")}
            </div>
          </div>
        </div>
      </div>

      {!loading && !error && monthlyTrend.length > 0 && (
        <div className="chart-card mb-24">
          <div className="chart-title">
            <span>📊 Past Monthly Spends</span>
            <div className="text-muted" style={{ fontSize: 12 }}>
              Click a bar to view daily transactions of that month
            </div>
          </div>

          <div className="trend-meta-row">
            <div>
              <div className="trend-big-number">
                {money(selectedMonthTotal)}
              </div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                {selectedMonthLabel ? `${selectedMonthLabel} total` : "Total"}
              </div>
            </div>
            <div className="trend-month-pill" style={{ padding: 0, backgroundColor: "var(--bg-secondary)", borderRadius: "20px", display: "flex", alignItems: "center" }}>
              <select
                className="form-select"
                style={{ border: "none", background: "transparent", cursor: "pointer", padding: "6px 28px 6px 14px", outline: "none", color: "var(--text-secondary)", fontWeight: 500, fontSize: "13px", height: "auto" }}
                value={selectedMonthKey}
                onChange={(e) => setSelectedMonthKey(e.target.value)}
              >
                <option value="" disabled>Select a month</option>
                {monthlyTrend.map(m => (
                  <option key={m.monthKey} value={m.monthKey}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="trend-chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyTrend} barCategoryGap="38%" margin={{ top: 10, right: 10, left: 20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  label={{ value: "Month", position: "insideBottom", offset: -20, fill: "var(--text-muted)", fontSize: 13, fontWeight: 500 }} 
                />
                <YAxis 
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} 
                  label={{ value: "Amount", angle: -90, position: "insideLeft", offset: -10, fill: "var(--text-muted)", fontSize: 13, fontWeight: 500 }} 
                />
                <Tooltip content={<TrendTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                <Bar
                  dataKey="total"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={MONTHLY_BAR_MAX_WIDTH}
                  cursor="pointer"
                  onClick={(payload) =>
                    setSelectedMonthKey(payload?.monthKey || payload?.payload?.monthKey || "")
                  }
                >
                  {monthlyTrend.map((entry) => (
                    <Cell
                      key={entry.monthKey}
                      fill={
                        entry.monthKey === selectedMonthKey
                          ? "#5b63ff"
                          : "rgba(91,99,255,0.35)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!loading && !error && selectedMonthKey && (
        <div className="chart-card mb-24">
          <div className="chart-title">
            <span>🗓️ Daily Transactions in {selectedMonthLabel}</span>
          </div>

          {dailyTrend.length === 0 ? (
            <div className="empty-state" style={{ padding: "24px 12px" }}>
              <div className="empty-state-desc">No day-wise spending data in this month.</div>
            </div>
          ) : (
            <div className="trend-chart-wrap">
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={dailyTrend} barCategoryGap="30%" margin={{ top: 10, right: 10, left: 20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="label" 
                    label={{ value: "Date", position: "insideBottom", offset: -20, fill: "var(--text-muted)", fontSize: 13, fontWeight: 500 }} 
                  />
                  <YAxis 
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} 
                    label={{ value: "Amount", angle: -90, position: "insideLeft", offset: -10, fill: "var(--text-muted)", fontSize: 13, fontWeight: 500 }} 
                  />
                  <Tooltip content={<TrendTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                  <Bar
                    dataKey="total"
                    fill="#14b8a6"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={DAILY_BAR_MAX_WIDTH}
                    cursor="pointer"
                    onClick={(payload) => setSelectedDay(payload?.day || payload?.payload?.day || null)}
                  >
                    {dailyTrend.map((entry) => (
                      <Cell
                        key={entry.day}
                        fill={entry.day === selectedDay ? "#0f766e" : "#14b8a6"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <div className="chart-card">
        <div className="flex-between mb-16" style={{ flexWrap: 'wrap', gap: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)" }}>
            <span>🧾 Transaction List</span>
            {selectedDay !== null && (
              <span style={{ fontSize: 12, fontWeight: 600, backgroundColor: "var(--bg-secondary)", padding: "4px 10px", borderRadius: 12, color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                Day {selectedDay}
              </span>
            )}
          </h2>
          <div className="transaction-toolbar-actions flex" style={{ gap: 12, alignItems: "center" }}>
            {selectedDay !== null && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ borderRadius: "20px", display: "flex", alignItems: "center", gap: 4, padding: "6px 14px" }}
                onClick={() => setSelectedDay(null)}
              >
                Clear Day ✕
              </button>
            )}
            <select
              className="form-select"
              style={{ width: "min(100%, 12rem)", minWidth: "10rem", borderRadius: "10px", padding: "8px 16px", cursor: "pointer", appearance: "none", backgroundPosition: "right 12px center", fontWeight: 500 }}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">📁 All Categories</option>
              {Array.from(new Set(selectedMonthTransactions.map(tx => tx.category))).filter(Boolean).sort().map(cat => (
                <option key={cat} value={cat} style={{ textTransform: "capitalize" }}>{cat.replace(/-/g, " ")}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rule-panel" style={{ padding: "12px", backgroundColor: "rgba(91,99,255,0.05)", border: "1px solid rgba(91,99,255,0.1)", borderRadius: "8px", marginBottom: "16px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>Fix Categorization:</span>
          <input 
            type="text" 
            placeholder="Keyword (e.g. swigg)" 
            className="form-input" 
            style={{ width: "min(100%, 10rem)", padding: "6px 12px", borderRadius: "6px", fontSize: "13px", height: "auto" }}
            value={ruleKeyword}
            onChange={(e) => setRuleKeyword(e.target.value)}
          />
          <select 
            className="form-select" 
            style={{ width: "min(100%, 8.75rem)", padding: "6px 12px", borderRadius: "6px", fontSize: "13px", height: "auto" }}
            value={ruleCategory}
            onChange={(e) => setRuleCategory(e.target.value)}
          >
            <option value="food">Food</option>
            <option value="groceries">Groceries</option>
            <option value="transport">Transport</option>
            <option value="shopping">Shopping</option>
            <option value="bills">Bills</option>
            <option value="rent">Rent</option>
            <option value="investment">Investment</option>
            <option value="entertainment">Entertainment</option>
            <option value="income">Income</option>
            <option value="health">Health</option>
            <option value="travel">Travel</option>
            <option value="dining">Dining</option>
            <option value="education">Education</option>
            <option value="hobbies">Hobbies</option>
            <option value="emergency">Emergency</option>
            <option value="goals">Goals</option>
            <option value="insurance">Insurance</option>
            <option value="emi">EMI</option>
            <option value="other">Other</option>
          </select>
          <button 
            className="btn btn-primary" 
            style={{ padding: "6px 14px", fontSize: "13px", borderRadius: "6px", marginLeft: "auto" }}
            onClick={handleAddRule}
            disabled={isAddingRule || !ruleKeyword.trim()}
          >
            {isAddingRule ? "Applying..." : "Apply Rule"}
          </button>
        </div>

        {loading ? (
          <div className="loading-screen">
            <div className="spinner" />
            <p>Loading transactions...</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-state-icon">⚠️</div>
            <div className="empty-state-title">Couldn't load transactions</div>
            <div className="empty-state-desc">{error}</div>
            <button className="btn btn-primary mt-16" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        ) : displayedTransactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🧾</div>
            <div className="empty-state-title">No transactions found</div>
            <div className="empty-state-desc">Try another filter or add your first transaction.</div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {displayedTransactions.map((tx) => (
                  <tr key={tx._id}>
                    <td style={{ color: "var(--text-muted)" }}>
                      {new Date(tx.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <span className={`badge badge-${tx.type}`}>{tx.type}</span>
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{tx.category || "other"}</td>
                    <td style={{ color: "var(--text-muted)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tx.description || "-"}
                    </td>
                    <td
                      className="text-right font-bold"
                      style={{
                        color:
                          tx.type === "income"
                            ? "var(--income)"
                            : tx.type === "investment"
                              ? "var(--investment)"
                              : "var(--expense)",
                      }}
                    >
                      {tx.type === "income" ? "+" : "-"}₹{Number(tx.amount).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Transactions;

import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Link } from "react-router-dom";
import API from "../services/api";
import useRealtimeTransactions from "../hooks/useRealtimeTransactions";

const PIE_COLORS = [
  "#7F5AF0", "#2CB67D", "#f43f5e", "#f59e0b", "#00C2FF",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4",
];

const fmt = (n) => {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Number(n).toFixed(0)}`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="trend-tooltip">
      {label && <p className="trend-tooltip-label">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="trend-tooltip-value" style={{ color: p.color }}>
          {p.name}: ₹{Number(p.value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </p>
      ))}
    </div>
  );
};

function StatCard({ icon, label, value, type, sub, to }) {
  const cardContent = (
    <div className={`card stat-card ${type}`}>
      <div className="stat-inner-glow" />
      <div className={`stat-icon ${type}`}>{icon}</div>
      <p className="card-title">{label}</p>
      <div className={`card-value ${type}`}>{fmt(value)}</div>
      {sub && <p className="card-sub">{sub}</p>}
    </div>
  );

  if (!to) return cardContent;
  return (
    <Link to={to} className="stat-card-link" aria-label={`View ${label}`}>
      {cardContent}
    </Link>
  );
}

function ShimmerDashboard() {
  return (
    <div className="page-wrapper">
      {/* Shimmer header */}
      <div className="mb-32">
        <div className="shimmer shimmer-line" style={{ width: "50%", height: 28 }} />
        <div className="shimmer shimmer-line short" style={{ marginTop: 8 }} />
      </div>
      {/* Shimmer hero */}
      <div className="shimmer shimmer-card mb-32" style={{ height: 140, borderRadius: "var(--r-2xl)" }} />
      {/* Shimmer stat cards */}
      <div className="grid-4 mb-32">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="shimmer shimmer-card" />
        ))}
      </div>
      {/* Shimmer charts */}
      <div className="grid-charts">
        {[1, 2].map(i => (
          <div key={i} className="shimmer shimmer-card" style={{ height: 280 }} />
        ))}
      </div>
    </div>
  );
}

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartMode, setChartMode] = useState("area");
  const [downloading, setDownloading] = useState(false);

  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;
  const { transactions: rtTransactions } = useRealtimeTransactions(user?._id || user?.id, 10);

  const downloadProfessionalReport = async () => {
    try {
      setDownloading(true);
      const res = await API.get("/report", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "Professional_Report.pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Error downloading report:", err);
      alert("Failed to download report. Please try again later.");
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get("/dashboard");
        setData(res.data);
      } catch (err) {
        setError(err?.response?.data?.error || "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <ShimmerDashboard />;

  if (error) {
    return (
      <div className="page-wrapper">
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">Couldn't load dashboard</div>
          <div className="empty-state-desc">{error}</div>
          <button className="btn btn-primary mt-16" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Normalise API response
  const summary = data?.summary ?? data?.totals ?? {};
  const income = summary.totalIncome ?? summary.income ?? 0;
  const expense = summary.totalExpense ?? summary.expense ?? 0;
  const savings = summary.savings ?? income - expense;
  const investment = summary.totalInvestment ?? 0;
  const savingsRate = summary.savingsRate ?? (income > 0 ? ((savings / income) * 100).toFixed(1) : 0);

  const categoryBreakdown = (data?.categoryBreakdown ?? []).map((c) => ({
    name: (c.category ?? c._id ?? "Other"),
    value: c.total ?? 0,
  }));

  const monthlyTrend = data?.monthlyTrend ?? [];
  const recentTransactions = rtTransactions.length > 0 ? rtTransactions : (data?.recentTransactions ?? []);
  const pastMonthlySpends = monthlyTrend.map((m) => ({
    month: m.month,
    spend: Number(m.expense || 0),
  }));
  const latestMonthlySpend = pastMonthlySpends.length
    ? pastMonthlySpends[pastMonthlySpends.length - 1].spend
    : 0;

  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="section-header mb-32">
        <div>
          <h1 className="page-title">Financial Overview</h1>
          <p className="page-subtitle">Your complete money picture at a glance</p>
        </div>
        <div className="header-actions" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <span className="badge" style={{
            background: "rgba(44,182,125,0.1)",
            border: "1px solid rgba(44,182,125,0.3)",
            color: "var(--income)",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}>
            <span className="pulse-dot" /> Live
          </span>
          <button
            onClick={downloadProfessionalReport}
            disabled={downloading}
            className="btn btn-primary btn-sm"
          >
            {downloading ? "Generating..." : "📥 Download Report"}
          </button>
        </div>
      </div>

      {/* Hero Balance Card */}
      <div className="hero-card mb-32">
        <div className="hero-card-label">
          <span className="pulse-dot" />
          NET BALANCE
        </div>
        <div className="hero-card-value">{fmt(savings)}</div>
        <div className="hero-mini-stats">
          <div className="hero-mini-stat">
            <span className="hero-mini-stat-dot" style={{ background: "var(--income)" }} />
            <span style={{ color: "var(--text-muted)" }}>Income</span>
            <span style={{ color: "var(--income)" }}>{fmt(income)}</span>
          </div>
          <div className="hero-mini-stat">
            <span className="hero-mini-stat-dot" style={{ background: "var(--expense)" }} />
            <span style={{ color: "var(--text-muted)" }}>Expense</span>
            <span style={{ color: "var(--expense)" }}>{fmt(expense)}</span>
          </div>
          <div className="hero-mini-stat">
            <span className="hero-mini-stat-dot" style={{ background: "var(--investment)" }} />
            <span style={{ color: "var(--text-muted)" }}>Invested</span>
            <span style={{ color: "var(--investment)" }}>{fmt(investment)}</span>
          </div>
          <div className="hero-mini-stat">
            <span className="hero-mini-stat-dot" style={{ background: "var(--brand)" }} />
            <span style={{ color: "var(--text-muted)" }}>Savings Rate</span>
            <span style={{ color: "var(--brand-light)" }}>{savingsRate}%</span>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid-4 mb-32">
        <StatCard icon="💵" label="Total Income" value={income} type="income" sub={`Savings rate ${savingsRate}%`} to="/transactions?type=income" />
        <StatCard icon="💸" label="Total Expenses" value={expense} type="expense" sub="All spending" to="/transactions?type=expense" />
        <StatCard icon="🎯" label="Net Savings" value={savings} type="savings" sub="Income minus expenses" to="/transactions?view=cashflow" />
        <StatCard icon="📈" label="Investments" value={investment} type="invest" sub="Long-term wealth" to="/transactions?type=investment" />
      </div>

      {/* Charts */}
      <div className="grid-charts mb-32">
        {/* Past Monthly Spends */}
        <div className="chart-card">
          <div className="chart-title">
            <span>📊 Past Monthly Spends</span>
          </div>

          {pastMonthlySpends.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📉</div>
              <div className="empty-state-desc">No monthly expense history yet.</div>
            </div>
          ) : (
            <>
              <div className="trend-meta-row">
                <div>
                  <div className="trend-big-number">{fmt(latestMonthlySpend)}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>Latest month spend</div>
                </div>
              </div>

              <div className="trend-chart-wrap">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={pastMonthlySpends} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7F5AF0" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#2CB67D" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                    <Bar dataKey="spend" name="Spend" fill="url(#barGrad)" radius={[8, 8, 0, 0]} maxBarSize={42} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>

        {/* Pie chart */}
        <div className="chart-card">
          <div className="chart-title">
            <span>💰 Expense by Category</span>
          </div>
          {categoryBreakdown.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-desc">No category data yet. Add transactions to see breakdown.</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  paddingAngle={3}
                  label={({ name, percent }) =>
                    percent > 0.04 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
                  }
                  labelLine={false}
                >
                  {categoryBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(v) => (
                    <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{v}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Monthly trend */}
        <div className="chart-card">
          <div className="chart-title">
            <span>📈 Monthly Trend</span>
            <div className="flex gap-8">
              {["area", "bar"].map((m) => (
                <button
                  key={m}
                  className={`filter-chip ${chartMode === m ? "active" : ""}`}
                  onClick={() => setChartMode(m)}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {monthlyTrend.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <div className="empty-state-desc">No monthly data yet. Upload statements to see trends.</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              {chartMode === "area" ? (
                <AreaChart data={monthlyTrend}>
                  <defs>
                    <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2CB67D" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2CB67D" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gSavings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00C2FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00C2FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255, 255, 255, 0.1)', strokeWidth: 2 }} />
                  <Legend />
                  <Area type="monotone" dataKey="income" name="Income" stroke="#2CB67D" fill="url(#gIncome)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expense" name="Expense" stroke="#f43f5e" fill="url(#gExpense)" strokeWidth={2} />
                  <Area type="monotone" dataKey="savings" name="Savings" stroke="#00C2FF" fill="url(#gSavings)" strokeWidth={2} />
                </AreaChart>
              ) : (
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#2CB67D" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="savings" name="Savings" fill="#00C2FF" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="chart-card">
        <div className="chart-title mb-16">
          <span>📋 Recent Transactions</span>
          <Link to="/add" className="btn btn-sm btn-secondary">+ Add New</Link>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💳</div>
            <div className="empty-state-desc">No transactions yet. Add one or upload a statement.</div>
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
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr key={tx._id}>
                    <td style={{ color: "var(--text-muted)" }}>
                      {new Date(tx.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </td>
                    <td>
                      <span className={`badge badge-${tx.type}`}>{tx.type}</span>
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{tx.category || "other"}</td>
                    <td style={{ color: "var(--text-muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tx.description || "—"}
                    </td>
                    <td style={{
                      textAlign: "right",
                      fontWeight: 700,
                      color: tx.type === "income" ? "var(--income)" : tx.type === "investment" ? "var(--investment)" : "var(--expense)",
                    }}>
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

export default Dashboard;

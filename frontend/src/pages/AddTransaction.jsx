import { useState } from "react";
import API from "../services/api";
import { useToast } from "../context/ToastContext";

const CATEGORY_ICONS = {
  food: "🍔", travel: "✈️", shopping: "🛒", utilities: "💡",
  entertainment: "🎮", health: "💊", education: "🎓", rent: "🏠",
  emi: "🏦", subscriptions: "📺", personal_care: "💇", accommodation: "🏨",
  taxes: "📄", charity: "❤️", transfer: "↔️", other: "📦",
  salary: "💼", freelance: "💻", income: "💵", investment: "📈",
  sip: "📊", stocks: "📉", fd: "🏧",
};

const EXPENSE_CATS = [
  "food", "travel", "shopping", "utilities", "entertainment",
  "health", "education", "rent", "emi", "subscriptions",
  "personal_care", "accommodation", "taxes", "charity", "transfer", "other",
];
const INCOME_CATS = ["salary", "freelance", "income", "investment", "other"];
const INVEST_CATS = ["investment", "sip", "stocks", "fd", "other"];

function AddTransaction() {
  const toast = useToast();
  const [form, setForm] = useState({
    amount: "",
    type: "expense",
    category: "",
    description: "",
    date: "",
  });
  const [loading, setLoading] = useState(false);

  const catOptions =
    form.type === "income" ? INCOME_CATS :
      form.type === "investment" ? INVEST_CATS : EXPENSE_CATS;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const parsed = Number(form.amount);
    if (!form.amount || isNaN(parsed) || parsed <= 0) {
      toast("Amount must be a positive number.", "error"); return;
    }
    if (!form.type) {
      toast("Please select a transaction type.", "error"); return;
    }
    try {
      setLoading(true);
      await API.post("/transactions", {
        amount: parsed,
        type: form.type,
        category: form.category || undefined,
        description: form.description.trim() || undefined,
        date: form.date || undefined,
      });
      toast("Transaction added successfully!", "success");
      setForm({ amount: "", type: "expense", category: "", description: "", date: "" });
      window.dispatchEvent(new Event("finghitBudgetUpdated"));
    } catch (err) {
      toast(err?.response?.data?.message || "Failed to add transaction.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="section-header mb-32">
        <div>
          <h1 className="page-title">Add Transaction</h1>
          <p className="page-subtitle">Record income, expense, or investment</p>
        </div>
      </div>

      <div className="content-narrow">
        <div className="glass-card" style={{ padding: "32px" }}>
          <form onSubmit={handleSubmit}>
            {/* Type selector */}
            <div className="form-group">
              <label className="form-label">Transaction Type</label>
              <div className="type-selector" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                {["expense", "income", "investment"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`type-btn ${t} ${form.type === t ? "active" : ""}`}
                    onClick={() => setForm({ ...form, type: t, category: "" })}
                  >
                    {t === "expense" ? "💸" : t === "income" ? "💰" : "📈"}{" "}
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div className="form-group">
              <label className="form-label">Amount (₹) *</label>
              <input
                className="form-input"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="e.g. 1500"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.5px" }}
              />
            </div>

            {/* Category — icon grid */}
            <div className="form-group">
              <label className="form-label">
                Category <span style={{ color: "var(--text-muted)", fontWeight: 400, textTransform: "none" }}>(auto-detected if blank)</span>
              </label>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
                gap: "8px",
              }}>
                <button
                  type="button"
                  className={`filter-chip ${form.category === "" ? "active" : ""}`}
                  onClick={() => setForm({ ...form, category: "" })}
                  style={{ fontSize: 12 }}
                >
                  🤖 Auto
                </button>
                {catOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`filter-chip ${form.category === c ? "active" : ""}`}
                    onClick={() => setForm({ ...form, category: c })}
                    style={{ fontSize: 12, textTransform: "capitalize" }}
                  >
                    {CATEGORY_ICONS[c] || "📦"} {c.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">
                Description <span style={{ color: "var(--text-muted)", fontWeight: 400, textTransform: "none" }}>(optional)</span>
              </label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. Swiggy dinner for 2"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {/* Date */}
            <div className="form-group">
              <label className="form-label">
                Date <span style={{ color: "var(--text-muted)", fontWeight: 400, textTransform: "none" }}>(defaults to today)</span>
              </label>
              <input
                className="form-input"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                style={{ colorScheme: "dark" }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
              style={{ marginTop: 12 }}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  Adding…
                </>
              ) : (
                "✨ Add Transaction"
              )}
            </button>
          </form>
        </div>

        {/* AI Tip */}
        <div className="insight-strip mt-24">
          <span className="insight-strip-icon">💡</span>
          <span><strong>Smart tip:</strong> Leave category empty and our AI will automatically detect it from your description.</span>
        </div>
      </div>
    </div>
  );
}

export default AddTransaction;
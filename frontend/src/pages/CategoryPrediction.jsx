import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Legend,
} from "recharts";
import API from "../services/api";

function CategoryPrediction() {
  const [data, setData] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCategoryPrediction = async () => {
      try {
        const res = await API.get("/predict/categories");
        const payload = res.data;
        setData(payload);

        if (payload?.categories?.length) {
          setSelectedCategory(payload.categories[0].category);
        }
      } catch (err) {
        setError("Failed to load category-wise predictions.");
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryPrediction();
  }, []);

  const categoryChartData = useMemo(() => {
    const categories = data?.categories || [];
    return categories.map((item) => ({
      category: item.category,
      predictedExpense: Number(item.predictedExpense || 0),
      averageGrowth: Number(item.averageGrowth || 0),
    }));
  }, [data]);

  const selectedCategoryData = useMemo(() => {
    const categories = data?.categories || [];
    return categories.find((item) => item.category === selectedCategory) || categories[0] || null;
  }, [data, selectedCategory]);

  const selectedLineData = useMemo(() => {
    if (!selectedCategoryData) return [];

    const historyPoints = (selectedCategoryData.history || []).map((point) => ({
      month: point.monthLabel,
      actual: Number(point.amount || 0),
      forecast: null,
    }));

    if (historyPoints.length > 0) {
      historyPoints[historyPoints.length - 1] = {
        ...historyPoints[historyPoints.length - 1],
        forecast: historyPoints[historyPoints.length - 1].actual,
      };
    }

    historyPoints.push({
      month: new Date(`${selectedCategoryData.predictionMonth}-01`).toLocaleString("en-IN", {
        month: "short",
        year: "numeric",
      }),
      actual: null,
      forecast: Number(selectedCategoryData.predictedExpense || 0),
    });

    return historyPoints;
  }, [selectedCategoryData]);

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="loading-screen"><div className="spinner" /><p>Building category-wise prediction...</p></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-wrapper">
        <div className="empty-state">
          <div className="empty-state-icon">📉</div>
          <div className="empty-state-title">No prediction data</div>
          <div className="empty-state-desc">{error || "Add monthly transactions to generate category trends."}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="section-header mb-24">
        <div>
          <h1 className="page-title">Category-wise Expense Prediction</h1>
          <p className="page-subtitle">Future Expense = Past Trend + Growth Pattern (Linear Regression + Time-series forecast)</p>
        </div>
      </div>

      <div className="grid-3 mb-24">
        <div className="card">
          <p className="card-title">Prediction Month</p>
          <p className="card-value" style={{ color: "var(--brand-light)", fontSize: 30 }}>
            {new Date(`${data.predictionMonth}-01`).toLocaleString("en-IN", { month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="card">
          <p className="card-title">Total Predicted Expense</p>
          <p className="card-value expense">₹{Number(data.predictedTotal || 0).toLocaleString("en-IN")}</p>
        </div>
        <div className="card">
          <p className="card-title">Categories Forecasted</p>
          <p className="card-value" style={{ color: "var(--savings)" }}>{(data.categories || []).length}</p>
        </div>
      </div>

      <div className="grid-2 mb-24">
        <div className="card prediction-chart-card">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Predicted Expense by Category</h3>
          <ResponsiveContainer width="100%" height="88%">
            <BarChart data={categoryChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis tickFormatter={(value) => `₹${Number(value / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
              <Bar dataKey="predictedExpense" fill="var(--expense)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card prediction-chart-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Pattern Analysis (Selected Category)</h3>
            <select
              className="form-select"
              style={{ maxWidth: 220 }}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {(data.categories || []).map((item) => (
                <option key={item.category} value={item.category}>
                  {item.category}
                </option>
              ))}
            </select>
          </div>

          <ResponsiveContainer width="100%" height="84%">
            <LineChart data={selectedLineData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `₹${Number(value / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => value == null ? "-" : `₹${Number(value).toLocaleString("en-IN")}`} cursor={{ stroke: 'rgba(255, 255, 255, 0.1)', strokeWidth: 2 }} />
              <Legend />
              <Line type="monotone" dataKey="actual" stroke="var(--savings)" strokeWidth={3} dot={{ r: 4 }} name="Actual" />
              <Line type="monotone" dataKey="forecast" stroke="var(--investment)" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 5 }} name="Forecast" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>All Category Predictions</h3>
        <div className="category-pred-grid">
          {(data.categories || []).map((item) => (
            <div key={item.category} className="category-pred-card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <p className="card-title" style={{ marginBottom: 6 }}>{item.category}</p>
                  <p style={{ fontSize: 28, fontWeight: 800, color: "var(--expense)", lineHeight: 1 }}>
                    ₹{Number(item.predictedExpense || 0).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className={`trend-chip ${item.trend}`}>
                  {item.trend}
                </div>
              </div>

              <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                <div>Growth pattern: <strong>₹{Number(item.averageGrowth || 0).toLocaleString("en-IN")}</strong> per month</div>
                <div>Pattern type: <strong>{item.patternType.replaceAll("_", " ")}</strong></div>
                <div>Model: <strong>{item.model}</strong> | Confidence: <strong>{item.confidence}</strong></div>
              </div>

              <div style={{ marginTop: 12 }}>
                <p className="prediction-detail-label" style={{ marginBottom: 8 }}>Recent Monthly History</p>
                <div className="category-history-table">
                  {(item.history || []).slice(-4).map((point) => (
                    <div key={`${item.category}-${point.month}`} className="history-row">
                      <span>{point.monthLabel}</span>
                      <strong>₹{Number(point.amount || 0).toLocaleString("en-IN")}</strong>
                    </div>
                  ))}
                  <div className="history-row forecast">
                    <span>{new Date(`${item.predictionMonth}-01`).toLocaleString("en-IN", { month: "short", year: "numeric" })} (Pred)</span>
                    <strong>₹{Number(item.predictedExpense || 0).toLocaleString("en-IN")}</strong>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CategoryPrediction;

const axios = require("axios");
const Transaction = require("../models/Transaction");
const {
  getExpenseSeriesValues,
  estimateMonthlyIncome,
} = require("../utils/expenseSeries");

function toMonthKey(dateValue) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  const d = new Date(year, month - 1, 1);
  return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
}

function getNextMonthKey(monthKey) {
  if (!monthKey) {
    const now = new Date();
    now.setMonth(now.getMonth() + 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  const [year, month] = monthKey.split("-").map(Number);
  const next = new Date(year, month, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function calculateAverageGrowth(values) {
  if (!values || values.length < 2) return 0;
  const deltas = [];
  for (let i = 1; i < values.length; i += 1) {
    deltas.push(values[i] - values[i - 1]);
  }
  const avg = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
  return Number(avg.toFixed(2));
}

exports.predictExpense = async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id });

    const { series, values } = getExpenseSeriesValues(transactions);
    if (values.length === 0) {
      return res.json({ prediction: 0, model: "fallback", basis: "no_expense_history" });
    }

    const aiRes = await axios.post(`${process.env.ML_SERVICE_URL}/predict`, {
      values,
    });

    res.json({
      ...aiRes.data,
      basis: "monthly_expense_time_series",
      monthsUsed: series.length,
      monthlySeries: series,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.predictYearEnd = async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id });

    if (transactions.length === 0) {
      return res.json({ yearEndSavings: 0, monthsToProject: 0 });
    }

    const { series, values } = getExpenseSeriesValues(transactions);
    if (values.length === 0) {
      return res.json({ yearEndSavings: 0, monthsToProject: 0, basis: "no_expense_history" });
    }
    const monthlyIncome = estimateMonthlyIncome(transactions);

    const aiRes = await axios.post(`${process.env.ML_SERVICE_URL}/predict-yearend`, {
      values,
      income: monthlyIncome,
    });

    res.json({
      ...aiRes.data,
      basis: "monthly_expense_time_series",
      monthsUsed: series.length,
      monthlySeries: series,
      monthlyIncome,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.predictCategoryWise = async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id });
    const monthlyCategoryMap = new Map();

    transactions.forEach((tx) => {
      if (tx.type !== "expense") return;
      const monthKey = toMonthKey(tx.date);
      if (!monthKey) return;
      const category = (tx.category || "other").toLowerCase();
      const categoryMonthKey = `${category}__${monthKey}`;
      monthlyCategoryMap.set(
        categoryMonthKey,
        (monthlyCategoryMap.get(categoryMonthKey) || 0) + Number(tx.amount || 0)
      );
    });

    const categorySeriesMap = new Map();
    monthlyCategoryMap.forEach((amount, compositeKey) => {
      const [category, month] = compositeKey.split("__");
      if (!categorySeriesMap.has(category)) {
        categorySeriesMap.set(category, []);
      }
      categorySeriesMap.get(category).push({ month, amount: Number(amount.toFixed(2)) });
    });

    if (categorySeriesMap.size === 0) {
      return res.json({
        predictionMonth: getNextMonthKey(null),
        predictedTotal: 0,
        categories: [],
        note: "No expense category history found.",
      });
    }

    const allMonths = new Set();
    categorySeriesMap.forEach((series) => {
      series.forEach((point) => allMonths.add(point.month));
    });
    const latestMonth = Array.from(allMonths).sort((a, b) => a.localeCompare(b)).at(-1);
    const predictionMonth = getNextMonthKey(latestMonth);

    const categories = [];
    for (const [category, seriesRaw] of categorySeriesMap.entries()) {
      const history = seriesRaw
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((point) => ({
          month: point.month,
          monthLabel: formatMonthLabel(point.month),
          amount: Number(point.amount.toFixed(2)),
        }));

      const values = history.map((point) => point.amount);
      const avgGrowth = calculateAverageGrowth(values);
      const trend = avgGrowth > 0 ? "increasing" : avgGrowth < 0 ? "decreasing" : "stable";
      const patternType = Math.abs(avgGrowth) >= 100 ? "fixed_growth_pattern" : "variable_growth_pattern";

      let predictedExpense = values.at(-1) || 0;
      let confidence = values.length >= 4 ? "high" : values.length >= 2 ? "medium" : "low";
      let model = values.length >= 2 ? "trend_fallback" : "last_month_fallback";

      if (values.length >= 2) {
        try {
          const aiRes = await axios.post(`${process.env.ML_SERVICE_URL}/predict`, { values });
          predictedExpense = Number(aiRes.data.prediction || predictedExpense);
          confidence = aiRes.data.confidence || confidence;
          model = aiRes.data.model || model;
        } catch (err) {
          predictedExpense = Math.max(0, predictedExpense + avgGrowth);
        }
      }

      categories.push({
        category,
        predictionMonth,
        predictedExpense: Number(Math.max(0, predictedExpense).toFixed(2)),
        trend,
        averageGrowth: avgGrowth,
        confidence,
        model,
        patternType,
        formula: "Future Expense = Past Trend + Growth Pattern",
        history,
      });
    }

    categories.sort((a, b) => b.predictedExpense - a.predictedExpense);
    const predictedTotal = categories.reduce((sum, cat) => sum + cat.predictedExpense, 0);

    res.json({
      predictionMonth,
      predictedTotal: Number(predictedTotal.toFixed(2)),
      categories,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};